import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { LocalBook } from '../../context/BookContext'
import { authorHue } from '../../lib/bookMeta'

/**
 * Skinning for the GLB book models, ported from `cards/library_001.html`
 * (`analyzeHCIslands`, `generateHCAtlas`, `cloneGltf`, `applyToMesh`).
 *
 * The models carry one texture atlas covering the whole book. To put a cover on
 * one, you have to find *where* in that atlas the front board lives — so the
 * geometry is walked once per model, triangles are bucketed by which axis their
 * normal points along, and the largest UV island facing each way is taken as
 * that face. The result is a set of pixel rectangles to draw into.
 *
 * library_001 used a 2048² atlas for a dozen books. Booklit pages hundreds, and
 * a 2048² RGBA texture is ~16 MB of GPU memory *per book*, so this halves the
 * side to 1024² (~4 MB) and the scene caps how many it builds.
 */

export const ATLAS_SIZE = 1024

export interface Islands {
  face1: Rect | null
  face2: Rect | null
  spine: Rect | null
}
interface Rect { x: number; y: number; w: number; h: number }

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
 * Bucket triangles by dominant normal direction and return the biggest UV island
 * facing each way, in atlas pixels. Covers face ±Y in these models and the spine
 * faces +Z; that's a property of how they were unwrapped, not an assumption
 * about book geometry.
 */
export function analyzeIslands(gltf: GLTF, size = ATLAS_SIZE): Islands | null {
  let geo: THREE.BufferGeometry | null = null
  let maxTris = 0
  gltf.scene.traverse(n => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh) return
    const g = mesh.geometry
    const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3
    if (tris > maxTris) { maxTris = tris; geo = g }
  })
  const g = geo as THREE.BufferGeometry | null
  if (!g || !g.attributes.uv || !g.attributes.normal) return null

  const nrm = g.attributes.normal
  const uv = g.attributes.uv
  const idx = g.index
  const triCount = idx ? idx.count / 3 : nrm.count / 3

  interface Group { dir: string; area: number; umin: number; umax: number; vmin: number; vmax: number }
  const groups: Record<string, Group> = {}

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    const nx = (nrm.getX(i0) + nrm.getX(i1) + nrm.getX(i2)) / 3
    const ny = (nrm.getY(i0) + nrm.getY(i1) + nrm.getY(i2)) / 3
    const nz = (nrm.getZ(i0) + nrm.getZ(i1) + nrm.getZ(i2)) / 3
    const dirs: [string, number][] =
      [['X+', nx], ['X-', -nx], ['Y+', ny], ['Y-', -ny], ['Z+', nz], ['Z-', -nz]]
    const dir = dirs.reduce((a, b) => (a[1] > b[1] ? a : b))[0]

    const u0 = uv.getX(i0), v0 = uv.getY(i0)
    const u1 = uv.getX(i1), v1 = uv.getY(i1)
    const u2 = uv.getX(i2), v2 = uv.getY(i2)
    const area = Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2

    // Bucket on a coarse UV cell so separate islands facing the same way
    // (front board vs back board) don't merge into one giant rectangle.
    const key = `${dir}_${Math.round(Math.min(u0, u1, u2) / 0.1)}_${Math.round(Math.min(v0, v1, v2) / 0.1)}`
    const grp = groups[key] ??= { dir, area: 0, umin: 1, umax: 0, vmin: 1, vmax: 0 }
    grp.area += area
    grp.umin = Math.min(grp.umin, u0, u1, u2)
    grp.umax = Math.max(grp.umax, u0, u1, u2)
    grp.vmin = Math.min(grp.vmin, v0, v1, v2)
    grp.vmax = Math.max(grp.vmax, v0, v1, v2)
  }

  const best = (dir: string): Rect | null => {
    const cands = Object.values(groups).filter(x => x.dir === dir)
    if (!cands.length) return null
    const b = cands.reduce((a, c) => (a.area > c.area ? a : c))
    // Canvas y runs the other way from UV v.
    return {
      x: Math.round(b.umin * size),
      y: Math.round((1 - b.vmax) * size),
      w: Math.round((b.umax - b.umin) * size),
      h: Math.round((b.vmax - b.vmin) * size),
    }
  }

  return { face1: best('Y+'), face2: best('Y-'), spine: best('Z+') }
}

/**
 * A rotation that stands the model up: widest axis to Y (height), middle to X
 * (width), thinnest to Z (facing the camera).
 *
 * Derived from the mesh's own bounding box rather than hardcoded per model, so
 * it holds for any book-shaped GLB dropped into the folder — and it can't drift
 * out of sync with the exporter's axis convention.
 */
export function uprightMatrix(obj: THREE.Object3D): THREE.Matrix4 {
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
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const ia = img.width / img.height
  const ba = w / h
  let sx: number, sy: number, sw: number, sh: number
  if (ia > ba) { sh = img.height; sw = sh * ba; sx = (img.width - sw) / 2; sy = 0 }
  else { sw = img.width; sh = sw / ba; sx = 0; sy = (img.height - sh) / 2 }
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

/** Typographic board, for the books with no cover art. */
function drawTypoBoard(
  ctx: CanvasRenderingContext2D, r: Rect, title: string, author: string, hue: number,
) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h)
  g.addColorStop(0, `hsl(${hue} 45% 26%)`)
  g.addColorStop(1, `hsl(${hue} 48% 14%)`)
  ctx.fillStyle = g
  ctx.fillRect(r.x, r.y, r.w, r.h)

  ctx.strokeStyle = 'rgba(255,220,150,0.25)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(r.x + r.w * 0.05, r.y + r.h * 0.045, r.w * 0.9, r.h * 0.91)
  ctx.strokeRect(r.x + r.w * 0.07, r.y + r.h * 0.062, r.w * 0.86, r.h * 0.876)

  const fs = Math.max(9, Math.round(r.h * 0.1))
  ctx.font = `bold ${fs}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,242,205,0.95)'
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 6
  wrapText(ctx, title, r.x + r.w / 2, r.y + r.h * 0.44, r.w * 0.78, fs * 1.3)
  ctx.shadowColor = 'transparent'

  if (author) {
    ctx.strokeStyle = 'rgba(255,220,150,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(r.x + r.w * 0.22, r.y + r.h * 0.62)
    ctx.lineTo(r.x + r.w * 0.78, r.y + r.h * 0.62)
    ctx.stroke()
    ctx.font = `${Math.max(7, Math.round(r.h * 0.055))}px Georgia, serif`
    ctx.fillStyle = 'rgba(255,228,165,0.7)'
    wrapText(ctx, author, r.x + r.w / 2, r.y + r.h * 0.73, r.w * 0.8, r.h * 0.07, 1)
  }
}

/**
 * Paint one book's atlas: base cloth everywhere, the cover art (or a
 * typographic board) on both cover islands, and the title down the spine.
 *
 * Both boards get the same art, as in library_001 — the analysis can tell which
 * islands are the two covers but not which one the exporter meant as the front,
 * so painting both means whichever faces you is right.
 */
export function buildAtlas(
  book: LocalBook, isl: Islands, coverImg: HTMLImageElement | null, size = ATLAS_SIZE,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const hue = authorHue(book.author, book.title)

  // Cloth everywhere first — this is what shows on the edges and endpapers.
  ctx.fillStyle = `hsl(${hue} 42% 19%)`
  ctx.fillRect(0, 0, size, size)

  const board = (r: Rect | null) => {
    if (!r || r.w < 4 || r.h < 4) return
    if (coverImg) {
      drawImageCover(ctx, coverImg, r.x, r.y, r.w, r.h)
      // Slight darkening at head and tail, so a flat scan reads as a board.
      const vg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h)
      vg.addColorStop(0, 'rgba(0,0,0,0.07)')
      vg.addColorStop(0.12, 'rgba(0,0,0,0)')
      vg.addColorStop(0.88, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.10)')
      ctx.fillStyle = vg
      ctx.fillRect(r.x, r.y, r.w, r.h)
    } else {
      drawTypoBoard(ctx, r, book.title, book.author ?? '', hue)
    }
  }
  board(isl.face1)
  board(isl.face2)

  // Spine: title along the long axis, plus head and tail bands.
  const sp = isl.spine
  if (sp && sp.w > 6 && sp.h > 6) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(sp.x, sp.y, sp.w, sp.h)
    ctx.clip()
    ctx.fillStyle = `hsl(${hue} 45% 22%)`
    ctx.fillRect(sp.x, sp.y, sp.w, sp.h)

    const along = sp.h >= sp.w    // spine runs vertically in the atlas
    ctx.fillStyle = 'rgba(255,240,200,0.16)'
    if (along) {
      ctx.fillRect(sp.x, sp.y + sp.h * 0.05, sp.w, Math.max(1, sp.h * 0.008))
      ctx.fillRect(sp.x, sp.y + sp.h * 0.94, sp.w, Math.max(1, sp.h * 0.008))
    } else {
      ctx.fillRect(sp.x + sp.w * 0.05, sp.y, Math.max(1, sp.w * 0.008), sp.h)
      ctx.fillRect(sp.x + sp.w * 0.94, sp.y, Math.max(1, sp.w * 0.008), sp.h)
    }

    ctx.translate(sp.x + sp.w / 2, sp.y + sp.h / 2)
    if (along) ctx.rotate(-Math.PI / 2)
    const run = along ? sp.h : sp.w
    const across = along ? sp.w : sp.h
    ctx.font = `bold ${Math.max(7, Math.round(across * 0.42))}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,242,205,0.9)'
    wrapText(ctx, book.title, 0, 0, run * 0.86, across, 1)
    ctx.restore()
  }

  const t = new THREE.CanvasTexture(c)
  // The GLB's own UVs assume GL orientation, so the atlas must not be flipped.
  t.flipY = false
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
