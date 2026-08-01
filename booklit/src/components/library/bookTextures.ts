import * as THREE from 'three'
import type { LocalBook } from '../../context/BookContext'
import { authorHue } from '../../lib/bookMeta'

/**
 * Canvas-drawn textures for the WebGL book meshes.
 *
 * Everything here is generated locally. The 3d_mesh column the CSV reserves for
 * real GLB models is empty for all 763 rows, so there is nothing to load — the
 * books are procedural boxes, and these are the faces painted onto them. Real
 * cover art is layered on top afterwards by the scene, for the books that have
 * a cover_url and only once it has actually downloaded.
 */

/** Book proportions in world units. Matches the CSS3D cards, so the shared
    LayoutEngine spacing (180 × 260) frames both views identically. */
export const BOOK_W = 140
export const BOOK_H = 200

const px = (n: number) => `${n}px`

function texFromCanvas(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Wrap `text` to at most `maxLines` lines that each fit `maxWidth`. */
function wrap(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.length) {
    // Ellipsise the last line if we ran out of room mid-title.
    let last = lines[maxLines - 1]
    if (text.replace(/\s+/g, ' ').indexOf(lines.join(' ')) !== 0 || lines.join(' ').length < text.length) {
      while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
        last = last.slice(0, -1)
      }
      lines[maxLines - 1] = last + '…'
    }
  }
  return lines
}

/** Front board: tinted gradient, title, author. Used until (or instead of) art. */
export function coverTexture(book: LocalBook): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 366
  const ctx = c.getContext('2d')!
  const hue = authorHue(book.author, book.title)

  const g = ctx.createLinearGradient(0, 0, c.width, c.height)
  g.addColorStop(0, `hsl(${hue} 55% 30%)`)
  g.addColorStop(1, `hsl(${hue} 60% 13%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)

  // Debossed rule near the top, the way a clothbound board is stamped.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 2
  ctx.strokeRect(16, 16, c.width - 32, c.height - 32)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `700 ${px(26)} Nunito, system-ui, sans-serif`
  const lines = wrap(ctx, book.title, c.width - 64, 5)
  let y = c.height / 2 - (lines.length - 1) * 17
  for (const l of lines) {
    ctx.fillText(l, c.width / 2, y)
    y += 34
  }

  if (book.author) {
    ctx.fillStyle = 'rgba(255,255,255,0.62)'
    ctx.font = `400 ${px(18)} Nunito, system-ui, sans-serif`
    ctx.fillText(wrap(ctx, book.author, c.width - 64, 1)[0] ?? '', c.width / 2, c.height - 44)
  }

  return texFromCanvas(c)
}

/**
 * Spine. Drawn rotated because the face is tall and narrow, so the title runs
 * bottom-to-top — the way spines are printed almost everywhere outside the US.
 */
export function spineTexture(book: LocalBook): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 366
  const ctx = c.getContext('2d')!
  const hue = authorHue(book.author, book.title)

  const g = ctx.createLinearGradient(0, 0, c.width, 0)
  g.addColorStop(0, `hsl(${hue} 52% 12%)`)
  g.addColorStop(0.45, `hsl(${hue} 55% 27%)`)
  g.addColorStop(1, `hsl(${hue} 52% 15%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)

  // Head and tail bands.
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(0, 22, c.width, 3)
  ctx.fillRect(0, c.height - 25, c.width, 3)

  ctx.save()
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 ${px(26)} Nunito, system-ui, sans-serif`
  ctx.fillText(wrap(ctx, book.title, c.height - 80, 1)[0] ?? '', 0, 0)
  ctx.restore()

  return texFromCanvas(c)
}

/** Back board: same cloth, no type. */
export function backTexture(book: LocalBook): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 92
  const ctx = c.getContext('2d')!
  const hue = authorHue(book.author, book.title)
  const g = ctx.createLinearGradient(0, 0, c.width, c.height)
  g.addColorStop(0, `hsl(${hue} 52% 22%)`)
  g.addColorStop(1, `hsl(${hue} 56% 11%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  return texFromCanvas(c)
}

/**
 * The three cut edges. One texture shared by every book — paper is paper, and
 * 160 copies of the same cream gradient is 160 textures for no reason.
 */
let pagesTex: THREE.CanvasTexture | null = null
export function pagesTexture(): THREE.CanvasTexture {
  if (pagesTex) return pagesTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#efe7d2'
  ctx.fillRect(0, 0, c.width, c.height)
  // Fine striping reads as stacked leaves once it's on a mesh.
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.20)'
  ctx.lineWidth = 1
  for (let x = 0.5; x < c.width; x += 2) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, c.height)
    ctx.stroke()
  }
  pagesTex = texFromCanvas(c)
  pagesTex.wrapS = THREE.RepeatWrapping
  pagesTex.wrapT = THREE.RepeatWrapping
  return pagesTex
}

/** Drop the shared pages texture — only for teardown in tests/HMR. */
export function disposeSharedTextures() {
  pagesTex?.dispose()
  pagesTex = null
}
