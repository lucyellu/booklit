import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import {
  Library, BookOpen, BookMarked, Clock, Star, Home, Flame, Check,
  Upload, Settings, Grid3x3, Box, Boxes, Circle, Dna, BookCopy, HardDrive,
  Play, Smartphone, Plus, Trash2, Image, AlignJustify, Palette, BookOpenText,
  ChevronRight,
} from 'lucide-react'
import type { ShelfFilter, AvailabilityFilter, CardMode } from '../../context/AppContext'
import type { BookSource } from '../../context/BookContext'
import {
  dedupe, shelfCounts, availabilityCounts, sourceCounts, listCounts,
} from '../../lib/filterBooks'
import { allLists } from '../../lib/curatedLists'
import { PLAYLISTS } from '../../lib/clips'
import { ProfileSwitcher } from './ProfileSwitcher'

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

/* Grid, Shelf and Cube all run in sort order — across, then down, then back —
   so they're the ones to reach for when the order is the point. Sphere and
   Helix scatter it by design. */
const LAYOUTS = [
  { id: 'grid' as const, label: 'Grid', icon: Grid3x3, hint: 'Sorted left to right, top to bottom' },
  { id: 'shelf' as const, label: 'Shelf', icon: Box, hint: 'Long rows, as on a wall of shelves' },
  { id: 'cube' as const, label: 'Cube', icon: Boxes, hint: 'Square slabs, nearest first' },
  { id: 'sphere' as const, label: 'Sphere', icon: Circle, hint: 'Scattered over a globe' },
  { id: 'helix' as const, label: 'Helix', icon: Dna, hint: 'One long spiral' },
]

/** How a book got into the open shelf — not whose shelf it is. That's the
    profile switcher above this group. */
const SOURCES: { id: BookSource; label: string; icon: typeof Library }[] = [
  { id: 'goodreads', label: 'From Goodreads', icon: BookCopy },
  { id: 'local', label: 'Local Folder', icon: HardDrive },
  { id: 'upload', label: 'Uploads', icon: Upload },
  { id: 'saved', label: 'Saved from others', icon: BookMarked },
  { id: 'curated', label: 'Curated CSV', icon: Library },
]

const COLLAPSED_KEY = 'booklit-sidebar-collapsed'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * A titled group whose header does two independent things: the chevron
 * collapses the group in place, and — for the sections that are themselves
 * browsable collections (Playlists, Curated Lists, My Collections) — the
 * title opens that whole section as its own sortable screen, the same way an
 * item inside the group already does. For groups with no `onHeaderClick`, the
 * title collapses too, so the whole header is one big hit target.
 */
function Group({ title, action, children, collapsed, onToggleCollapse, onHeaderClick, headerActive }: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  collapsed?: boolean
  onToggleCollapse?: () => void
  onHeaderClick?: () => void
  headerActive?: boolean
}) {
  return (
    <div className="mt-8 first:mt-4">
      {title && (
        <div className="flex items-center gap-1.5 px-3 mb-3">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="flex-shrink-0 -ml-0.5 p-0.5 rounded text-on-chrome-muted hover:text-on-chrome transition-colors"
              title={collapsed ? `Show ${title}` : `Hide ${title}`}
              aria-label={collapsed ? `Show ${title}` : `Hide ${title}`}
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
            </button>
          )}
          {onHeaderClick ? (
            <button
              onClick={onHeaderClick}
              title={`Open all ${title}`}
              className={`flex-1 min-w-0 text-left text-[10px] font-bold tracking-[0.16em] uppercase truncate transition-colors ${
                headerActive ? 'text-on-chrome' : 'text-on-chrome-muted hover:text-on-chrome'
              }`}
            >
              {title}
            </button>
          ) : onToggleCollapse ? (
            <button
              onClick={onToggleCollapse}
              className="flex-1 min-w-0 text-left text-[10px] font-bold tracking-[0.16em] uppercase text-on-chrome-muted hover:text-on-chrome transition-colors truncate"
            >
              {title}
            </button>
          ) : (
            <h2 className="flex-1 min-w-0 text-[10px] font-bold tracking-[0.16em] uppercase text-on-chrome-muted truncate">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {!collapsed && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  )
}

/**
 * One sidebar row. `badge` shows the count as a green pill (shelves, in the
 * mockup); otherwise it's plain muted text (availability).
 */
function Row({ icon: Icon, label, count, active, onClick, badge, dense, hint }: {
  icon?: typeof Library
  label: string
  count?: number
  active?: boolean
  onClick: () => void
  badge?: boolean
  dense?: boolean
  hint?: string
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
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

/**
 * Columns / rows for the 3D layouts. The far left of the track is Auto, which
 * shapes the block from the window and is the right answer most of the time —
 * this is for when you want the shelf to line up a particular way.
 */
function CountSlider({ label, value, max, onChange }: {
  label: string
  value: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="px-3 pt-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-medium text-on-chrome-dim">{label}</span>
        <span className="text-[11px] tabular-nums text-on-chrome-muted">
          {value === 0 ? 'Auto' : value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={`${label} — 0 for automatic`}
        title={value === 0 ? 'Automatic — shaped from the window' : `${value}`}
        className="w-full h-1 cursor-pointer"
        style={{ accentColor: 'var(--color-accent-vivid)' }}
      />
    </div>
  )
}

export function Sidebar() {
  const {
    view, setView,
    layout, setLayout,
    libraryView, gridCols, gridRows, setGridCols, setGridRows,
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
    openIndex, indexSection,
  } = useApp()
  const { localBooks, isReadable } = useBook()

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  const toggleGroup = (id: string) => setCollapsed(prev => {
    const next = { ...prev, [id]: !prev[id] }
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)) } catch { /* quota */ }
    return next
  })

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
          <Group
            title="Shelves"
            collapsed={collapsed.shelves}
            onToggleCollapse={() => toggleGroup('shelves')}
          >
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
            open their own screen and are always available, books or not. The
            header opens the same kind of screen for the whole section — every
            playlist at once, sortable — rather than any one of them. */}
        <Group
          title="Playlists"
          collapsed={collapsed.playlists}
          onToggleCollapse={() => toggleGroup('playlists')}
          onHeaderClick={() => openIndex('playlists')}
          headerActive={view === 'index' && indexSection === 'playlists'}
        >
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
        <Group
          title="Curated Lists"
          collapsed={collapsed.curatedLists}
          onToggleCollapse={() => toggleGroup('curatedLists')}
          onHeaderClick={() => openIndex('curatedLists')}
          headerActive={view === 'index' && indexSection === 'curatedLists'}
        >
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

        <Group
          title="Availability"
          collapsed={collapsed.availability}
          onToggleCollapse={() => toggleGroup('availability')}
        >
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
          collapsed={collapsed.collections}
          onToggleCollapse={() => toggleGroup('collections')}
          onHeaderClick={() => openIndex('collections')}
          headerActive={view === 'index' && indexSection === 'collections'}
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

        {/* Whose shelf. Switching here swaps the library out rather than
            filtering one merged pile, which is what "Libraries" used to do. */}
        <ProfileSwitcher />

        {/* How the books in *this* shelf arrived. Only worth showing when the
            open library actually draws on more than one — a guest's shelf is
            all Goodreads, so the group would be a single row saying nothing. */}
        {SOURCES.filter(s => sources[s.id] > 0).length > 1 && (
          <Group
            title="Source"
            collapsed={collapsed.source}
            onToggleCollapse={() => toggleGroup('source')}
          >
            <Row
              label="All sources"
              active={librarySource === null}
              onClick={() => setLibrarySource(null)}
            />
            {SOURCES.filter(s => sources[s.id] > 0).map(({ id, label, icon: Icon }) => (
              <Row
                key={id}
                dense
                icon={Icon}
                label={label}
                count={sources[id]}
                active={librarySource === id}
                onClick={() => setLibrarySource(librarySource === id ? null : id)}
              />
            ))}
          </Group>
        )}

        <Group
          title="Layout"
          collapsed={collapsed.layout}
          onToggleCollapse={() => toggleGroup('layout')}
        >
          {LAYOUTS.map(({ id, label, icon, hint }) => (
            <Row
              key={id}
              icon={icon}
              label={label}
              hint={hint}
              active={layout === id}
              onClick={() => setLayout(id)}
            />
          ))}

          {/* Only the ordered layouts have rows and columns to set, and only the
              3D views use the layout at all — the flat grid is CSS. */}
          {libraryView !== 'flat' && layout !== 'sphere' && layout !== 'helix' && (
            <>
              <CountSlider label="Columns" value={gridCols} max={40} onChange={setGridCols} />
              {layout === 'cube' && (
                <CountSlider label="Rows per slab" value={gridRows} max={24} onChange={setGridRows} />
              )}
            </>
          )}

          {/* The reset control lives in the top bar, beside the view switcher —
              a camera you've lost is not something to go hunting through a
              collapsible sidebar group for. */}
        </Group>

        <Group
          title="Card Style"
          collapsed={collapsed.cardStyle}
          onToggleCollapse={() => toggleGroup('cardStyle')}
        >
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
        <Row icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} />
      </div>
    </div>
  )
}
