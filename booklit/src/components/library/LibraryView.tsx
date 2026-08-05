import { useMemo, useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { useProfiles } from '../../context/ProfileContext'
import { CSS3DScene } from './CSS3DScene'
import { WebGLScene } from './WebGLScene'
import { ModelScene } from './ModelScene'
import type { LocalBook } from '../../context/BookContext'
import {
  dedupe, applyWorkPrefs, applyFilters, sortBooks, SORT_LABELS, SORT_DIR_LABELS,
} from '../../lib/filterBooks'
import type { SortKey } from '../../lib/filterBooks'
import { authorHue, spineWidth, hasDistinctSpineArt } from '../../lib/bookMeta'
import { findList } from '../../lib/curatedLists'
import type { CardMode, LibraryViewMode, StageSize } from '../../context/AppContext'
import {
  Loader2, X, ChevronLeft, ChevronRight, BookOpen, ShoppingCart,
  ArrowUpDown, ChevronDown, ArrowUpNarrowWide, ArrowDownWideNarrow,
} from 'lucide-react'

/**
 * How many books a page holds by default, per view — what each one draws
 * without labouring.
 *
 * These used to be hard caps inside the scenes, which meant a flat 300 per page
 * promised books the scene then silently dropped. They're page sizes now, and
 * the reader can override them (including "all"), so the number is a default
 * rather than a ceiling: 40 hardcover meshes is what a mid-range GPU holds a
 * steady frame rate at, not a limit of the code.
 */
const PAGE_SIZES: Record<LibraryViewMode, number> = {
  flat: 300,
  css3d: 300,
  webgl: 160,
  models: 40,
}

/** Past this many books on stage, the view is going to labour — worth saying so
 *  rather than letting it look broken. Models cost far more than cards. */
const HEAVY_ON_STAGE: Record<LibraryViewMode, number> = {
  flat: 1000,
  css3d: 400,
  webgl: 400,
  models: 80,
}

const STAGE_SIZES: StageSize[] = ['auto', 40, 100, 250, 500, 'all']

function resolvePageSize(size: StageSize, view: LibraryViewMode, total: number): number {
  if (size === 'auto') return PAGE_SIZES[view]
  if (size === 'all') return Math.max(1, total)
  return size
}

export function LibraryView() {
  const {
    libraryView, openReader, shelfFilter, searchQuery, readableOnly,
    availability, librarySource, collectionId, collections, listId,
    cardMode, openDetail, detailBookId, sortKey, sortDir, requestFocus, requestReset,
    registerRevealHandler, stageSize, setSearchQuery,
  } = useApp()
  const {
    localBooks, openBook, bookLoadingId, bookError, clearBookError, isReadable,
    syncingProfileId,
  } = useBook()
  const { activeProfile, overrides } = useProfiles()
  const [page, setPage] = useState(0)

  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])
  // Layer the user's manually-picked cover (per title, from the detail panel's
  // Editions section) on top of dedupe()'s scoring-based default.
  const withCovers = useMemo(
    () => applyWorkPrefs(deduped, localBooks, overrides),
    [deduped, localBooks, overrides],
  )

  const activeList = useMemo(() => findList(listId, isReadable), [listId, isReadable])

  const filtered = useMemo(
    () => sortBooks(
      applyFilters(
        withCovers,
        {
          shelfFilter, searchQuery, readableOnly, availability, librarySource,
          collectionId, collections, listMatch: activeList?.match ?? null,
        },
        isReadable,
      ),
      sortKey,
      sortDir,
    ),
    [withCovers, shelfFilter, searchQuery, readableOnly, availability, librarySource, collectionId, collections, activeList, isReadable, sortKey, sortDir],
  )

  const activeCollection = collections.find(c => c.id === collectionId) ?? null
  // The book a reveal is still trying to reach, if any. See the reveal wiring
  // below — it's declared up here because the paging effects have to defer to it.
  const pendingRevealRef = useRef<string | null>(null)
  const pageSize = resolvePageSize(stageSize, libraryView, filtered.length)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  // Reset to the first page whenever the result set changes — unless a reveal
  // is in flight, which has already worked out the page it needs and may be the
  // very thing that changed the result set.
  useEffect(() => {
    if (!pendingRevealRef.current) setPage(0)
  }, [shelfFilter, searchQuery, readableOnly, availability, librarySource, collectionId, listId, sortKey, sortDir])
  useEffect(() => { if (page > totalPages - 1) setPage(0) }, [page, totalPages])

  const pageItems = useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize],
  )

  /* Reveal: the outliner can name any book in the library, including one the
     stage isn't showing. Only this component knows the filtered order the pages
     are cut from, so it owns the "get that book on stage and snap to it" step
     and the panel just asks for it. */
  useEffect(() => {
    registerRevealHandler(id => {
      openDetail(id)
      pendingRevealRef.current = id

      /* The outliner searches separately from the library — that's the point of
         it — so it can name a book the library's own search box is filtering
         off the stage. Reveal is an explicit "take me to this one", so the
         filter standing in the way is cleared, and the page is worked out from
         the list that clearing it produces rather than the one on screen now. */
      const hidden = !filtered.some(b => b.id === id)
      let list = filtered
      if (hidden) {
        list = sortBooks(
          applyFilters(
            withCovers,
            {
              shelfFilter, searchQuery: '', readableOnly, availability, librarySource,
              collectionId, collections, listMatch: activeList?.match ?? null,
            },
            isReadable,
          ),
          sortKey,
          sortDir,
        )
        setSearchQuery('')
      }

      const idx = list.findIndex(b => b.id === id)
      if (idx < 0) { pendingRevealRef.current = null; return }   // not ours to find
      setPage(Math.floor(idx / resolvePageSize(stageSize, libraryView, list.length)))
    })
    return () => registerRevealHandler(null)
  }, [registerRevealHandler, filtered, withCovers, shelfFilter, readableOnly, availability,
    librarySource, collectionId, collections, activeList, isReadable, sortKey, sortDir,
    stageSize, libraryView, openDetail, setSearchQuery])

  /* The camera can't point at a book the scene hasn't built, so the snap waits
     here until the book is on stage — a reveal can cost a page turn, and in the
     models view the scene may still be cloning meshes when the page lands. The
     scene is a child, so its sync has already run by the time this does. */
  useEffect(() => {
    const id = pendingRevealRef.current
    if (!id || !pageItems.some(b => b.id === id)) return
    if (requestFocus(id)) { pendingRevealRef.current = null; return }
    let tries = 0
    const timer = setInterval(() => {
      if (++tries > 25 || requestFocus(id)) {
        pendingRevealRef.current = null
        clearInterval(timer)
      }
    }, 200)
    return () => clearInterval(timer)
  }, [pageItems, requestFocus])

  const handleOpen = (lb: LocalBook) => {
    openBook(lb).then(ok => { if (ok) openReader() })
  }

  // 'F' snaps the camera to whichever book is selected in the active 3D scene,
  // or backs the camera out if nothing is. 'R' always clears the selection and
  // resets the camera to frame the whole arrangement, even if nothing about
  // the layout itself changed — the fallback for "the view has drifted and
  // clicking empty space isn't bringing it back." Both are no-ops in Flat,
  // and while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isFocus = e.key === 'f' || e.key === 'F'
      const isReset = e.key === 'r' || e.key === 'R'
      if (!isFocus && !isReset) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()
      if (isFocus) requestFocus()
      else requestReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestFocus, requestReset])

  /* An empty shelf now means one of three different things, and saying which
     is the difference between "it's working" and "it's broken". */
  if (localBooks.length === 0) {
    const loading = syncingProfileId === activeProfile?.id
    const isOwnEmpty = activeProfile?.kind === 'owner' && !activeProfile.goodreadsUserId
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="font-display text-5xl font-extrabold tracking-tight mb-4 text-text">
            {activeProfile?.name ?? 'Booklit'}
          </h1>
          <p className="text-text-dim text-sm">
            {loading
              ? `Reading ${activeProfile?.name ?? 'this'}’s shelf…`
              : isOwnEmpty
                ? 'No shelf connected yet. Link a Goodreads profile in Settings, upload an EPUB, or scan your local folder.'
                : `Nothing on this shelf. It may be private, or empty on Goodreads.`}
          </p>
        </div>
      </div>
    )
  }

  const rangeStart = filtered.length === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min(filtered.length, (page + 1) * pageSize)

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
            {/* Whose shelf this is, so a guest library never reads as yours. */}
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-accent-warm">
              {activeList
                ? 'Curated List'
                : activeCollection
                  ? 'Collection'
                  : activeProfile?.kind === 'guest'
                    ? `${activeProfile.name} · read-only`
                    : 'Your Bookshelf'}
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
                  : shelfFilter !== 'all'
                    ? shelfFilter
                    : activeProfile?.kind === 'guest'
                      ? `${activeProfile.name}’s Library`
                      : 'Your Library'}
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
          <StageSizeControl onStage={pageItems.length} />
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
        ) : libraryView === 'models' ? (
          <ModelScene books={pageItems} />
        ) : (
          <FlatGrid
            localBooks={pageItems}
            onOpen={handleOpen}
            onSelect={lb => openDetail(lb.id)}
            selectedId={detailBookId}
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
 * How many books to put on the stage at once.
 *
 * The 3D views default to what they draw comfortably — a hardcover model is a
 * cloned mesh with its own cover texture, so forty of them is a different
 * proposition from forty cards — but that's a default, not a cap. Ask for the
 * whole shelf and you get the whole shelf; the count goes amber first so a
 * five-second freeze is a choice rather than a surprise.
 */
function StageSizeControl({ onStage }: { onStage: number }) {
  const { stageSize, setStageSize, libraryView } = useApp()
  const heavy = onStage > HEAVY_ON_STAGE[libraryView]

  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
        On stage
      </label>
      <select
        value={String(stageSize)}
        onChange={e => {
          const v = e.target.value
          setStageSize(v === 'auto' || v === 'all' ? v : Number(v) as StageSize)
        }}
        title={`How many books to put on the stage at once. ${
          libraryView === 'models'
            ? 'Hardcover models are the expensive view — every one is a cloned mesh with its own texture.'
            : 'More books on stage means more to draw and more covers to fetch.'
        }`}
        className={`rounded-lg bg-bg border px-2 py-1 text-[11.5px] outline-none focus:ring-1 focus:ring-accent transition-colors ${
          heavy ? 'border-accent-warm text-accent-warm' : 'border-border text-text-dim'
        }`}
      >
        {STAGE_SIZES.map(s => (
          <option key={String(s)} value={String(s)}>
            {s === 'auto'
              ? `Auto (${PAGE_SIZES[libraryView]})`
              : s === 'all'
                ? 'All — slow'
                : s}
          </option>
        ))}
      </select>
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

/**
 * One click picks a book and fills the detail panel; a double click opens it in
 * the reader. A plain click used to open a book outright here, which meant
 * there was no way to look one up without committing to reading it.
 *
 * The three 3D views (2D/3D/4D) repurpose double-click to snap the camera onto
 * the book instead — they have a camera to snap, and the panel's "Read free"
 * button covers reading. Flat has no camera, so double-click still reads here.
 */
function FlatGrid({
  localBooks, onOpen, onSelect, selectedId, loadingId, cardMode,
}: {
  localBooks: LocalBook[]
  onOpen: (book: LocalBook) => void
  onSelect: (book: LocalBook) => void
  selectedId: string | null
  loadingId: string | null
  cardMode: CardMode
}) {
  // Flat has no camera to snap, so "reveal" here means scrolling the card into
  // view — the same job 'F' does in the 3D views.
  const selectedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

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
            ref={lb.id === selectedId ? selectedRef : undefined}
            className={`group relative ${isSpine ? '' : 'text-left'}`}
            style={isSpine ? { width: spineWidth(lb.pages) } : undefined}
          >
            <button
              onClick={() => onSelect(lb)}
              onDoubleClick={() => onOpen(lb)}
              disabled={loadingId === lb.id}
              title={`${lb.title}${lb.author ? ` — ${lb.author}` : ''}\nClick for details · double-click to read`}
              className="w-full text-left disabled:opacity-60"
            >
              <div
                className={`overflow-hidden rounded-xl bg-bg-sunken shadow-sm relative transition-all group-hover:-translate-y-1 group-hover:shadow-md ${
                  isSpine ? 'h-56' : 'aspect-[2/3] mb-2.5'
                } ${selectedId === lb.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}
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
              <QuickAction label="Read" onClick={() => onOpen(lb)}>
                <BookOpen className="w-3.5 h-3.5" />
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
