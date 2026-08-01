import type { LocalBook } from '../context/BookContext'

/**
 * Presentation helpers ported from bookify's `bibliophile.html`. Kept in one
 * place because the detail panel, the flat grid and the 3D scene all need the
 * same author colour and the same spine width — if they drift, a book changes
 * colour when you switch card mode.
 */

/** bibliophile.html:1804 — the same hash, so colours match the original app. */
export function hashStr(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h)
}

/**
 * A stable colour per book (bibliophile.html:1822). Unlike the home screen's
 * shelf cards this deliberately uses the full hue wheel: with hundreds of books
 * on screen at once, the colour *is* the index, and restricting it to the
 * forest greens would make every art card identical.
 *
 * Seeded on author *then* title, because the curated CSV's `author` column is
 * empty for all 763 rows — hashing it alone would hand every book the same hue
 * and defeat the whole point of the art cards.
 */
export function authorHue(author?: string, title?: string): number {
  return hashStr(author?.trim() || title?.trim() || 'Unknown') % 360
}

export function authorColor(author?: string, title?: string, lightness = 58): string {
  return `hsl(${authorHue(author, title)} 72% ${lightness}%)`
}

/**
 * Whether `spine` is genuinely different art from `cover`, rather than another
 * size of the same image. The curated CSV fills cover_art_spine with the M-size
 * OpenLibrary cover and cover_url with the L-size — same picture — and stretching
 * that into a spine slab just looks like a smeared thumbnail.
 */
export function hasDistinctSpineArt(book: LocalBook): boolean {
  const { coverArtSpine: spine, coverUrl: cover } = book
  if (!spine) return false
  if (!cover) return true
  const strip = (u: string) => u.replace(/-(S|M|L)\.(jpg|jpeg|png|webp)$/i, '')
  return strip(spine) !== strip(cover)
}

const SHELF_NAMES: Record<string, string> = {
  read: 'Have Read',
  'highly-recommended': 'Highly Recommended',
  favorites: 'Favorites',
  'to-read': 'Want to Read',
  'currently-reading': 'Reading Now',
  local: 'On This Machine',
}

export function shelfDisplay(shelf?: string): string {
  const s = (shelf || '').toLowerCase()
  return SHELF_NAMES[s] || shelf || 'Other'
}

/** bibliophile.html:2457 */
export function shelfEmoji(shelf?: string): string {
  const s = (shelf || '').toLowerCase()
  if (s === 'favorites') return '★'
  if (s.includes('recommend')) return '👍'
  if (s === 'read') return '✓'
  if (s.includes('reading')) return '📖'
  return '📚'
}

/** bookify's estimate: 250 words a page, read at 238 wpm. */
export function readingHours(pages?: number): number | undefined {
  if (!pages) return undefined
  return Math.round((pages * 250) / 238 / 60)
}

/**
 * Spine width from page count (bibliophile.html:1798). Clamped, because the CSV
 * has both 32-page pamphlets and 1200-page doorstops and an unclamped scale
 * makes the thin ones invisible.
 */
const SPINE_MIN_W = 26
const SPINE_MAX_W = 76
const SPINE_DEFAULT_W = 40
const SPINE_PX_PER_PAGE = 0.09

export function spineWidth(pages?: number): number {
  if (!pages) return SPINE_DEFAULT_W
  return Math.max(SPINE_MIN_W, Math.min(SPINE_MAX_W, Math.round(pages * SPINE_PX_PER_PAGE)))
}

/** Everything the detail panel's meta grid shows, minus anything missing. */
export function metaRows(b: LocalBook): [string, string][] {
  const rows: [string, string][] = []
  if (b.year) rows.push(['Year', String(b.year)])
  if (b.publisher) rows.push(['Publisher', b.publisher])
  if (b.pages) rows.push(['Pages', b.pages.toLocaleString()])
  if (b.wordCount) rows.push(['Est. words', b.wordCount.toLocaleString()])
  const hrs = readingHours(b.pages)
  if (hrs) rows.push(['Reading time', `~${hrs} hrs`])
  if (b.language) rows.push(['Language', b.language])
  if (b.edition) rows.push(['Edition', b.edition])
  if (b.rating && b.rating > 0) {
    rows.push(['Rating', '★'.repeat(Math.min(5, Math.round(b.rating)))])
  }
  return rows
}
