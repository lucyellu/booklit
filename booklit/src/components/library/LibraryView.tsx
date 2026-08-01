import { useMemo, useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { CSS3DScene } from './CSS3DScene'
import { WebGLScene } from './WebGLScene'
import type { LocalBook } from '../../context/BookContext'
import {
  dedupe, applyFilters, sortBooks, SORT_LABELS, SORT_DIR_LABELS,
} from '../../lib/filterBooks'
import type { SortKey } from '../../lib/filterBooks'
import { authorHue, spineWidth, hasDistinctSpineArt } from '../../lib/bookMeta'
import { findList } from '../../lib/curatedLists'
import type { CardMode } from '../../context/AppContext'
import {
  Loader2, X, ChevronLeft, ChevronRight, Info, ShoppingCart,
  ArrowUpDown, ChevronDown, ArrowUpNarrowWide, ArrowDownWideNarrow,
} from 'lucide-react'

const PAGE_SIZE = 300

export function LibraryView() {
  const {
    libraryView, openReader, shelfFilter, searchQuery, readableOnly,
    availability, librarySource, collectionId, collections, listId,
    cardMode, openDetail, sortKey, sortDir,
  } = useApp()
  const { localBooks, openBook, bookLoadingId, bookError, clearBookError, isReadable } = useBook()
  const [page, setPage] = useState(0)

  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])

  const activeList = useMemo(() => findList(listId, isReadable), [listId, isReadable])

  const filtered = useMemo(
    () => sortBooks(
      applyFilters(
        deduped,
        {
          shelfFilter, searchQuery, readableOnly, availability, librarySource,
          collectionId, collections, listMatch: activeList?.match ?? null,
        },
        isReadable,
      ),
      sortKey,
      sortDir,
    ),
    [deduped, shelfFilter, searchQuery, readableOnly, availability, librarySource, collectionId, collections, activeList, isReadable, sortKey, sortDir],
  )

  const activeCollection = collections.find(c => c.id === collectionId) ?? null
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Reset to the first page whenever the result set changes.
  useEffect(() => { setPage(0) }, [shelfFilter, searchQuery, readableOnly, availability, librarySource, collectionId, listId, sortKey, sortDir])
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
          <h1 className="font-display text-5xl font-extrabold tracking-tight mb-4 text-text">Booklit</h1>
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
      <div className="flex items-end justify-between mb-6 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {activeList && (
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: activeList.tint }}
              />
            )}
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-accent-warm">
              {activeList ? 'Curated List' : activeCollection ? 'Collection' : 'Your Bookshelf'}
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            {/* Only shelf names need capitalising — they're raw filter ids.
                List and collection names are already written as titles. */}
            <h2 className={`font-display text-3xl font-extrabold tracking-tight text-text ${
              activeList || activeCollection ? '' : 'capitalize'
            }`}>
              {activeList
                ? activeList.title
                : activeCollection
                  ? activeCollection.name
                  : shelfFilter === 'all' ? 'Your Library' : shelfFilter}
            </h2>
            <span className="text-[12px] text-text-muted">
              {filtered.length === 0
                ? 'no books'
                : `${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </span>
          </div>
          {activeList && (
            <p className="text-[12.5px] text-text-dim mt-1 max-w-xl">{activeList.blurb}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SortControl />

          {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-surface transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-text-muted font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-surface transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          )}
        </div>
      </div>

      {/* View */}
      <div className="flex-1 min-h-0 overflow-auto">
        {libraryView === 'css3d' ? (
          <CSS3DScene books={pageItems} />
        ) : libraryView === 'webgl' ? (
          <WebGLScene books={pageItems} />
        ) : (
          <FlatGrid
            localBooks={pageItems}
            onOpen={handleOpen}
            onInfo={lb => openDetail(lb.id)}
            loadingId={bookLoadingId}
            cardMode={cardMode}
          />
        )}
      </div>

      {/* Loading overlay while an EPUB/PDF is fetched + parsed */}
      {bookLoadingId && (
        <div className="scrim fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="surface rounded-2xl px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span className="text-[12.5px] text-text-dim">Opening book…</span>
          </div>
        </div>
      )}

      {/* Error / info toast */}
      {bookError && (
        <div className="surface fixed bottom-[104px] left-1/2 -translate-x-1/2 z-[70] rounded-2xl px-4 py-3 flex items-center gap-3 max-w-md shadow-lg border-l-4 border-l-accent-warm">
          <span className="text-[12px] text-text-dim">{bookError}</span>
          <button onClick={clearBookError} className="text-text-muted hover:text-text flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Sort key + direction. The direction button is separate rather than a pair of
 * menu entries per key, so reversing is one click from wherever you are.
 */
function SortControl() {
  const { sortKey, sortDir, setSortKey, toggleSortDir } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const keys = Object.keys(SORT_LABELS) as SortKey[]

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-border-hover text-text-dim text-[12px] font-semibold hover:border-accent hover:text-text transition-colors"
        title="Sort library"
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {SORT_LABELS[sortKey]}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <button
        onClick={toggleSortDir}
        className="p-1.5 rounded-full border border-border-hover text-text-dim hover:border-accent hover:text-text transition-colors"
        title={`Reverse order — currently ${SORT_DIR_LABELS[sortKey][sortDir]}`}
        aria-label={`Reverse order, currently ${SORT_DIR_LABELS[sortKey][sortDir]}`}
      >
        {sortDir === 'asc'
          ? <ArrowUpNarrowWide className="w-3.5 h-3.5" />
          : <ArrowDownWideNarrow className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-52 surface rounded-xl py-1.5 shadow-lg">
          {keys.map(k => (
            <button
              key={k}
              onClick={() => { setSortKey(k); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-left transition-colors ${
                sortKey === k
                  ? 'text-accent font-bold'
                  : 'text-text-dim hover:text-text hover:bg-bg-sunken/40'
              }`}
            >
              <span>{SORT_LABELS[k]}</span>
              {sortKey === k && (
                <span className="text-[10px] text-text-muted font-semibold">
                  {SORT_DIR_LABELS[k][sortDir]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BookCover({ coverUrl, title }: { coverUrl?: string; title: string }) {
  const [errored, setErrored] = useState(false)
  if (!coverUrl || errored) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-sunken">
        <span className="font-display text-3xl font-extrabold text-text/30">{title.charAt(0)}</span>
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

/**
 * The four bookify card modes. `spine` lays books out as a shelf of vertical
 * spines whose width scales with page count; `art` drops the cover for an
 * author-tinted typographic card; `book3d` fakes a half-open book using the
 * CSV's spine art where present.
 */
function CardFace({ book, mode }: { book: LocalBook; mode: CardMode }) {
  const hue = authorHue(book.author, book.title)

  if (mode === 'art') {
    return (
      <div
        className="w-full h-full flex flex-col justify-between p-3 text-left"
        style={{ background: `linear-gradient(155deg, hsl(${hue} 62% 30%), hsl(${hue} 68% 14%))` }}
      >
        <span className="text-[9px] font-mono uppercase tracking-widest text-white/60 truncate">
          {book.year || book.publisher || ''}
        </span>
        <span className="font-display text-[13px] font-bold text-white leading-tight line-clamp-4">
          {book.title}
        </span>
        <span className="text-[9.5px] text-white/70 truncate">{book.author}</span>
      </div>
    )
  }

  if (mode === 'book3d') {
    return (
      <div className="w-full h-full flex" style={{ perspective: 600 }}>
        {/* Spine slab, then the front board angled away from it. */}
        <div
          className="w-[18%] h-full flex-shrink-0"
          style={hasDistinctSpineArt(book)
            ? { backgroundImage: `url(${JSON.stringify(book.coverArtSpine)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `linear-gradient(90deg, hsl(${hue} 55% 16%), hsl(${hue} 58% 26%))` }}
        />
        <div className="flex-1 h-full relative overflow-hidden shadow-inner">
          <BookCover coverUrl={book.coverUrl} title={book.title} />
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/45 to-transparent" />
        </div>
      </div>
    )
  }

  // 'cover' and 'spine' both show the cover art; spine just gets a narrow box.
  return <BookCover coverUrl={book.coverUrl} title={book.title} />
}

function FlatGrid({
  localBooks, onOpen, onInfo, loadingId, cardMode,
}: {
  localBooks: LocalBook[]
  onOpen: (book: LocalBook) => void
  onInfo: (book: LocalBook) => void
  loadingId: string | null
  cardMode: CardMode
}) {
  if (localBooks.length === 0) {
    return <p className="text-text-muted text-sm">No books match this filter.</p>
  }

  // Spine mode is a shelf, not a grid: the whole point is that widths differ,
  // so it has to flow rather than sit in equal columns.
  const wrapper = cardMode === 'spine'
    ? 'flex flex-wrap items-end gap-1.5'
    : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4'

  return (
    <div className={wrapper}>
      {localBooks.map(lb => {
        const isSpine = cardMode === 'spine'
        return (
          <div
            key={lb.id}
            className={`group relative ${isSpine ? '' : 'text-left'}`}
            style={isSpine ? { width: spineWidth(lb.pages) } : undefined}
          >
            <button
              onClick={() => onOpen(lb)}
              disabled={loadingId === lb.id}
              title={isSpine ? `${lb.title}${lb.author ? ` — ${lb.author}` : ''}` : undefined}
              className="w-full text-left disabled:opacity-60"
            >
              <div
                className={`overflow-hidden rounded-xl bg-bg-sunken shadow-sm relative transition-all group-hover:-translate-y-1 group-hover:shadow-md ${
                  isSpine ? 'h-56' : 'aspect-[2/3] mb-2.5'
                }`}
              >
                <CardFace book={lb} mode={cardMode} />
                {lb.format && lb.format !== 'epub' && !isSpine && (
                  <span className="absolute top-1.5 right-1.5 text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-chrome text-on-chrome-dim">
                    {lb.format}
                  </span>
                )}
                {loadingId === lb.id && (
                  <div className="scrim absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-accent-vivid" />
                  </div>
                )}
              </div>
              {!isSpine && (
                <>
                  <p className="text-[11.5px] font-bold text-text truncate leading-tight group-hover:text-accent-warm transition-colors">
                    {lb.title}
                  </p>
                  <p className="text-[10.5px] text-text-muted truncate mt-0.5">{lb.author || ''}</p>
                </>
              )}
            </button>

            {/* Quick actions. Siblings of the main button, not children — a
                <button> inside a <button> is invalid and swallows the click. */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${
                isSpine ? 'bottom-1.5' : 'bottom-[4.25rem]'
              }`}
            >
              <QuickAction label="Details" onClick={() => onInfo(lb)}>
                <Info className="w-3.5 h-3.5" />
              </QuickAction>
              {lb.buyLink && (
                <QuickAction label="Buy" href={lb.buyLink}>
                  <ShoppingCart className="w-3.5 h-3.5" />
                </QuickAction>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QuickAction({ label, onClick, href, children }: {
  label: string
  onClick?: () => void
  href?: string
  children: React.ReactNode
}) {
  const cls = 'p-1.5 rounded-full bg-chrome text-on-chrome hover:bg-chrome-elevated shadow-md transition-colors'
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        className={cls}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </a>
    )
  }
  return (
    <button type="button" title={label} aria-label={label} className={cls} onClick={onClick}>
      {children}
    </button>
  )
}
