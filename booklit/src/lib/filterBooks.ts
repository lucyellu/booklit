import type { LocalBook } from '../context/BookContext'
import type { AvailabilityFilter, Collection, ShelfFilter } from '../context/AppContext'
import type { BookSource } from '../context/BookContext'
import { bookKey, type ShelfOverride } from './profiles'

/**
 * One filter pipeline, shared by the grid and the sidebar counts so the two can
 * never disagree. Previously the dedupe/shelf logic lived inside LibraryView.
 */

// Collapse near-duplicate titles: trailing "(1)", " - copy", punctuation, case.
export function dedupeKey(b: LocalBook): string {
  const t = b.title.toLowerCase()
    .replace(/\((\d+)\)\s*$/, '')          // trailing "(1)", "(2)"
    .replace(/\bcopy\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const a = (b.author || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!t) return b.id                        // no usable title → keep unique
  return a ? `${t}|${a}` : t
}

// Keep one entry per key, preferring readable / cover / richer format. If the
// winner has no cover but a sibling edition does (e.g. a Local Library epub
// with no embedded art alongside a curated CSV entry for the same book), the
// winner inherits it — an automatic version of the manual picker in
// EditionsSection, so most duplicates never need it.
export function dedupe(books: LocalBook[], isReadable: (b: LocalBook) => boolean): LocalBook[] {
  const score = (b: LocalBook) =>
    (isReadable(b) ? 4 : 0) +
    (b.coverUrl ? 2 : 0) +
    (b.bookData ? 1 : 0) +
    (b.format === 'epub' ? 1 : b.format === 'pdf' ? 0.5 : 0)
  const groups = new Map<string, LocalBook[]>()
  for (const b of books) {
    const k = dedupeKey(b)
    const arr = groups.get(k)
    if (arr) arr.push(b)
    else groups.set(k, [b])
  }
  const out: LocalBook[] = []
  for (const group of groups.values()) {
    let winner = group[0]
    for (const b of group) if (score(b) > score(winner)) winner = b
    if (!winner.coverUrl) {
      const withCover = group.find(b => b.coverUrl)
      if (withCover) winner = { ...winner, coverUrl: withCover.coverUrl }
    }
    out.push(winner)
  }
  return out
}

/**
 * Layer the user's manually-picked cover on top of dedupe()'s scoring-based
 * default. Runs after dedupe() (not inside it) because it needs the full,
 * pre-dedupe list to find the sibling edition the user actually chose.
 */
export function applyWorkPrefs(
  deduped: LocalBook[],
  allBooks: LocalBook[],
  overrides: Record<string, ShelfOverride>,
): LocalBook[] {
  return deduped.map(b => {
    const coverId = overrides[bookKey(b.title, b.author)]?.workPrefs?.coverEditionId
    if (!coverId) return b
    const chosen = allBooks.find(x => x.id === coverId && dedupeKey(x) === dedupeKey(b))
    return chosen?.coverUrl ? { ...b, coverUrl: chosen.coverUrl } : b
  })
}

export function matchesShelf(b: LocalBook, filter: ShelfFilter): boolean {
  if (filter === 'all' || filter === 'recent') return true
  if (filter === 'local') return b.shelf === 'local'
  const s = (b.shelf || '').toLowerCase()
  if (b.shelf === 'local') return false
  if (filter === 'reading') return s.includes('currently') || s === 'reading'
  if (filter === 'want') return s.includes('to-read') || s.includes('want')
  if (filter === 'favorites') return s.includes('favorite')
  if (filter === 'recommended') return s.includes('recommend')
  // "read" is the catch-all for finished books, so it must not swallow
  // to-read, or the recommended/favorites shelves that also contain "read"…
  // it doesn't, but be explicit about the exclusions.
  if (filter === 'read') {
    return s.includes('read') && !s.includes('to-read') && !s.includes('recommend')
  }
  return true
}

/** Anything with an ebook file we could in principle open. */
export function hasEbook(b: LocalBook): boolean {
  return !!(b.bookData || b.srcUrl || b.epubLink || b.format === 'epub' || b.format === 'pdf')
}

export type SortKey = 'default' | 'title' | 'author' | 'published' | 'added' | 'rating'
export type SortDir = 'asc' | 'desc'

export const SORT_LABELS: Record<SortKey, string> = {
  default: 'Shelf order',
  title: 'Title',
  author: 'Author',
  published: 'Date published',
  added: 'Date added',
  rating: 'Rating',
}

/** Ascending reads differently per key — A→Z, but oldest→newest and low→high. */
export const SORT_DIR_LABELS: Record<SortKey, { asc: string; desc: string }> = {
  default: { asc: 'Normal', desc: 'Reversed' },
  title: { asc: 'A → Z', desc: 'Z → A' },
  author: { asc: 'A → Z', desc: 'Z → A' },
  published: { asc: 'Oldest first', desc: 'Newest first' },
  added: { asc: 'Oldest first', desc: 'Newest first' },
  rating: { asc: 'Lowest first', desc: 'Highest first' },
}

/**
 * Sort the filtered list. Books missing the sort field always sink to the
 * bottom regardless of direction — reversing "date published" should flip the
 * books that *have* a year, not float 763 unknowns to the top.
 */
export function sortBooks(list: LocalBook[], key: SortKey, dir: SortDir): LocalBook[] {
  if (key === 'default') return dir === 'desc' ? [...list].reverse() : list

  const sign = dir === 'asc' ? 1 : -1
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

  // Leading articles are noise when alphabetising titles.
  const sortTitle = (b: LocalBook) =>
    b.title.replace(/^(the|a|an)\s+/i, '').trim() || b.title

  const value = (b: LocalBook): string | number | undefined => {
    if (key === 'title') return sortTitle(b)
    if (key === 'author') return b.author?.trim() || undefined
    if (key === 'published') return b.year
    // Local books carry a real filesystem date; everything else falls back to
    // when it entered the library, which is the closest thing they have.
    if (key === 'added') return b.addedAt ?? (Date.parse(b.lastRead) || undefined)
    if (key === 'rating') return b.rating || undefined
    return undefined
  }

  return [...list].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va === undefined && vb === undefined) return 0
    if (va === undefined) return 1        // missing sinks, both directions
    if (vb === undefined) return -1
    const cmp = typeof va === 'string' && typeof vb === 'string'
      ? collator.compare(va, vb)
      : Number(va) - Number(vb)
    if (cmp !== 0) return cmp * sign

    // Ties break on title, then id. Both are signed along with the primary
    // comparison so that reversing is a true mirror: with an unsigned
    // tie-break, duplicate titles and books sharing a file timestamp keep
    // their relative order and the reversed list isn't the reverse.
    const byTitle = collator.compare(sortTitle(a), sortTitle(b))
    if (byTitle !== 0) return byTitle * sign
    return (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) * sign
  })
}

export interface FilterOptions {
  shelfFilter: ShelfFilter
  searchQuery: string
  readableOnly: boolean
  availability: AvailabilityFilter[]
  librarySource: BookSource | null
  collectionId: string | null
  collections: Collection[]
  /**
   * Membership test for the active curated list, or null for no list. Passed in
   * already resolved rather than as an id, so this module stays independent of
   * `curatedLists` — which imports `matchesShelf` from here.
   */
  listMatch?: ((b: LocalBook) => boolean) | null
}

export function applyFilters(
  deduped: LocalBook[],
  opts: FilterOptions,
  isReadable: (b: LocalBook) => boolean,
): LocalBook[] {
  const {
    shelfFilter, searchQuery, readableOnly,
    availability, librarySource, collectionId, collections, listMatch,
  } = opts

  let list = deduped

  // A collection or a curated list is an explicit set, so it replaces the shelf
  // filter rather than intersecting with it.
  if (collectionId) {
    const ids = new Set(collections.find(c => c.id === collectionId)?.bookIds ?? [])
    list = list.filter(b => ids.has(b.id))
  } else if (listMatch) {
    list = list.filter(listMatch)
  } else {
    list = list.filter(b => matchesShelf(b, shelfFilter))
  }

  if (librarySource) list = list.filter(b => (b.source ?? 'curated') === librarySource)
  if (readableOnly) list = list.filter(isReadable)
  if (availability.includes('playable')) list = list.filter(isReadable)
  if (availability.includes('ebook')) list = list.filter(hasEbook)

  const q = searchQuery.trim().toLowerCase()
  if (q) {
    list = list.filter(b =>
      b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q))
  }

  if (!collectionId && !listMatch && shelfFilter === 'recent') {
    // History, not "recently added" — only books actually opened at least
    // once. progress is only ever set by updateReadingProgress once reading
    // has happened, so this excludes anything still sitting untouched.
    list = [...list]
      .filter(b => b.progress > 0)
      .sort((a, b) => (b.lastRead || '').localeCompare(a.lastRead || ''))
      .slice(0, 80)
  }

  return list
}

/**
 * Counts for the sidebar. Each count answers "how many books would I see if I
 * clicked this?", so it runs the same pipeline with only that facet changed.
 */
export function shelfCounts(
  deduped: LocalBook[],
  opts: FilterOptions,
  isReadable: (b: LocalBook) => boolean,
): Record<ShelfFilter, number> {
  const shelves: ShelfFilter[] = [
    'all', 'reading', 'want', 'read', 'recent', 'local', 'favorites', 'recommended',
  ]
  const out = {} as Record<ShelfFilter, number>
  for (const shelf of shelves) {
    out[shelf] = applyFilters(
      deduped,
      { ...opts, shelfFilter: shelf, collectionId: null, listMatch: null },
      isReadable,
    ).length
  }
  return out
}

/**
 * How many books each curated list would show. Same pipeline as the grid, with
 * the shelf/collection facet cleared, so the sidebar badge is the number you get.
 */
export function listCounts(
  deduped: LocalBook[],
  opts: FilterOptions,
  isReadable: (b: LocalBook) => boolean,
  lists: { id: string; match: (b: LocalBook) => boolean }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lists) {
    out[l.id] = applyFilters(
      deduped,
      { ...opts, shelfFilter: 'all', collectionId: null, listMatch: l.match },
      isReadable,
    ).length
  }
  return out
}

export function availabilityCounts(
  deduped: LocalBook[],
  opts: FilterOptions,
  isReadable: (b: LocalBook) => boolean,
): Record<AvailabilityFilter, number> {
  const base = { ...opts, availability: [] as AvailabilityFilter[] }
  return {
    playable: applyFilters(deduped, { ...base, availability: ['playable'] }, isReadable).length,
    ebook: applyFilters(deduped, { ...base, availability: ['ebook'] }, isReadable).length,
  }
}

export function sourceCounts(
  deduped: LocalBook[],
  opts: FilterOptions,
  isReadable: (b: LocalBook) => boolean,
): Record<BookSource, number> {
  const sources: BookSource[] = ['curated', 'local', 'goodreads', 'upload', 'saved']
  const out = {} as Record<BookSource, number>
  for (const src of sources) {
    out[src] = applyFilters(
      deduped,
      { ...opts, librarySource: src, shelfFilter: 'all', collectionId: null, listMatch: null },
      isReadable,
    ).length
  }
  return out
}
