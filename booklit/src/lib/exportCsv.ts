import type { LocalBook } from '../context/BookContext'

/**
 * Export a shelf as CSV.
 *
 * This is the only route back into Goodreads. Their API can't be written to, so
 * pushing changes means downloading this and running it through
 * goodreads.com/review/import by hand. The column names are the ones their
 * importer recognises — renaming them breaks the round trip.
 */
const GOODREADS_COLUMNS = [
  'Title',
  'Author',
  'ISBN',
  'My Rating',
  'Number of Pages',
  'Year Published',
  'Date Added',
  'Bookshelves',
  'Exclusive Shelf',
  'My Review',
] as const

function esc(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** "read, favourites" → exclusive shelf + the rest, the way Goodreads models it. */
function splitShelves(shelf?: string): { exclusive: string; extra: string } {
  const parts = (shelf || 'read').split(',').map(s => s.trim()).filter(Boolean)
  const known = ['read', 'currently-reading', 'to-read']
  const exclusive = parts.find(p => known.includes(p)) || 'read'
  const extra = parts.filter(p => p !== exclusive).join(', ')
  return { exclusive, extra }
}

function isoDate(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function toGoodreadsCsv(books: LocalBook[]): string {
  const rows = [GOODREADS_COLUMNS.join(',')]
  for (const b of books) {
    const { exclusive, extra } = splitShelves(b.shelf)
    rows.push([
      esc(b.title),
      esc(b.author),
      // Goodreads' importer mangles bare ISBNs into numbers; ="…" is their own
      // escape for it, and it's what their export writes too.
      b.isbn ? esc(`="${b.isbn}"`) : '',
      esc(b.rating || ''),
      esc(b.pages || ''),
      esc(b.year || ''),
      esc(isoDate(b.addedAt)),
      esc(extra),
      esc(exclusive),
      esc(b.notes || ''),
    ].join(','))
  }
  return rows.join('\n')
}

/** Hand a generated CSV to the browser as a download. */
export function downloadCsv(filename: string, csv: string) {
  // Leading BOM, so Excel opens it as UTF-8 rather than mojibake.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
