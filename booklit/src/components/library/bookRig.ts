import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { LocalBook } from '../../context/BookContext'
import { authorHue, spineWidth } from '../../lib/bookMeta'
import { BOOK_W, BOOK_H, coverTexture, spineTexture } from './bookTextures'

/**
 * A procedural clothbound hardcover: separate boards, a straight spine with
 * joints and shoulders, endpapers, headbands, a solid page block and a few
 * loose sheets on top of it that can actually be turned.
 *
 * Written after MengTo/complete-shelf, which builds its seven books the same
 * parametric way and whose brief is public. None of its code or artwork is used
 * — it carries no licence and its covers are the author's own — but the
 * construction it specifies is the right one, and this is our version of it.
 *
 * Two things that brief is emphatic about, both of which the first draft of
 * this file got wrong and which are the whole reason the book looked odd:
 *
 *   - The spine is *straight*. A half-cylinder bridging the boards turns the
 *     silhouette into a pill; a real case-bound spine is a flat panel with a
 *     joint groove either side of it.
 *   - The page block is *one solid body*. Splitting it into two half-stacks so
 *     that leaves could sit between them puts a visible canyon down the fore
 *     edge of a shut book. Instead the block stays whole and a handful of
 *     individual sheets lie on top of it — those are what turn, and they lift
 *     off the block rather than out of it.
 *
 * Why parametric at all, when `ModelScene` already has real GLB hardcovers: the
 * models are ~7 MB each and live in the sibling `cards/` project, streamed
 * through the backend's /models route because they're too big for this repo. A
 * rig costs a few hundred vertices, needs no network, and can be opened.
 *
 * World units match `bookTextures` (140 x 200 to a book), so a rig drops into
 * the same LayoutEngine grid the other scenes use.
 */

/** Cover board thickness. */
const BOARD = 3
/** How far the boards overhang the block on the three unbound sides — the
 *  "square". This is most of what makes a case-bound book read as bound rather
 *  than as a stack of paper with a lid. */
const SQUARE = 4
/** Width of the joint groove between the spine panel and each board — the
 *  channel the cover cloth sinks into and hinges on. Not a hole: the case is
 *  one continuous piece of cloth, so the spine panel below spans this. */
const JOINT = 2.2
/** Loose sheets lying on top of the block. Not a page count — enough to leaf
 *  through, few enough that the moving geometry stays under a thousand tris. */
export const LEAVES = 8
/** Thickness of one sheet, and so of the layer they occupy on top of the block. */
const LEAF_GAP = 0.3
/** Segments across a leaf. The curl is a vertex deformation, so this decides
 *  whether a turning page reads as paper or as folded card. */
const LEAF_SEG_X = 24
const LEAF_SEG_Y = 14

export interface Leaf {
  pivot: THREE.Group
  /** The deformable surface, with its undeformed vertex positions.
   *
   *  One double-sided plane, not a recto and a verso: a sheet is thinner than
   *  the depth buffer cares about, and two planes would have to be kept bent in
   *  exact agreement or the page splits along its own fold.
   */
  surface: {
    geometry: THREE.BufferGeometry
    position: THREE.BufferAttribute
    base: Float32Array
    /** Page width, so the arch can be expressed as a fraction of it. */
    width: number
  }
  /** Current curl and diagonal twist, and their spring velocities. */
  flex: { curve: number; twist: number; curveVelocity: number; twistVelocity: number }
  /** Where this sheet lies on the block... */
  restZ: number
  /** ...and on the turned pile above the opened board. A turn travels in z as
   *  well as rotating, or the sheet ends up inside the cover it flipped over. */
  turnedZ: number
}

export interface BookRig {
  root: THREE.Group
  /** Front board. Swings negative to open. */
  frontPivot: THREE.Group
  /** Back board. The surface the book rests on; held at zero. */
  backPivot: THREE.Group
  /** The page block. Never rotates — it is the right-hand page once open. */
  block: THREE.Group
  leaves: Leaf[]
  /** Everything a pointer may grab to turn a page: the loose sheets and the top
   *  of the block. A drag starting anywhere else orbits instead. */
  pageTargets: THREE.Mesh[]
  /**
   * Put real cover art on the case.
   *
   * More than assigning a map. A painted board is *cloth* — matte, sheened,
   * woven — and real cover art is a printed laminate, so the material has to
   * change with the picture or the art sits under a weave that greys it out.
   * And the spine and back are derived from the art rather than left on their
   * hue-painted defaults, so a book stops being a photo glued to a green case.
   *
   * Falls back to the painted case, and says so, if the image can't be sampled.
   */
  applyCover(texture: THREE.Texture): boolean
  width: number
  height: number
  /** Thickness of the case, boards included. */
  depth: number
  dispose(): void
}

/* ---------------------------------------------------------------------------
   Shared textures
   ---------------------------------------------------------------------------
   Cloth weave, paper grain and page edges are the same for every book; only the
   colour differs, and that's a material uniform. Sharing them means a rig costs
   two canvases of its own (cover and spine) instead of ten.
*/

interface Shared {
  clothNormal: THREE.CanvasTexture
  clothRoughness: THREE.CanvasTexture
  paper: THREE.CanvasTexture
  endpaper: THREE.CanvasTexture
  pageEdge: THREE.CanvasTexture
}
let shared: Shared | null = null

/** Tiles per board. Fine enough that no single thread is resolvable at reading
 *  distance, which is the point — you should read the weave, not count it. */
const WEAVE_REPEAT_X = 5
const WEAVE_REPEAT_Y = 8

function sharedTextures(): Shared {
  if (shared) return shared

  /* ---- weave: normal + roughness from one smooth height field ----

     Everything here has to be smooth, and that constraint is the whole trick.
     A normal map is built by differencing neighbouring heights, and
     differencing amplifies high frequencies — so per-pixel noise in the height
     field (which the first draft of this had, at 22%) comes back out of the
     derivative as a harsh sparkling normal that scatters every highlight.

     The base is three sinusoids: warp every ~3.8px, weft every ~4.9px, and a
     slow diagonal crossing them.

     Irregularity is then added as *slub* — two very low-frequency waves that
     modulate the threads' phase and thickness, so the cloth runs thick and thin
     in patches the way real book cloth does. Slub is smooth, so it survives
     differencing cleanly; jittering each thread individually would put a step
     at every thread boundary and land straight back in the noise problem. */
  const size = 256
  const height = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const slubX = Math.sin(x * 0.037 + 1.3) * Math.sin(y * 0.021 + 0.7)
      const slubY = Math.sin(y * 0.041 - 0.4) * Math.sin(x * 0.019 + 2.1)
      const warp = Math.sin(x * Math.PI * 0.52 + slubX * 0.9) * (1 + slubX * 0.25)
      const weft = Math.sin(y * Math.PI * 0.41 + slubY * 0.9) * (1 + slubY * 0.25)
      const cross = Math.sin((x + y) * Math.PI * 0.19)
      height[y * size + x] = 0.5 + warp * 0.18 + weft * 0.15 + cross * 0.045
    }
  }

  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')!
  const nimg = nctx.createImageData(size, size)

  const rc = document.createElement('canvas')
  rc.width = rc.height = size
  const rctx = rc.getContext('2d')!
  const rimg = rctx.createImageData(size, size)

  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4
      const dx = (at(x + 1, y) - at(x - 1, y)) * 1.5
      const dy = (at(x, y + 1) - at(x, y - 1)) * 1.5
      const len = Math.hypot(dx, dy, 1)
      nimg.data[o] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
      nimg.data[o + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
      nimg.data[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      nimg.data[o + 3] = 255

      // Roughness rides the same field: the raised warp is fractionally
      // smoother than the sunk weft, which is what makes light travel across
      // cloth instead of sitting on it.
      const r = Math.round(188 + height[y * size + x] * 56)
      rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = r
      rimg.data[o + 3] = 255
    }
  }
  nctx.putImageData(nimg, 0, 0)
  rctx.putImageData(rimg, 0, 0)

  shared = {
    clothNormal: weaveMap(nc),
    clothRoughness: weaveMap(rc),
    paper: paperTexture(false),
    endpaper: paperTexture(true),
    pageEdge: pageEdgeTexture(),
  }
  return shared
}

/** Tiled, and filtered hard. A weave viewed at a grazing angle is the worst
 *  case for anisotropic filtering, and at the default of 4 the threads alias
 *  into moiré exactly where the cloth is most visible. */
function weaveMap(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(WEAVE_REPEAT_X, WEAVE_REPEAT_Y)
  t.anisotropy = 12
  // Non-colour data: normals, roughness and bump must stay linear.
  t.colorSpace = THREE.NoColorSpace
  return t
}

/**
 * A page face. `plain` is an endpaper — laid paper with no type; otherwise the
 * grey rhythm of a set page, which at reading distance is all a page is.
 */
function paperTexture(plain: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 728
  const ctx = c.getContext('2d')!
  ctx.fillStyle = plain ? '#e6dcc4' : '#e8e1d3'
  ctx.fillRect(0, 0, c.width, c.height)

  /* A diagonal wash before anything else. Uniform paper is what reads as
     cardboard: real stock is lighter where the light falls across it and
     warmer in the shadowed corner, and that gradient is doing more work than
     any amount of fine grain. */
  const wash = ctx.createLinearGradient(0, 0, c.width, c.height)
  wash.addColorStop(0, 'rgba(255,255,255,0.22)')
  wash.addColorStop(0.42, 'rgba(255,255,255,0.035)')
  wash.addColorStop(1, 'rgba(103,87,64,0.08)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, c.width, c.height)

  /* Fibre as short strokes rather than per-pixel noise, so it survives
     mipmapping instead of dissolving to grey — and in both directions. Only
     darkening gives you dirty paper; it's the light fibres catching against
     the dark ones that make the surface look mottled rather than stained. */
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * c.width
    const y = Math.random() * c.height
    const length = 5 + Math.random() * 34
    ctx.strokeStyle = Math.random() > 0.44
      ? `rgba(255,255,255,${0.025 + Math.random() * 0.045})`
      : `rgba(92,76,55,${0.018 + Math.random() * 0.035})`
    ctx.lineWidth = 0.45 + Math.random() * 0.65
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(Math.min(c.width, x + length), y + (Math.random() - 0.5) * 2.2)
    ctx.stroke()
  }

  // Flecks: inclusions in the pulp. Sub-pixel at reading distance, but they're
  // what stops the fibre layer looking like a hatch pattern.
  for (let i = 0; i < 1200; i++) {
    const tone = Math.round(112 + Math.random() * 94)
    ctx.fillStyle = `rgba(${tone},${tone - 5},${tone - 13},${0.016 + Math.random() * 0.025})`
    const size = 0.5 + Math.random() * 1.1
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, size, size)
  }

  if (!plain) {
    const left = 74
    const right = c.width - 74
    let y = 108
    while (y < c.height - 92) {
      const paragraph = 3 + Math.floor(Math.random() * 6)
      for (let i = 0; i < paragraph && y < c.height - 92; i++) {
        // Ragged last line per paragraph, indented first — the shape of set
        // prose, which is what you actually recognise at this size.
        const last = i === paragraph - 1
        const indent = i === 0 ? 20 : 0
        const w = last ? (right - left) * (0.35 + Math.random() * 0.5) : right - left
        ctx.fillStyle = 'rgba(46,38,28,0.55)'
        ctx.fillRect(left + indent, y, w - indent, 3.4)
        y += 15
      }
      y += 7
    }
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * The cut edges: fine irregular lines standing for individual leaves, banded so
 * the stack reads as signatures rather than as a comb. Tiled across the three
 * trimmed faces of the block.
 */
function pageEdgeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 16
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e9dfc6'
  ctx.fillRect(0, 0, c.width, c.height)
  for (let x = 0; x < c.width; x += 2) {
    // Every eighth line a touch darker: the gap between signatures.
    const signature = x % 16 === 0
    ctx.fillStyle = `rgba(122,102,72,${signature ? 0.34 : 0.13 + Math.random() * 0.09})`
    ctx.fillRect(x, 0, 1, c.height)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 6)
  t.anisotropy = 4
  return t
}

/** Drop the shared cloth and paper. Only for teardown in tests/HMR. */
export function disposeSharedRigTextures() {
  if (!shared) return
  Object.values(shared).forEach(t => t.dispose())
  shared = null
}

/* ---------------------------------------------------------------------------
   Geometry
   --------------------------------------------------------------------------- */

/**
 * A flat rectangle with barely-rounded corners and its own UVs. `ShapeGeometry`
 * leaves UVs in shape space, which for a 140-wide board means coordinates
 * running 0..140, so they're rewritten to 0..1 here.
 *
 * The radius is deliberately tiny. Boards are trimmed square; rounding them
 * enough to notice is what makes a book look like a pill.
 */
function roundedPlane(width: number, height: number, radius: number): THREE.BufferGeometry {
  const hw = width / 2
  const hh = height / 2
  const r = Math.min(radius, hw, hh)
  const shape = new THREE.Shape()
  shape.moveTo(-hw + r, -hh)
  shape.lineTo(hw - r, -hh)
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r)
  shape.lineTo(hw, hh - r)
  shape.quadraticCurveTo(hw, hh, hw - r, hh)
  shape.lineTo(-hw + r, hh)
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
  shape.lineTo(-hw, -hh + r)
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh)

  const g = new THREE.ShapeGeometry(shape, 4)
  const pos = g.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + hw) / width
    uv[i * 2 + 1] = (pos.getY(i) + hh) / height
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/**
 * The page block: one solid body, pinched towards the gutter where the leaves
 * are sewn in and given a little irregularity at the fore edge, because a stack
 * of cut paper is never a clean slab.
 */
function blockGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(width, height, depth, 3, Math.min(0.8, depth / 4))
  const pos = g.getAttribute('position')
  const hw = width / 2
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const u = THREE.MathUtils.clamp((x + hw) / width, 0, 1)
    // Smoothstep over the sixth of the block nearest the spine.
    const t = THREE.MathUtils.clamp(u / 0.16, 0, 1)
    const pinch = (1 - t * t * (3 - 2 * t)) * depth * 0.1
    const foreEdge = Math.pow(u, 8) * Math.sin(pos.getY(i) * 2.1) * depth * 0.014
    pos.setZ(i, Math.sign(z || 1) * Math.max(0, Math.abs(z) - pinch + foreEdge))
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

/* ---------------------------------------------------------------------------
   The rig
   --------------------------------------------------------------------------- */

export function createBookRig(book: LocalBook): BookRig {
  const tex = sharedTextures()
  const width = BOOK_W
  const height = BOOK_H
  /** Thickness of the text block plus both boards. */
  const depth = spineWidth(book.pages)
  const hue = authorHue(book.author, book.title)

  /* Geometry budget through the thickness. The boards sit outside the cavity,
     the loose sheets take a thin layer at the top of it, and the block fills
     whatever is left — so the case is exactly `depth` thick however many
     sheets there are. */
  const cavity = depth - BOARD * 2
  const leafLayer = LEAVES * LEAF_GAP
  const blockDepth = cavity - leafLayer
  /** Top of the block, where the loose sheets rest. */
  const blockTop = cavity / 2 - leafLayer
  /** Outer face of the front board. */
  const caseFront = depth / 2

  /* Across the book: the spine panel occupies the far left, the boards hinge
     just right of it, and the block is inset by the square on its three
     trimmed sides but runs almost to the joint at the spine. */
  const hingeX = -width / 2
  const pageW = width - SQUARE - JOINT
  const pageH = height - SQUARE * 2
  /** Block centre, so that its spine edge sits at the joint and its fore edge
   *  a square's width inside the boards. */
  const blockX = hingeX + JOINT + pageW / 2

  const owned: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(t: T): T => { owned.push(t); return t }

  /* ---- materials ---- */

  /* Cloth is very nearly Lambertian. Book cloth has no specular lobe worth the
     name — what little it has is the sheen term, which models fabric
     backscatter rather than gloss. The values these started at (roughness
     0.96, sheen 0.32, a little metalness, on every one of the four) gave every
     board a broad Blinn-ish highlight that tracked the camera, which is the
     "weird sheen" that doesn't belong on a bound book. */
  /* No bumpMap here, deliberately. three's normal_fragment_maps chunk selects
     between them with `#elif defined( USE_BUMPMAP )`, so a material carrying a
     normal map ignores its bump map completely — specifying both is dead
     weight, not extra relief. All the cloth's depth comes from normalMap and
     normalScale, and its irregularity is baked into the height field as slub. */
  const clothSurface = {
    normalMap: tex.clothNormal,
    roughnessMap: tex.clothRoughness,
    roughness: 0.99,
    metalness: 0,
    sheen: 0.14,
    sheenRoughness: 0.9,
  } as const

  const clothColor = new THREE.Color(`hsl(${hue} 32% 24%)`)
  const sheenColor = new THREE.Color(`hsl(${hue} 24% 44%)`)

  const cloth = keep(new THREE.MeshPhysicalMaterial({
    ...clothSurface,
    color: clothColor.clone(),
    sheenColor: sheenColor.clone(),
    normalScale: new THREE.Vector2(0.32, 0.32),
  }))

  /** The painted board, until real art arrives and `applyCover` reworks this
   *  into a printed surface. */
  const coverMaterial = keep(new THREE.MeshPhysicalMaterial({
    ...clothSurface,
    map: keep(coverTexture(book)),
    sheenColor: sheenColor.clone(),
    normalScale: new THREE.Vector2(0.24, 0.24),
  }))

  /** Back board's outer face. Its own material rather than the shared cloth,
   *  because it takes a map derived from the cover and the cloth doesn't. */
  const backMaterial = keep(new THREE.MeshPhysicalMaterial({
    ...clothSurface,
    color: clothColor.clone(),
    sheenColor: sheenColor.clone(),
    normalScale: new THREE.Vector2(0.32, 0.32),
  }))

  const spineMaterial = keep(new THREE.MeshPhysicalMaterial({
    ...clothSurface,
    map: keep(spineTexture(book)),
    sheenColor: sheenColor.clone(),
    normalScale: new THREE.Vector2(0.28, 0.28),
  }))

  const endpaperMaterial = keep(new THREE.MeshStandardMaterial({
    map: tex.endpaper,
    color: new THREE.Color(`hsl(${hue} 26% 74%)`),
    roughness: 0.95,
    metalness: 0,
  }))

  const edgeMaterial = keep(new THREE.MeshStandardMaterial({
    map: tex.pageEdge,
    roughness: 0.9,
    metalness: 0,
  }))

  const pageMaterial = keep(new THREE.MeshStandardMaterial({
    map: tex.paper,
    roughness: 0.94,
    metalness: 0,
  }))

  /** Loose sheets only. Double-sided, and deliberately not the same material as
   *  the block's top face, which must stay single-sided. */
  const leafMaterial = keep(new THREE.MeshStandardMaterial({
    map: tex.paper,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  }))

  /** Headbands. Double-sided, because they're open half-cylinders and you see
   *  the inside of one as the book turns. */
  const trimMaterial = keep(new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${(hue + 186) % 360} 44% 46%)`),
    roughness: 0.72,
    metalness: 0.04,
    side: THREE.DoubleSide,
  }))

  /* ---- assembly ----
     x runs across the book with the spine at the far left, y up the page, z
     through the thickness with the front board at +depth/2. Boards hinge on
     groups parked on the joint, so opening one is a single rotation about y.
     Negative angles swing up and over towards -x — the way a book opens;
     positive would sweep the board through its own body. */

  const root = new THREE.Group()
  root.name = `rig-${book.id}`

  const hinge = (z: number) => {
    const g = new THREE.Group()
    g.position.set(hingeX, 0, z)
    root.add(g)
    return g
  }

  const boardGeometry = keep(new RoundedBoxGeometry(width, height, BOARD, 2, 0.5))
  const boardFace = keep(roundedPlane(width, height, 1.5))
  const pageFace = keep(roundedPlane(pageW, pageH, 0.8))

  // --- back board ---
  const backPivot = hinge(-caseFront + BOARD / 2)
  const backBoard = new THREE.Mesh(boardGeometry, cloth)
  backBoard.position.x = width / 2
  backPivot.add(backBoard)
  const backEndpaper = new THREE.Mesh(boardFace, endpaperMaterial)
  backEndpaper.position.set(width / 2, 0, BOARD / 2 + 0.08)
  backPivot.add(backEndpaper)
  const backFace = new THREE.Mesh(boardFace, backMaterial)
  backFace.position.set(width / 2, 0, -BOARD / 2 - 0.08)
  backFace.rotation.y = Math.PI
  backPivot.add(backFace)

  // --- front board: cloth body, art on the outside, endpaper on the inside ---
  const frontPivot = hinge(caseFront - BOARD / 2)
  const frontBoard = new THREE.Mesh(boardGeometry, cloth)
  frontBoard.position.x = width / 2
  frontPivot.add(frontBoard)
  const frontFace = new THREE.Mesh(boardFace, coverMaterial)
  frontFace.position.set(width / 2, 0, BOARD / 2 + 0.08)
  frontPivot.add(frontFace)
  const frontEndpaper = new THREE.Mesh(boardFace, endpaperMaterial)
  frontEndpaper.position.set(width / 2, 0, -BOARD / 2 - 0.08)
  frontEndpaper.rotation.y = Math.PI
  frontPivot.add(frontEndpaper)

  /* --- spine: a straight panel, not an arc ---

     Spans the full thickness of the case, and in x runs all the way from its
     own outer face to the boards' hinged edge — `JOINT + BOARD` wide, not
     `BOARD`. The earlier version stood the panel off by the joint and left that
     channel empty, which is not a groove but a hole: you could see straight
     through the side of the case into its hollow, front to back. On a real
     book the joint is a channel the *cloth sinks into*, and the cloth is one
     continuous piece from board to spine to board. The shoulder now comes from
     the darkening at each end of the spine map rather than from missing
     geometry. */
  const spineW = JOINT + BOARD
  const spineGeo = keep(new RoundedBoxGeometry(spineW, height, depth, 2, 0.5))
  const spine = new THREE.Mesh(spineGeo, spineMaterial)
  spine.position.set(hingeX - spineW / 2, 0, 0)
  root.add(spine)

  // --- page block ---
  const block = new THREE.Group()
  block.position.set(blockX, 0, -leafLayer / 2)
  root.add(block)
  const blockGeo = keep(blockGeometry(pageW, pageH, blockDepth))
  block.add(new THREE.Mesh(blockGeo, edgeMaterial))
  // The exposed top of the block is a page, not a cut edge.
  const blockFace = new THREE.Mesh(pageFace, pageMaterial)
  blockFace.position.z = blockDepth / 2 + 0.06
  block.add(blockFace)

  /* --- headbands ---
     The little woven caps at head and tail of the spine. A detail, but their
     absence is exactly what makes a rendered hardcover look hollow at the top. */
  const headbandGeo = keep(new THREE.CylinderGeometry(1.1, 1.1, cavity * 0.92, 8, 1, false, 0, Math.PI))
  for (const sign of [1, -1]) {
    const headband = new THREE.Mesh(headbandGeo, trimMaterial)
    headband.rotation.x = Math.PI / 2
    headband.rotation.z = sign > 0 ? 0 : Math.PI
    headband.position.set(hingeX + JOINT * 0.4, sign * (pageH / 2 + 0.4), 0)
    root.add(headband)
  }

  /* --- the loose sheets ---
     Stacked on top of the block, front-most first, so leaves[0] is the next one
     you turn. Each is hinged at the joint like the boards. */
  const leaves: Leaf[] = []
  const pageTargets: THREE.Mesh[] = [blockFace]
  for (let i = 0; i < LEAVES; i++) {
    const restZ = blockTop + LEAF_GAP * (LEAVES - i) - LEAF_GAP / 2
    const pivot = hinge(restZ)
    pivot.name = `${book.id}-leaf-${i}`

    const g = keep(new THREE.PlaneGeometry(pageW, pageH, LEAF_SEG_X, LEAF_SEG_Y))
    const mesh = new THREE.Mesh(g, leafMaterial)
    // Hinged at the joint, so the sheet sits its own half-width to the right.
    mesh.position.set(JOINT + pageW / 2, 0, 0)
    pivot.add(mesh)
    pageTargets.push(mesh)

    const position = g.getAttribute('position') as THREE.BufferAttribute
    leaves.push({
      pivot,
      surface: { geometry: g, position, base: Float32Array.from(position.array), width: pageW },
      flex: { curve: 0, twist: 0, curveVelocity: 0, twistVelocity: 0 },
      restZ,
      // Clear of the opened board, ascending so the first sheet turned ends up
      // at the bottom of the pile.
      turnedZ: caseFront + 0.7 + i * LEAF_GAP,
    })
  }

  root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true }
  })

  /* ---- dressing the case in the real cover ---- */

  /**
   * The strip of the cover the spine and back continue from. Book art is
   * almost never designed as a wraparound, so mirroring the whole picture round
   * the spine looks wrong; the left edge is nearly always background, and
   * stretching that reads as the same cloth carrying on round the case.
   */
  const WRAP_STRIP = 0.12

  function applyCover(texture: THREE.Texture): boolean {
    const img = texture.image as CanvasImageSource & { width: number; height: number }
    if (!img?.width) return false

    /* The art is printed and laminated, not woven. Dropping the weave and the
       sheen is most of the fix for a cover that looks washed out: a normal map
       across a photograph scatters its highlights, and sheen lays a flat white
       bloom over the whole board. A little clearcoat puts the gloss back. */
    /* Printed and laminated, but printed *onto a cloth board* — so the weave
       stays. Cutting normalScale to near zero and nulling the roughness map
       here is what made the cloth disappear from the whole visible case, and it
       was solving the wrong problem: a roughness map changes where light
       scatters, never the albedo, so it cannot wash out artwork. The flatness
       was the tone curve, the sheen and the clearcoat, all dealt with
       separately.

       So the weave is only eased back from its bare-cloth strength, enough that
       it reads as a textured board under the picture rather than as fabric laid
       over it. Roughness stays high and clearcoat is nearly off: a matte board
       is the common case, and a tight clearcoat lobe against the environment
       probe is what reads as wet plastic sliding over the cover as you orbit. */
    coverMaterial.normalScale.set(0.22, 0.22)
    coverMaterial.roughness = 0.72
    coverMaterial.clearcoat = 0.03
    coverMaterial.clearcoatRoughness = 0.6
    coverMaterial.sheen = 0
    // The map is set below, from the corrected canvas — or from `texture`
    // directly if the image can't be sampled.
    coverMaterial.map = texture
    coverMaterial.needsUpdate = true

    // Sampling needs pixel access, which a tainted canvas refuses. The art
    // still goes on the board; only the derived case is skipped.
    let edge: { r: number; g: number; b: number }
    /** 2nd and 98th percentile luminance, 0..1. Left unset: the catch below
     *  returns, so nothing reads these without the try having assigned them. */
    let lo: number
    let hi: number
    try {
      const sw = 32
      const sh = 48
      const s = document.createElement('canvas')
      s.width = sw
      s.height = sh
      const sctx = s.getContext('2d', { willReadFrequently: true })!
      sctx.drawImage(img, 0, 0, sw, sh)
      const data = sctx.getImageData(0, 0, sw, sh).data
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      // Leftmost columns only — the strip the spine continues from.
      const cols = Math.max(1, Math.round(sw * WRAP_STRIP))
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < cols; x++) {
          const o = (y * sw + x) * 4
          r += data[o]; g += data[o + 1]; b += data[o + 2]; n++
        }
      }
      edge = { r: r / n, g: g / n, b: b / n }

      /* How much range the art actually uses. Cover scans vary wildly in
         quality — a heavily recompressed thumbnail arrives with its blacks
         lifted and its whites pulled down, which is what "washed out" is, and
         no lighting change can put back range the file doesn't contain. So
         measure it: percentiles rather than min/max, or one stray pure-black
         pixel would report full range on a completely flat image. */
      const luma: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        luma.push((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255)
      }
      luma.sort((a, b2) => a - b2)
      lo = luma[Math.floor(luma.length * 0.02)]
      hi = luma[Math.floor(luma.length * 0.98)]
    } catch {
      return false
    }

    const strip = Math.max(1, Math.floor(img.width * WRAP_STRIP))
    const edgeColor = new THREE.Color(edge.r / 255, edge.g / 255, edge.b / 255)

    /* --- auto-levels ---
       Only when the art is genuinely flat, and capped, so a good scan is left
       alone and a bad one is lifted without turning into a poster. Gain is
       whatever it takes to reach a target range, clamped hard: past ~1.4 the
       JPEG blocking in a low-quality cover starts being amplified along with
       the contrast, which trades one ugly for a worse one. */
    const range = Math.max(0.01, hi - lo)
    const TARGET = 0.82
    const gain = THREE.MathUtils.clamp(TARGET / range, 1, 1.4)
    if (gain > 1.02) {
      const cc = document.createElement('canvas')
      cc.width = img.width
      cc.height = img.height
      const cctx = cc.getContext('2d')!
      // Saturation lifted by a third of the contrast gain: recompression flattens
      // colour as well as tone, but matching the two over-cooks the result.
      cctx.filter = `contrast(${gain.toFixed(3)}) saturate(${(1 + (gain - 1) / 3).toFixed(3)})`
      cctx.drawImage(img, 0, 0)
      const corrected = keep(new THREE.CanvasTexture(cc))
      corrected.colorSpace = THREE.SRGBColorSpace
      corrected.anisotropy = texture.anisotropy
      coverMaterial.map = corrected
      coverMaterial.needsUpdate = true
    }

    // Board edges and the exposed cloth take the cover's own edge colour, so
    // the case reads as one object rather than art stuck to a coloured slab.
    cloth.color.copy(edgeColor)

    /* --- spine: the left strip stretched, darkened at the joints, title on top --- */
    const sc = document.createElement('canvas')
    sc.width = 96
    sc.height = 480
    const sctx = sc.getContext('2d')!
    sctx.drawImage(img, 0, 0, strip, img.height, 0, 0, sc.width, sc.height)
    // A spine is lit from its middle and falls away into both joints. Without
    // this it looks like a flat ribbon taped to the side.
    const round = sctx.createLinearGradient(0, 0, sc.width, 0)
    round.addColorStop(0, 'rgba(0,0,0,0.34)')
    round.addColorStop(0.45, 'rgba(255,255,255,0.06)')
    round.addColorStop(1, 'rgba(0,0,0,0.34)')
    sctx.fillStyle = round
    sctx.fillRect(0, 0, sc.width, sc.height)

    // Type runs bottom-to-top, as spines are printed nearly everywhere outside
    // the US. Colour is picked off the strip's own luminance so it stays legible
    // on a light cover and on a dark one.
    const luma = (edge.r * 0.299 + edge.g * 0.587 + edge.b * 0.114) / 255
    sctx.save()
    sctx.translate(sc.width / 2, sc.height / 2)
    sctx.rotate(-Math.PI / 2)
    sctx.textAlign = 'center'
    sctx.textBaseline = 'middle'
    sctx.fillStyle = luma > 0.55 ? 'rgba(22,18,14,0.88)' : 'rgba(255,250,240,0.92)'
    sctx.font = '700 34px Nunito, system-ui, sans-serif'
    let title = book.title
    while (title.length > 4 && sctx.measureText(title).width > sc.height - 90) {
      title = title.slice(0, -1)
    }
    sctx.fillText(title === book.title ? title : `${title}…`, 0, 0)
    sctx.restore()

    const spineTex = keep(new THREE.CanvasTexture(sc))
    spineTex.colorSpace = THREE.SRGBColorSpace
    spineTex.anisotropy = 4
    spineMaterial.map = spineTex
    spineMaterial.normalScale.set(0.22, 0.22)
    spineMaterial.roughness = 0.72
    spineMaterial.sheen = 0
    spineMaterial.needsUpdate = true

    /* --- back board: the same strip carried across the whole panel --- */
    const bc = document.createElement('canvas')
    bc.width = 256
    bc.height = 366
    const bctx = bc.getContext('2d')!
    bctx.drawImage(img, 0, 0, strip, img.height, 0, 0, bc.width, bc.height)
    // Backs sit in shadow against the front's lit face.
    bctx.fillStyle = 'rgba(0,0,0,0.16)'
    bctx.fillRect(0, 0, bc.width, bc.height)

    const backTex = keep(new THREE.CanvasTexture(bc))
    backTex.colorSpace = THREE.SRGBColorSpace
    backTex.anisotropy = 4
    backMaterial.map = backTex
    backMaterial.color.set(0xffffff)
    backMaterial.normalScale.set(0.22, 0.22)
    backMaterial.roughness = 0.72
    backMaterial.sheen = 0
    backMaterial.needsUpdate = true

    return true
  }

  return {
    root,
    frontPivot,
    backPivot,
    block,
    leaves,
    pageTargets,
    applyCover,
    width,
    height,
    depth,
    dispose() {
      owned.forEach(o => o.dispose())
      owned.length = 0
    },
  }
}

/* ---------------------------------------------------------------------------
   Page curvature
   --------------------------------------------------------------------------- */

/**
 * Bends one sheet towards `targetCurve` (0 flat, ~0.19 fully arched) with
 * `targetTwist` of diagonal float, then rewrites its vertices.
 *
 * A turning page is not a rotating rectangle. It arches along its free length,
 * lifts hardest at the outer corner, and settles with a wobble — so the shape
 * is a sine arch weighted towards the free edge, and the amount of it is driven
 * by an underdamped spring rather than an ease, which is what makes a released
 * page overshoot slightly and come to rest like paper.
 *
 * `delta` is frame time in seconds, clamped because a backgrounded tab hands
 * back one large enough to make the spring explode.
 */
export function updateLeafFlex(
  leaf: Leaf,
  targetCurve: number,
  targetTwist: number,
  delta: number,
  immediate = false,
) {
  const flex = leaf.flex
  const step = Math.min(delta, 0.033)
  let curve = targetCurve
  let twist = targetTwist

  if (immediate) {
    flex.curveVelocity = 0
    flex.twistVelocity = 0
  } else {
    const ca = (targetCurve - flex.curve) * 178 - flex.curveVelocity * 19
    const ta = (targetTwist - flex.twist) * 210 - flex.twistVelocity * 21
    flex.curveVelocity = THREE.MathUtils.clamp(flex.curveVelocity + ca * step, -1.8, 1.8)
    flex.twistVelocity = THREE.MathUtils.clamp(flex.twistVelocity + ta * step, -1.6, 1.6)
    curve = THREE.MathUtils.clamp(flex.curve + flex.curveVelocity * step, -0.025, 0.19)
    twist = THREE.MathUtils.clamp(flex.twist + flex.twistVelocity * step, -0.12, 0.12)

    // Park the spring once it is close enough to matter, so an idle book stops
    // rewriting vertex buffers every frame.
    if (Math.abs(targetCurve - curve) < 2e-5 && Math.abs(flex.curveVelocity) < 8e-4) {
      curve = targetCurve
      flex.curveVelocity = 0
    }
    if (Math.abs(targetTwist - twist) < 2e-5 && Math.abs(flex.twistVelocity) < 8e-4) {
      twist = targetTwist
      flex.twistVelocity = 0
    }
    if (Math.abs(curve - flex.curve) < 1e-5 && Math.abs(twist - flex.twist) < 1e-5) return
  }

  flex.curve = curve
  flex.twist = twist

  // Amplitudes are fractions of the page width, so the arch keeps its shape
  // whatever size the book is.
  const { position, base, width, geometry } = leaf.surface
  for (let v = 0; v < position.count; v++) {
    const o = v * 3
    const x = base[o]
    const y = base[o + 1]
    // 0 at the bound edge, 1 at the free edge.
    const u = THREE.MathUtils.clamp(x / width + 0.5, 0, 1)
    const arch = Math.sin(Math.PI * u)
    const freeEdgeLift = u * u * 0.16
    const shape = arch * 0.84 + freeEdgeLift
    const ny = y / width
    const diagonal = twist * ny * Math.pow(u, 1.35)
    const ripple = twist * Math.sin(u * Math.PI * 2) * (1 - Math.min(1, Math.abs(ny) * 1.65)) * 0.09
    position.setXYZ(v, x, y, (curve * shape * (1 + ny * 0.14) + diagonal + ripple) * width)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
}
