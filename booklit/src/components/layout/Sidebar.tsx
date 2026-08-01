import { useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import {
  Library, BookOpen, BookMarked, Clock, Star, Home, Flame, Check,
  Upload, Settings, Grid3x3, Box, Circle, Dna, BookCopy, HardDrive,
  Play, Smartphone, Plus, Trash2, Image, AlignJustify, Palette, BookOpenText,
} from 'lucide-react'
import type { ShelfFilter, AvailabilityFilter, CardMode } from '../../context/AppContext'
import type { BookSource } from '../../context/BookContext'
import {
  dedupe, shelfCounts, availabilityCounts, sourceCounts, listCounts,
} from '../../lib/filterBooks'
import { allLists } from '../../lib/curatedLists'
import { PLAYLISTS } from '../../lib/clips'

/** Top-level places, always shown. */
const BROWSE: { id: ShelfFilter; label: string; icon: typeof Library }[] = [
  { id: 'all', label: 'Library', icon: Library },
  { id: 'reading', label: 'Now Reading', icon: BookOpen },
  { id: 'recent', label: 'History', icon: Clock },
  { id: 'local', label: 'Local Library', icon: HardDrive },
]

/** Shelves, hidden when a library has none of that kind. */
const SHELVES: { id: ShelfFilter; label: string; icon: typeof Library }[] = [
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'recommended', label: 'Highly Recommended', icon: Flame },
  { id: 'read', label: 'Have Read', icon: Check },
  { id: 'want', label: 'Want to Read', icon: BookMarked },
]

const AVAILABILITY: { id: AvailabilityFilter; label: string; icon: typeof Play }[] = [
  { id: 'playable', label: 'Playable', icon: Play },
  { id: 'ebook', label: 'Has Ebook', icon: Smartphone },
]

/** bookify's four card treatments. */
const CARD_MODES: { id: CardMode; label: string; icon: typeof Library }[] = [
  { id: 'cover', label: 'Covers', icon: Image },
  { id: 'spine', label: 'Spines', icon: AlignJustify },
  { id: 'art', label: 'Art cards', icon: Palette },
  { id: 'book3d', label: '3D books', icon: BookOpenText },
]

const LAYOUTS = [
  { id: 'grid' as const, label: 'Grid', icon: Grid3x3 },
  { id: 'shelf' as const, label: 'Shelf', icon: Box },
  { id: 'sphere' as const, label: 'Sphere', icon: Circle },
  { id: 'helix' as const, label: 'Helix', icon: Dna },
]

/** Avatar tints are per-source and fixed, as in the mockup — they're how you
    tell one library from another at a glance, so they don't follow the theme. */
const SOURCES: {
  id: BookSource; label: string; blurb: string; initials: string; tint: string
}[] = [
  { id: 'curated', label: 'Patrick Collison', blurb: 'Stripe CEO · Eclectic reader', initials: 'PC', tint: '#15803d' },
  { id: 'local', label: 'Local Folder', blurb: 'Files on this machine', initials: 'LF', tint: '#0f766e' },
  { id: 'goodreads', label: 'Goodreads', blurb: 'Imported shelves', initials: 'GR', tint: '#cc583d' },
  { id: 'upload', label: 'Uploads', blurb: 'Added by hand', initials: 'UP', tint: '#a16207' },
]

function Group({ title, action, children }: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-8 first:mt-4">
      {title && (
        <div className="flex items-center justify-between px-3 mb-3">
          <h2 className="text-[10px] font-bold tracking-[0.16em] uppercase text-on-chrome-muted">
            {title}
          </h2>
          {action}
        </div>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

/**
 * One sidebar row. `badge` shows the count as a green pill (shelves, in the
 * mockup); otherwise it's plain muted text (availability).
 */
function Row({ icon: Icon, label, count, active, onClick, badge, dense }: {
  icon?: typeof Library
  label: string
  count?: number
  active?: boolean
  onClick: () => void
  badge?: boolean
  dense?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-3 rounded-lg px-3 text-sm font-medium text-left transition-colors ${
        dense ? 'py-1.5' : 'py-2'
      } ${
        active
          ? 'bg-chrome-active text-on-chrome-active'
          : 'text-on-chrome-dim hover:text-on-chrome hover:bg-chrome-active/40'
      }`}
    >
      {Icon && (
        <Icon className={`w-4 h-4 flex-shrink-0 ${
          active ? '' : 'text-on-chrome-muted group-hover:text-on-chrome'
        }`} />
      )}
      <span className="truncate flex-1">{label}</span>
      {count !== undefined && (
        <span
          className={`flex-shrink-0 tabular-nums ${
            badge
              ? 'px-2 py-0.5 rounded-full bg-accent-vivid/20 text-on-chrome-active text-[10px] font-semibold'
              : 'text-xs text-on-chrome-muted group-hover:text-on-chrome-dim'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export function Sidebar() {
  const {
    view, setView,
    layout, setLayout,
    shelfFilter, setShelfFilter,
    availability, toggleAvailability,
    librarySource, setLibrarySource,
    collectionId, setCollectionId,
    listId, setListId,
    playlistId, setPlaylistId,
    collections, createCollection, deleteCollection,
    cardMode, setCardMode,
    setSettingsOpen,
    searchQuery, readableOnly,
  } = useApp()
  const { localBooks, isReadable, uploadFile, importGoodreads, importLocalLibrary } = useBook()
  const fileRef = useRef<HTMLInputElement>(null)

  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])

  const lists = useMemo(() => allLists(isReadable), [isReadable])
  const activeList = lists.find(l => l.id === listId) ?? null

  // Counts run the same pipeline the grid does, so what a row promises is what
  // clicking it delivers.
  const filterOpts = {
    shelfFilter, searchQuery, readableOnly, availability,
    librarySource, collectionId, collections,
    listMatch: activeList?.match ?? null,
  }
  const shelves = useMemo(
    () => shelfCounts(deduped, filterOpts, isReadable),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deduped, searchQuery, readableOnly, availability, librarySource, isReadable],
  )
  const avail = useMemo(
    () => availabilityCounts(deduped, filterOpts, isReadable),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deduped, searchQuery, readableOnly, shelfFilter, librarySource, isReadable],
  )
  const sources = useMemo(
    () => sourceCounts(deduped, filterOpts, isReadable),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deduped, searchQuery, readableOnly, availability, isReadable],
  )
  const listNums = useMemo(
    () => listCounts(deduped, filterOpts, isReadable, lists),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deduped, searchQuery, readableOnly, availability, librarySource, isReadable, lists],
  )

  const visibleShelves = SHELVES.filter(s => shelves[s.id] > 0 || shelfFilter === s.id)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadFile(file)
    } catch (err) {
      console.error('Upload failed:', err)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleGoodreads = async () => {
    const input = window.prompt(
      'Enter your Goodreads user id or profile URL\n(e.g. https://www.goodreads.com/user/show/12345-name or just 12345).\nYour profile must be public.'
    )
    if (!input) return
    try {
      const added = await importGoodreads(input)
      window.alert(added > 0 ? `Added ${added} books from Goodreads.` : 'No new books found.')
    } catch (err) {
      window.alert(`Goodreads import failed: ${(err as Error).message}`)
    }
  }

  const handleScanLocal = async () => {
    try {
      const added = await importLocalLibrary(true)
      window.alert(added > 0 ? `Loaded ${added} books from your local folder.` : 'No new local books found.')
      setShelfFilter('local')
    } catch (err) {
      window.alert(`Local scan failed: ${(err as Error).message}`)
    }
  }

  const handleNewCollection = () => {
    const name = window.prompt('Name this collection')
    if (name) createCollection(name)
  }

  return (
    <div className="chrome h-full w-[240px] flex flex-col">
      {/* Masthead */}
      <div className="px-6 pt-6 pb-2 flex-shrink-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-on-chrome leading-none">
          Booklit
        </h1>
        <p className="text-[11px] text-on-chrome-muted mt-1 font-medium tracking-wide uppercase">
          Your Reading Universe
        </p>
      </div>

      {/* Scrolling nav. The first group is unlabelled in the mockup — the
          masthead already says where you are. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
        <Group>
          <Row icon={Home} label="Home" active={view === 'home'} onClick={() => setView('home')} />
          {BROWSE.map(({ id, label, icon }) => (
            <Row
              key={id}
              icon={icon}
              label={label}
              count={shelves[id]}
              active={view === 'library' && shelfFilter === id && !collectionId && !listId}
              onClick={() => setShelfFilter(id)}
            />
          ))}
        </Group>

        {/* Only shelves this library actually has. A row with nothing behind it
            is just noise — and the curated CSV only uses three of them. */}
        {visibleShelves.length > 0 && (
          <Group title="Shelves">
            {visibleShelves.map(({ id, label, icon }) => (
              <Row
                key={id}
                dense
                badge
                icon={icon}
                label={label}
                count={shelves[id]}
                active={view === 'library' && shelfFilter === id && !collectionId && !listId}
                onClick={() => setShelfFilter(id)}
              />
            ))}
          </Group>
        )}

        {/* Clip playlists. Not a library filter — these hold excerpts, so they
            open their own screen and are always available, books or not. */}
        <Group title="Playlists">
          {PLAYLISTS.map(p => (
            <button
              key={p.id}
              onClick={() => setPlaylistId(playlistId === p.id ? null : p.id)}
              title={p.description}
              className={`group w-full flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-left transition-colors ${
                view === 'playlist' && playlistId === p.id
                  ? 'bg-chrome-active text-on-chrome-active'
                  : 'text-on-chrome-dim hover:text-on-chrome hover:bg-chrome-active/40'
              }`}
            >
              <span
                className="w-4 h-4 rounded flex-shrink-0"
                style={{ background: p.color }}
              />
              <span className="truncate flex-1">{p.title}</span>
              <span className="flex-shrink-0 text-xs tabular-nums text-on-chrome-muted group-hover:text-on-chrome-dim">
                {p.clipIds.length}
              </span>
            </button>
          ))}
        </Group>

        {/* Curated lists. A list with nothing in it is dropped rather than shown
            at zero — the set is derived, so which ones apply depends entirely on
            what's in the library. */}
        <Group title="Curated Lists">
          {lists.filter(l => listNums[l.id] > 0 || listId === l.id).map(l => (
            <button
              key={l.id}
              onClick={() => setListId(listId === l.id ? null : l.id)}
              title={l.blurb}
              className={`group w-full flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-left transition-colors ${
                listId === l.id
                  ? 'bg-chrome-active text-on-chrome-active'
                  : 'text-on-chrome-dim hover:text-on-chrome hover:bg-chrome-active/40'
              }`}
            >
              {/* The dot carries the same tint as the list's card on Home, so
                  the two surfaces read as the same thing. */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: l.tint }}
              />
              <span className="truncate flex-1">{l.title}</span>
              <span className="flex-shrink-0 text-xs tabular-nums text-on-chrome-muted group-hover:text-on-chrome-dim">
                {listNums[l.id]}
              </span>
            </button>
          ))}
        </Group>

        <Group title="Availability">
          {AVAILABILITY.map(({ id, label, icon }) => (
            <Row
              key={id}
              dense
              icon={icon}
              label={label}
              count={avail[id]}
              active={availability.includes(id)}
              onClick={() => toggleAvailability(id)}
            />
          ))}
        </Group>

        <Group
          title="My Collections"
          action={
            <button
              onClick={handleNewCollection}
              className="text-on-chrome-muted hover:text-on-chrome transition-colors"
              title="New collection"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          }
        >
          {collections.length === 0 ? (
            <p className="px-3 text-xs italic text-on-chrome-muted">
              No collections yet
            </p>
          ) : (
            collections.map(c => (
              <div key={c.id} className="group/col relative">
                <Row
                  label={c.name}
                  count={c.bookIds.length}
                  active={collectionId === c.id}
                  onClick={() => setCollectionId(collectionId === c.id ? null : c.id)}
                />
                <button
                  onClick={() => deleteCollection(c.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/col:opacity-100 text-on-chrome-muted hover:text-accent-warm transition-opacity"
                  title={`Delete "${c.name}"`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </Group>

        <Group title="Libraries">
          <Row
            label="All sources"
            active={librarySource === null}
            onClick={() => setLibrarySource(null)}
          />
          {SOURCES.filter(s => sources[s.id] > 0).map(({ id, label, blurb, initials, tint }) => (
            <button
              key={id}
              onClick={() => setLibrarySource(librarySource === id ? null : id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                librarySource === id
                  ? 'bg-chrome-active text-on-chrome-active'
                  : 'text-on-chrome-dim hover:text-on-chrome hover:bg-chrome-active/40'
              }`}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: tint }}
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate leading-snug">{label}</span>
                <span className="block text-[10px] text-on-chrome-muted truncate">{blurb}</span>
              </span>
              <span className="text-xs tabular-nums text-on-chrome-muted flex-shrink-0 ml-2">
                {sources[id]}
              </span>
            </button>
          ))}
        </Group>

        <Group title="Layout">
          {LAYOUTS.map(({ id, label, icon }) => (
            <Row key={id} icon={icon} label={label} active={layout === id} onClick={() => setLayout(id)} />
          ))}
        </Group>

        <Group title="Card Style">
          {CARD_MODES.map(({ id, label, icon }) => (
            <Row
              key={id}
              dense
              icon={icon}
              label={label}
              active={cardMode === id}
              onClick={() => setCardMode(id)}
            />
          ))}
        </Group>
      </div>

      {/* Pinned actions */}
      <div className="flex-shrink-0 border-t border-on-chrome-muted/15 px-3 py-3 flex flex-col gap-px">
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,.md,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <Row icon={Upload} label="Import Books" onClick={() => fileRef.current?.click()} />
        <Row icon={BookCopy} label="Connect Goodreads" onClick={handleGoodreads} />
        <Row icon={HardDrive} label="Rescan Local Folder" onClick={handleScanLocal} />
        <Row icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} />
      </div>
    </div>
  )
}
