import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { IndexSection } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { dedupe } from '../../lib/filterBooks'
import { allLists, CARD_TINTS } from '../../lib/curatedLists'
import { PLAYLISTS, clipsFor, playlistDuration, formatDuration } from '../../lib/clips'
import { TintTile } from './TintTile'
import {
  ChevronLeft, ArrowUpDown, ChevronDown, ArrowUpNarrowWide, ArrowDownWideNarrow,
} from 'lucide-react'

/**
 * The overview screen for a whole sidebar section — every playlist, every
 * curated list, or every collection at once — opened by clicking that
 * section's header rather than one item in it.
 *
 * Playlists and curated lists are static, hand-authored content: there is no
 * per-user "date added" or "date modified" behind them, so sorting is limited
 * to their authored (featured) order, title, and how many clips/books they
 * hold. Collections are real user data — `col-<timestamp>` ids double as a
 * genuine creation date — so they get a real "date added" sort too.
 */

type SortKey = 'featured' | 'title' | 'count' | 'added'

const SECTION_META: Record<IndexSection, { title: string; keys: SortKey[] }> = {
  playlists: { title: 'Playlists', keys: ['featured', 'title', 'count'] },
  curatedLists: { title: 'Curated Lists', keys: ['featured', 'title', 'count'] },
  collections: { title: 'My Collections', keys: ['added', 'title', 'count'] },
}

const KEY_LABEL: Record<SortKey, string> = {
  featured: 'Featured order',
  title: 'Alphabetical',
  count: 'Item count',
  added: 'Date added',
}

// Same idea as filterBooks' SORT_DIR_LABELS: which direction is "natural" on
// first pick, and how to describe each direction for that key.
const KEY_DIR_LABELS: Record<SortKey, { asc: string; desc: string }> = {
  featured: { asc: 'Curated order', desc: 'Reversed' },
  title: { asc: 'A → Z', desc: 'Z → A' },
  count: { asc: 'Fewest first', desc: 'Most first' },
  added: { asc: 'Oldest first', desc: 'Newest first' },
}
const NATURAL_DIR: Record<SortKey, 'asc' | 'desc'> = {
  featured: 'asc', title: 'asc', count: 'desc', added: 'desc',
}

interface IndexItem {
  id: string
  title: string
  blurb?: string
  count: number
  countLabel: string
  tint: string
  addedAt?: number
  featuredIndex: number
  onOpen: () => void
}

function sortItems(items: IndexItem[], key: SortKey, dir: 'asc' | 'desc'): IndexItem[] {
  const sign = dir === 'asc' ? 1 : -1
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  return [...items].sort((a, b) => {
    if (key === 'featured') return (a.featuredIndex - b.featuredIndex) * sign
    if (key === 'title') return collator.compare(a.title, b.title) * sign
    if (key === 'count') return (a.count - b.count) * sign
    if (key === 'added') return ((a.addedAt ?? 0) - (b.addedAt ?? 0)) * sign
    return 0
  })
}

/** Mounted fresh (via `key`) whenever the section changes, so its sort state
    starts over on that section's own natural key/direction without an effect. */
export function SectionIndexView() {
  const { indexSection } = useApp()
  if (!indexSection) return null
  return <SectionIndex key={indexSection} section={indexSection} />
}

function SectionIndex({ section }: { section: IndexSection }) {
  const { setView, setPlaylistId, setListId, setCollectionId, collections } = useApp()
  const { localBooks, isReadable } = useBook()
  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])

  const meta = SECTION_META[section]
  const [sortKey, setSortKey] = useState<SortKey>(meta.keys[0])
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(NATURAL_DIR[meta.keys[0]])

  const handleSetKey = (k: SortKey) => { setSortKey(k); setSortDir(NATURAL_DIR[k]) }
  const toggleDir = () => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))

  const items: IndexItem[] = useMemo(() => {
    if (section === 'playlists') {
      return PLAYLISTS.map((p, i) => ({
        id: p.id,
        title: p.title,
        blurb: p.description,
        count: clipsFor(p).length,
        countLabel: `${clipsFor(p).length} clips · ${formatDuration(playlistDuration(p))}`,
        tint: p.color,
        featuredIndex: i,
        onOpen: () => setPlaylistId(p.id),
      }))
    }
    if (section === 'curatedLists') {
      return allLists(isReadable)
        .map((l, i) => {
          const count = deduped.filter(l.match).length
          return {
            id: l.id,
            title: l.title,
            blurb: l.blurb,
            count,
            countLabel: `${count} ${count === 1 ? 'book' : 'books'}`,
            tint: l.tint,
            featuredIndex: i,
            onOpen: () => setListId(l.id),
          }
        })
        .filter(l => l.count > 0)
    }
    if (section === 'collections') {
      return collections.map((c, i) => {
        const ts = Number(c.id.replace(/^col-/, ''))
        const addedAt = Number.isFinite(ts) ? ts : undefined
        return {
          id: c.id,
          title: c.name,
          blurb: addedAt ? `Created ${new Date(addedAt).toLocaleDateString()}` : undefined,
          count: c.bookIds.length,
          countLabel: `${c.bookIds.length} ${c.bookIds.length === 1 ? 'book' : 'books'}`,
          tint: CARD_TINTS[i % CARD_TINTS.length],
          addedAt,
          featuredIndex: i,
          onOpen: () => setCollectionId(c.id),
        }
      })
    }
    return []
  }, [section, deduped, isReadable, collections, setPlaylistId, setListId, setCollectionId])

  const sorted = useMemo(() => sortItems(items, sortKey, sortDir), [items, sortKey, sortDir])

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <button
        onClick={() => setView('home')}
        className="flex items-center gap-1 text-[12px] font-bold text-text-dim hover:text-accent-warm transition-colors mb-6"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">
          {meta.title}
        </h1>
        <IndexSortControl
          sortKey={sortKey}
          sortDir={sortDir}
          keys={meta.keys}
          onSetKey={handleSetKey}
          onToggleDir={toggleDir}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="text-text-muted text-sm">Nothing here yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(item => (
            <button key={item.id} onClick={item.onOpen} className="group text-left">
              <TintTile
                tint={item.tint}
                title={item.title}
                blurb={item.blurb}
                meta={item.countLabel}
                className="h-44"
                titleClass="text-xl"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function IndexSortControl({ sortKey, sortDir, keys, onSetKey, onToggleDir }: {
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  keys: SortKey[]
  onSetKey: (k: SortKey) => void
  onToggleDir: () => void
}) {
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

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-border-hover text-text-dim text-[12px] font-semibold hover:border-accent hover:text-text transition-colors"
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {KEY_LABEL[sortKey]}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <button
        onClick={onToggleDir}
        className="p-1.5 rounded-full border border-border-hover text-text-dim hover:border-accent hover:text-text transition-colors"
        title={`Reverse order — currently ${KEY_DIR_LABELS[sortKey][sortDir]}`}
        aria-label={`Reverse order, currently ${KEY_DIR_LABELS[sortKey][sortDir]}`}
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
              onClick={() => { onSetKey(k); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-left transition-colors ${
                sortKey === k
                  ? 'text-accent font-bold'
                  : 'text-text-dim hover:text-text hover:bg-bg-sunken/40'
              }`}
            >
              <span>{KEY_LABEL[k]}</span>
              {sortKey === k && (
                <span className="text-[10px] text-text-muted font-semibold">
                  {KEY_DIR_LABELS[k][sortDir]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
