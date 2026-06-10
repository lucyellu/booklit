import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { CSS3DScene } from './CSS3DScene'
import type { LocalBook } from '../../context/BookContext'
import type { ShelfFilter } from '../../context/AppContext'
import { Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 300

// Collapse near-duplicate titles: trailing "(1)", " - copy", punctuation, case.
function dedupeKey(b: LocalBook): string {
  const t = b.title.toLowerCase()
    .replace(/\((\d+)\)\s*$/, '')          // trailing "(1)", "(2)"
    .replace(/\bcopy\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const a = (b.author || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!t) return b.id                        // no usable title → keep unique
  return a ? `${t}|${a}` : t
}

// Keep one entry per key, preferring readable / cover / richer format.
function dedupe(books: LocalBook[], isReadable: (b: LocalBook) => boolean): LocalBook[] {
  const score = (b: LocalBook) =>
    (isReadable(b) ? 4 : 0) +
    (b.coverUrl ? 2 : 0) +
    (b.bookData ? 1 : 0) +
    (b.format === 'epub' ? 1 : b.format === 'pdf' ? 0.5 : 0)
  const map = new Map<string, LocalBook>()
  for (const b of books) {
    const k = dedupeKey(b)
    const ex = map.get(k)
    if (!ex || score(b) > score(ex)) map.set(k, b)
  }
  return [...map.values()]
}

function matchesShelf(b: LocalBook, filter: ShelfFilter): boolean {
  if (filter === 'all' || filter === 'recent') return true
  if (filter === 'local') return b.shelf === 'local'
  const s = (b.shelf || '').toLowerCase()
  if (b.shelf === 'local') return false
  if (filter === 'reading') return s.includes('currently') || s === 'reading'
  if (filter === 'want') return s.includes('to-read') || s.includes('want')
  if (filter === 'read') return s.includes('read') && !s.includes('to-read')
  return true
}

export function LibraryView() {
  const { libraryView, openReader, shelfFilter, searchQuery, readableOnly } = useApp()
  const { localBooks, openBook, bookLoadingId, bookError, clearBookError, isReadable } = useBook()
  const [page, setPage] = useState(0)

  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = deduped.filter(b => matchesShelf(b, shelfFilter))
    if (readableOnly) list = list.filter(isReadable)
    if (q) list = list.filter(b =>
      b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q))
    if (shelfFilter === 'recent') {
      list = [...list].sort((a, b) => (b.lastRead || '').localeCompare(a.lastRead || '')).slice(0, 80)
    }
    return list
  }, [deduped, shelfFilter, searchQuery, readableOnly, isReadable])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Reset to the first page whenever the result set changes.
  useEffect(() => { setPage(0) }, [shelfFilter, searchQuery, readableOnly])
  useEffect(() => { if (page > totalPages - 1) setPage(0) }, [page, totalPages])

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  )

  const handleOpen = (lb: LocalBook) => {
    openBook(lb).then(ok => { if (ok) openReader() })
  }

  if (localBooks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight mb-4">Booklit</h1>
          <p className="text-text-dim text-sm max-w-md">
            Connecting to your library… or import a Goodreads CSV / upload EPUBs to get started.
          </p>
        </div>
      </div>
    )
  }

  const rangeStart = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, (page + 1) * PAGE_SIZE)

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header: count + pagination */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-xl font-semibold capitalize">
            {shelfFilter === 'all' ? 'Your Library' : shelfFilter}
          </h2>
          <span className="text-[11px] text-text-muted">
            {filtered.length === 0
              ? 'no books'
              : `${rangeStart}–${rangeEnd} of ${filtered.length}`}
          </span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-text-muted font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* View */}
      <div className="flex-1 min-h-0 overflow-auto">
        {libraryView === 'css3d' ? (
          <CSS3DScene books={pageItems} />
        ) : libraryView === 'webgl' ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-text-muted text-sm">WebGL 3D model view — coming soon</p>
          </div>
        ) : (
          <FlatGrid localBooks={pageItems} onOpen={handleOpen} loadingId={bookLoadingId} />
        )}
      </div>

      {/* Loading overlay while an EPUB/PDF is fetched + parsed */}
      {bookLoadingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/40 backdrop-blur-sm pointer-events-none">
          <div className="glass-panel rounded-xl px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span className="text-[12.5px] text-text-dim">Opening book…</span>
          </div>
        </div>
      )}

      {/* Error / info toast */}
      {bookError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] glass-panel rounded-xl px-4 py-3 flex items-center gap-3 max-w-md shadow-lg">
          <span className="text-[12px] text-text-dim">{bookError}</span>
          <button onClick={clearBookError} className="text-text-muted hover:text-text flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function BookCover({ coverUrl, title }: { coverUrl?: string; title: string }) {
  const [errored, setErrored] = useState(false)
  if (!coverUrl || errored) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-surface to-bg-elevated">
        <span className="font-display text-3xl text-text-muted">{title.charAt(0)}</span>
      </div>
    )
  }
  return (
    <img
      src={coverUrl}
      alt={title}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setErrored(true)}
    />
  )
}

function FlatGrid({
  localBooks, onOpen, loadingId,
}: {
  localBooks: LocalBook[]
  onOpen: (book: LocalBook) => void
  loadingId: string | null
}) {
  if (localBooks.length === 0) {
    return <p className="text-text-muted text-sm">No books match this filter.</p>
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4">
      {localBooks.map(lb => (
        <button
          key={lb.id}
          onClick={() => onOpen(lb)}
          disabled={loadingId === lb.id}
          className="group text-left hover:scale-[1.03] transition-transform disabled:opacity-60"
        >
          <div className="aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-bg-glass-active shadow-lg relative">
            <BookCover coverUrl={lb.coverUrl} title={lb.title} />
            {lb.format && lb.format !== 'epub' && (
              <span className="absolute top-1 right-1 text-[8px] font-mono uppercase px-1 py-0.5 rounded bg-black/60 text-text-dim">
                {lb.format}
              </span>
            )}
            {loadingId === lb.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            )}
          </div>
          <p className="text-[11px] font-medium text-text truncate leading-tight">{lb.title}</p>
          <p className="text-[10px] text-text-muted truncate">{lb.author || ''}</p>
        </button>
      ))}
    </div>
  )
}
