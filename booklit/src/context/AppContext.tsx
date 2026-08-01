import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { BookSource } from './BookContext'
import type { SortKey, SortDir } from '../lib/filterBooks'

export type ViewMode = 'home' | 'library' | 'reader'
export type LibraryViewMode = 'css3d' | 'webgl' | 'flat'
export type LayoutMode = 'shelf' | 'grid' | 'sphere' | 'helix'
export type ShelfFilter =
  | 'all' | 'reading' | 'want' | 'read' | 'recent' | 'local'
  // Shelves the curated CSV actually uses, and the ones Forest Day's sidebar shows.
  | 'favorites' | 'recommended'
/** Availability filters from the Forest Day sidebar. */
export type AvailabilityFilter = 'playable' | 'ebook'
/** How a book is drawn in the grid / 3D scene. Ported from bookify. */
export type CardMode = 'cover' | 'spine' | 'art' | 'book3d'
export type { SortKey, SortDir } from '../lib/filterBooks'

/** A user-made shelf. Holds book ids; persisted to localStorage. */
export interface Collection {
  id: string
  name: string
  bookIds: string[]
}

const COLLECTIONS_KEY = 'booklit-collections'

interface AppState {
  view: ViewMode
  libraryView: LibraryViewMode
  layout: LayoutMode
  sidebarOpen: boolean
  uiVisible: boolean
  shelfFilter: ShelfFilter
  searchQuery: string
  settingsOpen: boolean
  /** When true, only show books that can be opened in the in-app reader. */
  readableOnly: boolean
  /** Active availability filters — empty means no constraint. */
  availability: AvailabilityFilter[]
  /** Restrict the grid to one ingest source, or null for all. */
  librarySource: BookSource | null
  /** Id of the active user collection, or null. */
  collectionId: string | null
  /** How grid cards are drawn. */
  cardMode: CardMode
  /** Library sort order. */
  sortKey: SortKey
  sortDir: SortDir
  /** Book whose detail panel is open, or null. */
  detailBookId: string | null
}

interface AppContextValue extends AppState {
  collections: Collection[]
  setView: (v: ViewMode) => void
  setLibraryView: (v: LibraryViewMode) => void
  setLayout: (l: LayoutMode) => void
  toggleSidebar: () => void
  toggleUI: () => void
  openReader: () => void
  closeReader: () => void
  setShelfFilter: (f: ShelfFilter) => void
  setSearchQuery: (q: string) => void
  setSettingsOpen: (open: boolean) => void
  setReadableOnly: (v: boolean) => void
  toggleAvailability: (f: AvailabilityFilter) => void
  setLibrarySource: (s: BookSource | null) => void
  setCollectionId: (id: string | null) => void
  setCardMode: (m: CardMode) => void
  setSortKey: (k: SortKey) => void
  toggleSortDir: () => void
  openDetail: (bookId: string) => void
  closeDetail: () => void
  createCollection: (name: string) => void
  deleteCollection: (id: string) => void
  toggleBookInCollection: (collectionId: string, bookId: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    view: 'home',
    libraryView: 'flat',
    layout: 'grid',
    sidebarOpen: true,
    uiVisible: true,
    shelfFilter: 'all',
    searchQuery: '',
    settingsOpen: false,
    readableOnly: false,
    availability: [],
    librarySource: null,
    collectionId: null,
    cardMode: 'cover',
    sortKey: 'default',
    sortDir: 'asc',
    detailBookId: null,
  })
  const [collections, setCollections] = useState<Collection[]>(loadCollections)

  useEffect(() => {
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
    } catch { /* quota */ }
  }, [collections])

  const setView = useCallback((view: ViewMode) =>
    setState(s => ({ ...s, view })), [])
  const setLibraryView = useCallback((libraryView: LibraryViewMode) =>
    setState(s => ({ ...s, libraryView })), [])
  const setLayout = useCallback((layout: LayoutMode) =>
    setState(s => ({ ...s, layout })), [])
  const toggleSidebar = useCallback(() =>
    setState(s => ({ ...s, sidebarOpen: !s.sidebarOpen })), [])
  const toggleUI = useCallback(() =>
    setState(s => ({ ...s, uiVisible: !s.uiVisible })), [])
  // Opening the reader always dismisses the detail panel — otherwise it stays
  // parked over the reader, since it's portalled to <body> and outside the shell.
  const openReader = useCallback(() =>
    setState(s => ({ ...s, view: 'reader', detailBookId: null })), [])
  const closeReader = useCallback(() =>
    setState(s => ({ ...s, view: 'library' })), [])
  const setSearchQuery = useCallback((searchQuery: string) =>
    setState(s => ({ ...s, searchQuery })), [])
  const setSettingsOpen = useCallback((settingsOpen: boolean) =>
    setState(s => ({ ...s, settingsOpen })), [])
  const setReadableOnly = useCallback((readableOnly: boolean) =>
    setState(s => ({ ...s, readableOnly })), [])

  // Picking a shelf, a source or a collection always lands you on the grid,
  // and clears whichever of the other two would otherwise fight it.
  const setShelfFilter = useCallback((shelfFilter: ShelfFilter) =>
    setState(s => ({ ...s, shelfFilter, collectionId: null, view: 'library' })), [])
  const setLibrarySource = useCallback((librarySource: BookSource | null) =>
    setState(s => ({ ...s, librarySource, view: 'library' })), [])
  const setCollectionId = useCallback((collectionId: string | null) =>
    setState(s => ({ ...s, collectionId, shelfFilter: 'all', view: 'library' })), [])

  const setCardMode = useCallback((cardMode: CardMode) =>
    setState(s => ({ ...s, cardMode })), [])

  // Picking a key resets the direction to that key's natural one: A→Z for text,
  // newest-first for dates and highest-first for ratings, which is what you
  // almost always want on the first click.
  const setSortKey = useCallback((sortKey: SortKey) =>
    setState(s => ({
      ...s,
      sortKey,
      sortDir: sortKey === 'published' || sortKey === 'added' || sortKey === 'rating'
        ? 'desc'
        : 'asc',
    })), [])
  const toggleSortDir = useCallback(() =>
    setState(s => ({ ...s, sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })), [])
  const openDetail = useCallback((detailBookId: string) =>
    setState(s => ({ ...s, detailBookId })), [])
  const closeDetail = useCallback(() =>
    setState(s => ({ ...s, detailBookId: null })), [])

  const toggleAvailability = useCallback((f: AvailabilityFilter) =>
    setState(s => ({
      ...s,
      view: 'library',
      availability: s.availability.includes(f)
        ? s.availability.filter(a => a !== f)
        : [...s.availability, f],
    })), [])

  const createCollection = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCollections(prev => [
      ...prev,
      { id: `col-${Date.now()}`, name: trimmed, bookIds: [] },
    ])
  }, [])

  const deleteCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id))
    setState(s => (s.collectionId === id ? { ...s, collectionId: null } : s))
  }, [])

  const toggleBookInCollection = useCallback((collectionId: string, bookId: string) => {
    setCollections(prev => prev.map(c => {
      if (c.id !== collectionId) return c
      const has = c.bookIds.includes(bookId)
      return {
        ...c,
        bookIds: has ? c.bookIds.filter(b => b !== bookId) : [...c.bookIds, bookId],
      }
    }))
  }, [])

  return (
    <AppContext.Provider value={{
      ...state,
      collections,
      setView, setLibraryView, setLayout,
      toggleSidebar, toggleUI, openReader, closeReader,
      setShelfFilter, setSearchQuery, setSettingsOpen, setReadableOnly,
      toggleAvailability, setLibrarySource, setCollectionId,
      setCardMode, setSortKey, toggleSortDir, openDetail, closeDetail,
      createCollection, deleteCollection, toggleBookInCollection,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
