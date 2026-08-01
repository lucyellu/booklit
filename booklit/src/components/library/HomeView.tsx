import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import type { LocalBook } from '../../context/BookContext'
import { dedupe, matchesShelf, hasEbook } from '../../lib/filterBooks'
import { allLists, CARD_TINTS } from '../../lib/curatedLists'
import { PLAYLISTS } from '../../lib/clips'
import { PlaylistCard } from './PlaylistView'
import { TintTile } from './TintTile'
import { Play, ChevronRight } from 'lucide-react'

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

function CoverStrip({ books, onOpen }: { books: LocalBook[]; onOpen: (b: LocalBook) => void }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4">
      {books.map(b => (
        <button key={b.id} onClick={() => onOpen(b)} className="group text-left">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-sunken shadow-sm mb-2 transition-all group-hover:-translate-y-1 group-hover:shadow-md">
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

export function HomeView() {
  const { setShelfFilter, setLibrarySource, setListId, setPlaylistId, openReader } = useApp()
  const { localBooks, isReadable, openBook } = useBook()

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
      <h2 className="text-xs font-bold tracking-widest uppercase text-accent-warm mb-4">
        Playlists
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {PLAYLISTS.map(p => (
          <PlaylistCard key={p.id} playlist={p} onOpen={() => setPlaylistId(p.id)} />
        ))}
      </div>
    </section>
  )

  if (deduped.length === 0) {
    return (
      <div className="max-w-5xl mx-auto pb-12">
        <header className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight text-text mb-2">
            {greeting(new Date().getHours())}
          </h1>
          <p className="text-text-dim text-lg">
            Connecting to your library… or import a Goodreads CSV / upload EPUBs to get started.
          </p>
        </header>
        {playlistRow}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <header className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text mb-2">
          {greeting(new Date().getHours())}
        </h1>
        <p className="text-text-dim text-lg">What do you want to read?</p>
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
          <CoverStrip books={row.books} onOpen={handleOpen} />
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
