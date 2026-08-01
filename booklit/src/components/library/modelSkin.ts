import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { LocalBook } from '../../context/BookContext'
import { authorHue } from '../../lib/bookMeta'

/**
 * Skinning for the GLB book models, after `cards/library_001.html`
 * (`analyzeHCIslands`, `generateHCAtlas`, `cloneGltf`, `applyToMesh`).
 *
 * The models carry one texture atlas covering the whole book, so putting a cover
 * on one means finding *where* in that atlas the front board lives. The geometry
 * is walked once per model, triangles are bucketed by which way their normal
 * points, and the largest UV island facing each way is taken as that face.
 *
 * library_001 stopped at a pixel rectangle per face and painted the cover into
 * it axis-aligned. That is not enough: an unwrap is free to store a face rotated
 * or mirrored, and this set stores the boards rotated a quarter turn, with the
 * back board mirrored relative to the front. So instead of a rectangle each face
 * carries the affine map from its own upright pixel box onto its island, fitted
 * from the island's own geometry. Callers paint an upright board and the
 * transform puts it where the model expects it.
 *
 * library_001 also read the atlas row for a UV as `(1 - vmax)`. That is the
 * flipY=true convention; glTF UVs have their origin top-left and the texture is
 * uploaded with `flipY = false`, so row and v run the same way and it is plain
 * `vmin`. Verified against the models' own baked BaseColor textures: under
 * `vmin` the +Z island lands exactly on the printed front cover, under
 * `(1 - vmax)` it lands on the endpapers.
 *
 * library_001 used a 2048² atlas for a dozen books. Booklit pages hundreds, and
 * a 2048² RGBA texture is ~16 MB of GPU memory *per book*, so this halves the
 * side to 1024² (~4 MB) and the scene caps how many it builds.
 */

export const ATLAS_SIZE = 1024

/** A canvas transform, in `ctx.transform(a, b, c, d, e, f)` order. */
export type Matrix2D = [number, number, number, number, number, number]

export interface Face {
  /** Upright box to paint into — x runs right and y runs down, as seen by
      someone standing outside the model looking at this face. */
  w: number
  h: number
  /** Takes that box onto the face's island in the atlas. */
  m: Matrix2D
  /** The island's atlas bounds. Only used to clip the paint. */
  clip: { x: number; y: number; w: number; h: number }
}

export interface ModelSkin {
  /** Rotation that stands the model up: +Y its height, +Z its front board. */
  upright: THREE.Matrix4
  front: Face | null
  back: Face | null
  spine: Face | null
}

/** Deep-clone a loaded GLTF, giving every instance its own materials. */
export function cloneGltf(gltf: GLTF): THREE.Object3D {
  const root = gltf.scene.clone(true)
  const seen = new Map<string, THREE.Material>()
  root.traverse(n => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh) return
    const wasArray = Array.isArray(mesh.material)
    const mats = wasArray ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material]
    const cloned = mats.map(m => {
      if (!seen.has(m.uuid)) seen.set(m.uuid, m.clone())
      return seen.get(m.uuid)!
    })
    mesh.material = wasArray ? cloned : cloned[0]
  })
  return root
}

/** Point every material at our atlas. */
export function applyToMesh(root: THREE.Object3D, tex: THREE.Texture) {
  root.traverse(n => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats as THREE.MeshStandardMaterial[]) {
      m.map = tex
      m.color?.set(0xffffff)
      m.needsUpdate = true
    }
  })
}

/**
 * A rotation that stands the model up: widest axis to Y (height), middle to X
 * (width), thinnest to Z (facing the camera).
 *
 * Derived from the model's own bounding box rather than hardcoded, so it holds
 * for any book-shaped GLB dropped into the folder. For this set it comes out as
 * the identity — the exporter already wrote the node rotation that stands them
 * up — but it is what lets the face directions below be stated in one frame.
 */
function uprightMatrix(obj: THREE.Object3D): THREE.Matrix4 {
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const axes: [number, THREE.Vector3][] = [
    [size.x, new THREE.Vector3(1, 0, 0)],
    [size.y, new THREE.Vector3(0, 1, 0)],
    [size.z, new THREE.Vector3(0, 0, 1)],
  ]
  axes.sort((a, b) => a[0] - b[0])
  const thin = axes[0][1], mid = axes[1][1], long = axes[2][1]

  // Columns (mid, long, thin) map X→mid, Y→long, Z→thin; the transpose is the
  // rotation that takes the model into that frame. Flip if it came out mirrored.
  const basis = new THREE.Matrix4().makeBasis(mid, long, thin)
  if (basis.determinant() < 0) {
    basis.makeBasis(mid, long, thin.clone().negate())
  }
  return basis.transpose()
}

/* ── island analysis ────────────────────────────────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0)
const DIRS: [string, THREE.Vector3][] = [
  ['X+', new THREE.Vector3(1, 0, 0)], ['X-', new THREE.Vector3(-1, 0, 0)],
  ['Y+', new THREE.Vector3(0, 1, 0)], ['Y-', new THREE.Vector3(0, -1, 0)],
  ['Z+', new THREE.Vector3(0, 0, 1)], ['Z-', new THREE.Vector3(0, 0, -1)],
]

/** Right and down for a face, as seen from outside it. */
function faceBasis(n: THREE.Vector3) {
  let right = new THREE.Vector3().crossVectors(UP, n)
  // Degenerate for the head and tail of the book, which we never skin; fall
  // back to something consistent so the maths below stays finite.
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0)
  return { right: right.normalize(), down: UP.clone().negate() }
}

interface Island {
  dir: string
  area: number
  umin: number; umax: number; vmin: number; vmax: number
  rmin: number; rmax: number; dmin: number; dmax: number
  /** The island's largest triangle, which is the one to fit the map from — it
      sits in the flat middle of the face rather than on a rounded edge. */
  best: { area: number; r: number[]; d: number[]; u: number[]; v: number[] } | null
}

/**
 * Fit `(x, y) → (u·size, v·size)` from three corresponding points, then rescale
 * the input side so it takes a `w × h` pixel box instead of the unit square.
 */
function fitFace(isl: Island, size: number): Face | null {
  const t = isl.best
  if (!t) return null

  const pw = isl.rmax - isl.rmin
  const ph = isl.dmax - isl.dmin
  if (pw <= 0 || ph <= 0) return null

  // Normalised face coordinates, 0–1 across and 0–1 down.
  const s = [0, 1, 2].map(i => (t.r[i] - isl.rmin) / pw)
  const q = [0, 1, 2].map(i => (t.d[i] - isl.dmin) / ph)
  const x = t.u.map(u => u * size)
  const y = t.v.map(v => v * size)

  const ds1 = s[1] - s[0], dq1 = q[1] - q[0]
  const ds2 = s[2] - s[0], dq2 = q[2] - q[0]
  const det = ds1 * dq2 - ds2 * dq1
  if (Math.abs(det) < 1e-9) return null

  const dx1 = x[1] - x[0], dx2 = x[2] - x[0]
  const dy1 = y[1] - y[0], dy2 = y[2] - y[0]
  const a = (dx1 * dq2 - dx2 * dq1) / det
  const c = (ds1 * dx2 - ds2 * dx1) / det
  const b = (dy1 * dq2 - dy2 * dq1) / det
  const d = (ds1 * dy2 - ds2 * dy1) / det
  const e = x[0] - a * s[0] - c * q[0]
  const f = y[0] - b * s[0] - d * q[0]

  // Give the caller a pixel box at roughly the island's own resolution, so text
  // can be sized in pixels and the cover isn't resampled twice over.
  const px = (isl.umax - isl.umin) * size
  const py = (isl.vmax - isl.vmin) * size
  const k = Math.sqrt((px * py) / (pw * ph))
  const w = Math.max(4, Math.round(pw * k))
  const h = Math.max(4, Math.round(ph * k))

  return {
    w, h,
    m: [a / w, b / w, c / h, d / h, e, f],
    clip: {
      x: Math.floor(isl.umin * size),
      y: Math.floor(isl.vmin * size),
      w: Math.ceil((isl.umax - isl.umin) * size),
      h: Math.ceil((isl.vmax - isl.vmin) * size),
    },
  }
}

/**
 * Walk a model once and work out where its front board, back board and spine
 * live in its atlas, and which way round they are stored.
 */
export function prepareModel(gltf: GLTF, size = ATLAS_SIZE): ModelSkin | null {
  gltf.scene.updateMatrixWorld(true)
  const upright = uprightMatrix(gltf.scene)

  let found: THREE.Mesh | null = null
  let maxTris = 0
  gltf.scene.traverse(n => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh) return
    const g = mesh.geometry
    const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3
    if (tris > maxTris) { maxTris = tris; found = mesh }
  })
  const mesh = found as THREE.Mesh | null
  if (!mesh) return null

  const g = mesh.geometry
  const pos = g.attributes.position
  const nrm = g.attributes.normal
  const uv = g.attributes.uv
  if (!pos || !nrm || !uv) return null

  // Everything below is stated in the upright frame, so "the front board faces
  // +Z" means the same thing whatever the exporter's own axis convention was.
  const toWorld = new THREE.Matrix4().multiplyMatrices(upright, mesh.matrixWorld)
  const toNormal = new THREE.Matrix3().getNormalMatrix(toWorld)

  const idx = g.index
  const triCount = idx ? idx.count / 3 : pos.count / 3
  const islands: Record<string, Island> = {}

  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const face = new THREE.Vector3()

  for (let t = 0; t < triCount; t++) {
    const ii = [0, 1, 2].map(k => (idx ? idx.getX(t * 3 + k) : t * 3 + k))

    face.set(0, 0, 0)
    for (const i of ii) {
      n.fromBufferAttribute(nrm, i).applyMatrix3(toNormal)
      face.add(n)
    }
    if (face.lengthSq() < 1e-12) continue
    face.normalize()
    const [dir, axis] = DIRS.reduce((a, b) => (face.dot(a[1]) > face.dot(b[1]) ? a : b))
    const { right, down } = faceBasis(axis)

    const r: number[] = [], d: number[] = [], u: number[] = [], v: number[] = []
    for (const i of ii) {
      p.fromBufferAttribute(pos, i).applyMatrix4(toWorld)
      r.push(p.dot(right))
      d.push(p.dot(down))
      u.push(uv.getX(i))
      v.push(uv.getY(i))
    }
    const area = Math.abs((u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0])) / 2

    // Bucket on a coarse UV cell so two islands facing the same way (front
    // board and back board) don't merge into one giant rectangle.
    const key = `${dir}_${Math.round(Math.min(...u) / 0.1)}_${Math.round(Math.min(...v) / 0.1)}`
    const isl = islands[key] ??= {
      dir, area: 0,
      umin: 1, umax: 0, vmin: 1, vmax: 0,
      rmin: Infinity, rmax: -Infinity, dmin: Infinity, dmax: -Infinity,
      best: null,
    }
    isl.area += area
    isl.umin = Math.min(isl.umin, ...u); isl.umax = Math.max(isl.umax, ...u)
    isl.vmin = Math.min(isl.vmin, ...v); isl.vmax = Math.max(isl.vmax, ...v)
    isl.rmin = Math.min(isl.rmin, ...r); isl.rmax = Math.max(isl.rmax, ...r)
    isl.dmin = Math.min(isl.dmin, ...d); isl.dmax = Math.max(isl.dmax, ...d)
    if (!isl.best || area > isl.best.area) isl.best = { area, r, d, u, v }
  }

  const biggest = (dir: string): Face | null => {
    const cands = Object.values(islands).filter(i => i.dir === dir)
    if (!cands.length) return null
    return fitFace(cands.reduce((a, c) => (a.area > c.area ? a : c)), size)
  }

  /* The spine is on −X: with the book upright and its front board toward you,
     the binding is on your left. Nothing in the geometry distinguishes a spine
     from a fore-edge, so this is a convention — checked against the baked
     BaseColor atlas of each of hardcover_01/02/03, where the −X island is the
     one carrying the printed title. */
  return {
    upright,
    front: biggest('Z+'),
    back: biggest('Z-'),
    spine: biggest('X-') ?? biggest('X+'),
  }
}

/* ── atlas painting ─────────────────────────────────────────────────────── */

function wrapText(
  ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number,
  maxW: number, lineH: number, maxLines = 5,
) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else {
      line = test
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  const startY = cy - (lines.length - 1) * lineH / 2
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineH))
}

/** object-fit: cover, for a canvas. */
function drawImageCover(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number,
) {
  const ia = img.width / img.height
  const ba = w / h
  let sx: number, sy: number, sw: number, sh: number
  if (ia > ba) { sh = img.height; sw = sh * ba; sx = (img.width - sw) / 2; sy = 0 }
  else { sw = img.width; sh = sw / ba; sx = 0; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
}

/** Typographic board, for the books with no cover art. */
function drawTypoBoard(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  title: string, author: string, hue: number,
) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, `hsl(${hue} 45% 26%)`)
  g.addColorStop(1, `hsl(${hue} 48% 14%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(255,220,150,0.25)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(w * 0.05, h * 0.045, w * 0.9, h * 0.91)
  ctx.strokeRect(w * 0.07, h * 0.062, w * 0.86, h * 0.876)

  const fs = Math.max(9, Math.round(h * 0.082))
  ctx.font = `bold ${fs}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,242,205,0.95)'
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 6
  wrapText(ctx, title, w / 2, h * 0.44, w * 0.78, fs * 1.3)
  ctx.shadowColor = 'transparent'

  if (author) {
    ctx.strokeStyle = 'rgba(255,220,150,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w * 0.22, h * 0.62)
    ctx.lineTo(w * 0.78, h * 0.62)
    ctx.stroke()
    ctx.font = `${Math.max(7, Math.round(h * 0.05))}px Georgia, serif`
    ctx.fillStyle = 'rgba(255,228,165,0.7)'
    wrapText(ctx, author, w / 2, h * 0.73, w * 0.8, h * 0.07, 1)
  }
}

/** Spine: head and tail bands, and the title reading up the binding. */
function drawSpine(
  ctx: CanvasRenderingContext2D, w: number, h: number, title: string, hue: number,
) {
  ctx.fillStyle = `hsl(${hue} 45% 22%)`
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,240,200,0.16)'
  ctx.fillRect(0, h * 0.05, w, Math.max(1, h * 0.008))
  ctx.fillRect(0, h * 0.94, w, Math.max(1, h * 0.008))

  ctx.translate(w / 2, h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `bold ${Math.max(7, Math.round(w * 0.42))}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,242,205,0.9)'
  wrapText(ctx, title, 0, 0, h * 0.86, w, 1)
}

/**
 * Paint one book's atlas: base cloth everywhere, the cover art (or a
 * typographic board) on both boards, and the title down the spine.
 *
 * Both boards get the same art, as in library_001 — the analysis can tell which
 * islands are the two boards but not which one the exporter meant as the front,
 * so painting both means whichever faces you is right. Each is painted through
 * its own transform, so the back reads the right way round rather than mirrored.
 */
export function buildAtlas(
  book: LocalBook, skin: ModelSkin, coverImg: HTMLImageElement | null,
  size = ATLAS_SIZE,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const hue = authorHue(book.author, book.title)

  // Cloth everywhere first — this is what shows on the edges and endpapers.
  ctx.fillStyle = `hsl(${hue} 42% 19%)`
  ctx.fillRect(0, 0, size, size)

  const into = (face: Face | null, draw: (w: number, h: number) => void) => {
    if (!face) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(face.clip.x, face.clip.y, face.clip.w, face.clip.h)
    ctx.clip()
    ctx.transform(...face.m)
    draw(face.w, face.h)
    ctx.restore()
  }

  const board = (w: number, h: number) => {
    if (!coverImg) {
      drawTypoBoard(ctx, w, h, book.title, book.author ?? '', hue)
      return
    }
    drawImageCover(ctx, coverImg, w, h)
    // Slight darkening at head and tail, so a flat scan reads as a board.
    const vg = ctx.createLinearGradient(0, 0, 0, h)
    vg.addColorStop(0, 'rgba(0,0,0,0.07)')
    vg.addColorStop(0.12, 'rgba(0,0,0,0)')
    vg.addColorStop(0.88, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.10)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)
  }

  into(skin.front, board)
  into(skin.back, board)
  into(skin.spine, (w, h) => drawSpine(ctx, w, h, book.title, hue))

  const t = new THREE.CanvasTexture(c)
  // The GLB's own UVs assume glTF orientation, so the atlas must not be flipped.
  t.flipY = false
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
