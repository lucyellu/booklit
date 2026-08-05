import { useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import type { LocalBook } from '../../context/BookContext'
import { dedupe, matchesShelf, hasEbook } from '../../lib/filterBooks'
import { allLists, CARD_TINTS } from '../../lib/curatedLists'
import { PLAYLISTS } from '../../lib/clips'
import { PlaylistCard } from './PlaylistView'
import { TintTile } from './TintTile'
import { Play, ChevronRight, ChevronLeft, Link2 } from 'lucide-react'

function greeting(hour: number): string {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/* Shelf cards cycle the shared palette by position — hashing the title would
   collide often, and two neighbouring cards in the same colour is exactly the
   sameness this is meant to avoid. The card order is fixed, so this is stable.
   Offset by 2 so the shelf row doesn't open on the same blue as the curated row
   directly above it. A dark gradient sits over every tint so white titles clear
   AA on all six. */
const cardTint = (index: number) => CARD_TINTS[(index + 2) % CARD_TINTS.length]

interface Row {
  key: string
  title: string
  books: LocalBook[]
  onOpen: () => void
}

/** Big two-up card, as in Forest Day's "Featured Playlists". */
function TintCard({ title, blurb, count, tint, onClick }: {
  title: string
  blurb?: string
  count: number
  tint: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="group text-left">
      <TintTile
        tint={tint}
        title={title}
        blurb={blurb}
        meta={`${count} ${count === 1 ? 'book' : 'books'}`}
        className="h-48"
      />
    </button>
  )
}

/** Same contract as the library: one click selects, two open the reader. */
function CoverStrip({ books, onOpen, onSelect, selectedId }: {
  books: LocalBook[]
  onOpen: (b: LocalBook) => void
  onSelect: (b: LocalBook) => void
  selectedId: string | null
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4">
      {books.map(b => (
        <button
          key={b.id}
          onClick={() => onSelect(b)}
          onDoubleClick={() => onOpen(b)}
          title={`${b.title}${b.author ? ` — ${b.author}` : ''}\nClick for details · double-click to read`}
          className="group text-left"
        >
          <div className={`aspect-[2/3] rounded-xl overflow-hidden bg-bg-sunken shadow-sm mb-2 transition-all group-hover:-translate-y-1 group-hover:shadow-md ${
            selectedId === b.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
          }`}>
            {b.coverUrl ? (
              <img
                src={b.coverUrl}
                alt={b.title}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-display text-2xl font-extrabold text-text/30">
                  {b.title.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11.5px] font-bold text-text truncate leading-tight group-hover:text-accent-warm transition-colors">
            {b.title}
          </p>
          <p className="text-[10.5px] text-text-muted truncate mt-0.5">{b.author}</p>
        </button>
      ))}
    </div>
  )
}

/** Pill button that prompts for a URL, loads it as a one-chapter book, and
 *  jumps straight into the reader — the same "read this aloud" path as
 *  opening a shelf book, just skipping the shelf. */
function ReadUrlButton() {
  const { openReader } = useApp()
  const { loadUrl } = useBook()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    const input = window.prompt('Paste an article or blog post URL to read aloud.')
    const url = input?.trim()
    if (!url) return
    setIsLoading(true)
    try {
      const ok = await loadUrl(url)
      if (ok) openReader()
      else window.alert("Couldn't load that page. Check the URL and try again.")
    } catch (err) {
      window.alert(`Couldn't load that page: ${(err as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-accent text-on-accent px-5 py-2 text-[13px] font-bold shadow-sm hover:brightness-110 transition disabled:opacity-60"
    >
      <Link2 className="w-4 h-4" />
      {isLoading ? 'Loading…' : 'Read a URL'}
    </button>
  )
}

export function HomeView() {
  const {
    setShelfFilter, setLibrarySource, setListId, setPlaylistId, openReader,
    openDetail, detailBookId,
  } = useApp()
  const { localBooks, isReadable, openBook } = useBook()

  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = scrollRef.current.clientWidth * 0.75
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
    }
  }

  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])

  const handleOpen = (lb: LocalBook) => {
    openBook(lb).then(ok => { if (ok) openReader() })
  }

  const continueReading = useMemo(
    () => [...deduped]
      .filter(b => b.progress > 0)
      .sort((a, b) => (b.lastRead || '').localeCompare(a.lastRead || ''))
      .slice(0, 8),
    [deduped],
  )

  const readyToRead = useMemo(
    () => deduped.filter(b => isReadable(b) && b.progress === 0).slice(0, 8),
    [deduped, isReadable],
  )

  const wantToRead = useMemo(
    () => deduped.filter(b => matchesShelf(b, 'want')).slice(0, 8),
    [deduped],
  )

  /* Counts are computed over the same deduped set the grid uses, so a card that
     says "95 books" opens onto 95 books. Empty lists are dropped rather than
     shown at zero — a library with no science fiction shouldn't advertise it. */
  const curatedCards = useMemo(
    () => allLists(isReadable)
      .map(l => ({ ...l, count: deduped.filter(l.match).length }))
      .filter(l => l.count > 0),
    [deduped, isReadable],
  )

  const shelfCards = useMemo(() => ([
    { title: 'Favorites', count: deduped.filter(b => matchesShelf(b, 'favorites')).length, go: () => setShelfFilter('favorites') },
    { title: 'Highly Recommended', count: deduped.filter(b => matchesShelf(b, 'recommended')).length, go: () => setShelfFilter('recommended') },
    { title: 'Have Read', count: deduped.filter(b => matchesShelf(b, 'read')).length, go: () => setShelfFilter('read') },
    { title: 'Reading Now', count: deduped.filter(b => matchesShelf(b, 'reading')).length, go: () => setShelfFilter('reading') },
    { title: 'Want to Read', count: deduped.filter(b => matchesShelf(b, 'want')).length, go: () => setShelfFilter('want') },
    { title: 'On This Machine', count: deduped.filter(b => b.shelf === 'local').length, go: () => setShelfFilter('local') },
    { title: 'Has an Ebook', count: deduped.filter(hasEbook).length, go: () => setLibrarySource(null) },
  ]).filter(c => c.count > 0), [deduped, setShelfFilter, setLibrarySource])

  const rows: Row[] = [
    { key: 'continue', title: 'Continue Reading', books: continueReading, onOpen: () => setShelfFilter('recent') },
    { key: 'ready', title: 'Ready to Open', books: readyToRead, onOpen: () => setShelfFilter('all') },
    { key: 'want', title: 'Want to Read', books: wantToRead, onOpen: () => setShelfFilter('want') },
  ].filter(r => r.books.length > 0)

  /* Playlists are self-contained excerpts, so they work before a single book
     has loaded — the empty state keeps them rather than showing a bare page. */
  const playlistRow = (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold tracking-widest uppercase text-accent-warm">
          Playlists
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleScroll('left')}
            className="p-1.5 rounded-full bg-bg-surface border border-border text-text-muted hover:text-accent hover:border-border-hover transition-colors shadow-sm"
            title="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="p-1.5 rounded-full bg-bg-surface border border-border text-text-muted hover:text-accent hover:border-border-hover transition-colors shadow-sm"
            title="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scroll-smooth scrollbar-hide">
        {PLAYLISTS.map(p => (
          <PlaylistCard key={p.id} playlist={p} onOpen={() => setPlaylistId(p.id)} />
        ))}
      </div>
    </section>
  )

  if (deduped.length === 0) {
    return (
      <div className="max-w-5xl mx-auto pb-12">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-text mb-2">
              {greeting(new Date().getHours())}
            </h1>
            <p className="text-text-dim text-lg">
              Connecting to your library… or import a Goodreads CSV / upload EPUBs to get started.
            </p>
          </div>
          <ReadUrlButton />
        </header>
        {playlistRow}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-text mb-2">
            {greeting(new Date().getHours())}
          </h1>
          <p className="text-text-dim text-lg">What do you want to read?</p>
        </div>
        <ReadUrlButton />
      </header>

      {playlistRow}

      {curatedCards.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs font-bold tracking-widest uppercase text-accent-warm mb-4">
            Curated Lists
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {curatedCards.map(l => (
              <TintCard
                key={l.id}
                title={l.title}
                blurb={l.blurb}
                count={l.count}
                tint={l.tint}
                onClick={() => setListId(l.id)}
              />
            ))}
          </div>
        </section>
      )}

      {shelfCards.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs font-bold tracking-widest uppercase text-accent-warm mb-4">
            Your Shelves
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shelfCards.map((c, i) => (
              <TintCard
                key={c.title}
                title={c.title}
                count={c.count}
                tint={cardTint(i)}
                onClick={c.go}
              />
            ))}
          </div>
        </section>
      )}

      {rows.map(row => (
        <section key={row.key} className="mb-11">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-accent-warm">
              {row.title}
            </h2>
            <button
              onClick={row.onOpen}
              className="flex items-center gap-1 text-[12px] font-bold text-text-dim hover:text-accent-warm transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <CoverStrip
            books={row.books}
            onOpen={handleOpen}
            onSelect={b => openDetail(b.id)}
            selectedId={detailBookId}
          />
        </section>
      ))}

      {rows.length === 0 && (
        <div className="card-study rounded-2xl p-8 flex items-center gap-4">
          <Play className="w-5 h-5 text-accent flex-shrink-0" />
          <p className="text-[13px] text-text-dim">
            Nothing is open yet. Pick a shelf on the left, or import books to get started.
          </p>
        </div>
      )}
    </div>
  )
}
