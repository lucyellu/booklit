import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import type { LocalBook } from '../../context/BookContext'
import { dedupe, matchesShelf, hasEbook } from '../../lib/filterBooks'
import { Play, ChevronRight } from 'lucide-react'

function greeting(hour: number): string {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Forest Day's featured cards are deliberately *not* green — the colour is how
 * you tell one shelf from another at a glance, and a wall of greens on a green
 * ground reads as one undifferentiated block. These are the mockup's own six.
 * A dark gradient sits over the top so white titles clear AA on every one.
 */
const CARD_TINTS = [
  '#4a7fd4', '#e07b39', '#d44a7a', '#3abcd4', '#3aad5a', '#d4a83a',
]

/* Assigned by position, not by hashing the title: hashing 7 titles into 6 tints
   collides often, and two neighbouring cards in the same colour is exactly the
   sameness this is meant to avoid. The card order is fixed, so this is stable. */
const cardTint = (index: number) => CARD_TINTS[index % CARD_TINTS.length]

interface Row {
  key: string
  title: string
  books: LocalBook[]
  onOpen: () => void
}

/** Big two-up shelf card, as in Forest Day's "Featured Playlists". */
function ShelfCard({ title, count, index, onClick }: {
  title: string
  count: number
  index: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl h-48 text-left shadow-sm hover:shadow-md transition-shadow"
      style={{ background: cardTint(index) }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60 mix-blend-multiply" />
      <div className="absolute inset-0 p-6 flex flex-col justify-end">
        <h3 className="text-white text-2xl font-bold leading-tight mb-1 origin-bottom-left group-hover:scale-105 transition-transform duration-300">
          {title}
        </h3>
        {/* /90 not the mockup's /80: on the cyan and gold tints /80 lands at
            4.2:1, just under AA for 14px text. */}
        <p className="text-white/90 text-sm font-medium mt-1">
          {count} {count === 1 ? 'book' : 'books'}
        </p>
      </div>
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
  const { setShelfFilter, setLibrarySource, openReader } = useApp()
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

  if (deduped.length === 0) {
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

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <header className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text mb-2">
          {greeting(new Date().getHours())}
        </h1>
        <p className="text-text-dim text-lg">What do you want to read?</p>
      </header>

      {shelfCards.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs font-bold tracking-widest uppercase text-accent-warm mb-4">
            Your Shelves
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shelfCards.map((c, i) => (
              <ShelfCard key={c.title} title={c.title} count={c.count} index={i} onClick={c.go} />
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
