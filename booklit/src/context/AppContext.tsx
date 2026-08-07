import {
  createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react'
import type { ReactNode } from 'react'
import type { BookSource } from './BookContext'
import type { SortKey, SortDir } from '../lib/filterBooks'

export type ViewMode = 'home' | 'library' | 'reader' | 'playlist' | 'index'
/** A sidebar section browsable as its own screen, opened by clicking its header. */
export type IndexSection = 'playlists' | 'curatedLists' | 'collections'
export type LibraryViewMode = 'css3d' | 'webgl' | 'models' | 'flat'
export type LayoutMode = 'shelf' | 'grid' | 'cube' | 'sphere' | 'helix'
export type ShelfFilter =
  | 'all' | 'reading' | 'want' | 'read' | 'recent' | 'local'
  // Shelves the curated CSV actually uses, and the ones Forest Day's sidebar shows.
  | 'favorites' | 'recommended'
/** Availability filters from the Forest Day sidebar. */
export type AvailabilityFilter = 'playable' | 'ebook'
/** How a book is drawn in the grid / 3D scene. Ported from bookify. */
export type CardMode = 'cover' | 'spine' | 'art' | 'book3d'
/** The right panel shows one book, or the whole library as a list. */
export type RightPanelTab = 'details' | 'outline'
/**
 * How many books go on the stage at once. 'auto' is what the view can draw
 * comfortably; the numbers and 'all' are the override, for when you would
 * rather have the whole shelf in front of you than page through it.
 */
export type StageSize = 'auto' | 40 | 100 | 250 | 500 | 'all'
export type { SortKey, SortDir } from '../lib/filterBooks'

/** A user-made shelf. Holds book ids; persisted to localStorage. */
export interface Collection {
  id: string
  name: string
  bookIds: string[]
}

const COLLECTIONS_KEY = 'booklit-collections'
const SIDEBAR_WIDTH_KEY = 'booklit-sidebar-width'
const RIGHT_PANEL_WIDTH_KEY = 'booklit-right-panel-width'
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 420
const RIGHT_PANEL_MIN_WIDTH = 300
const RIGHT_PANEL_MAX_WIDTH = 640

function clampWidth(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function loadWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? clampWidth(n, min, max) : fallback
  } catch {
    return fallback
  }
}

interface AppState {
  view: ViewMode
  libraryView: LibraryViewMode
  layout: LayoutMode
  sidebarOpen: boolean
  /** Sidebar and right-panel widths, in px — dragged from their shared edge. */
  sidebarWidth: number
  rightPanelWidth: number
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
  /** Id of the active curated list, or null. */
  listId: string | null
  /** Id of the open clip playlist, or null. */
  playlistId: string | null
  /** Which section's overview screen is open, when view is 'index'. */
  indexSection: IndexSection | null
  /** How grid cards are drawn. */
  cardMode: CardMode
  /** Library sort order. */
  sortKey: SortKey
  sortDir: SortDir
  /** Book whose detail panel is open, or null. */
  detailBookId: string | null
  /** Right panel: expanded, or collapsed to its rail of tab icons. */
  rightPanelOpen: boolean
  rightPanelTab: RightPanelTab
  /**
   * The outliner's own search and sort. Deliberately separate from the
   * library's: the point of the list is to reach a book the stage isn't
   * currently sorted or searched to show, which it can't do if changing it
   * re-shuffles the stage underneath you.
   */
  outlineQuery: string
  outlineSortKey: SortKey
  outlineSortDir: SortDir
  /** How many books a page holds. */
  stageSize: StageSize
  /**
   * Columns for the 3D layouts, and rows per slab for the cube. 0 means "shape
   * it from the window", which is the default and is right most of the time —
   * these are here for when you want the shelf to line up a particular way.
   */
  gridCols: number
  gridRows: number
}

interface AppContextValue extends AppState {
  collections: Collection[]
  setView: (v: ViewMode) => void
  setLibraryView: (v: LibraryViewMode) => void
  setLayout: (l: LayoutMode) => void
  setGridCols: (n: number) => void
  setGridRows: (n: number) => void
  /** Both accept a plain width or a `prev => next` updater, so a drag handle
   *  can apply a delta without racing its own last write. */
  setSidebarWidth: (w: number | ((prev: number) => number)) => void
  setRightPanelWidth: (w: number | ((prev: number) => number)) => void
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
  setListId: (id: string | null) => void
  setPlaylistId: (id: string | null) => void
  openIndex: (section: IndexSection) => void
  setCardMode: (m: CardMode) => void
  setSortKey: (k: SortKey) => void
  toggleSortDir: () => void
  openDetail: (bookId: string) => void
  closeDetail: () => void
  createCollection: (name: string) => void
  deleteCollection: (id: string) => void
  toggleBookInCollection: (collectionId: string, bookId: string) => void
  toggleRightPanel: () => void
  setRightPanelTab: (t: RightPanelTab) => void
  setOutlineQuery: (q: string) => void
  setOutlineSortKey: (k: SortKey) => void
  toggleOutlineSortDir: () => void
  setStageSize: (s: StageSize) => void
  /** The active 3D scene wires itself in here so the 'F' key and the detail
   *  panel's Focus button — both outside the scene — can reach its camera.
   *  Pass a book id to focus that book instead of the current selection: the
   *  outliner selects and focuses in one go, and the selection it just made
   *  hasn't reached the scene yet.
   *
   *  Returns whether the camera actually went anywhere: false means no scene is
   *  mounted, or it hasn't built that book yet, which is the caller's cue to
   *  try again rather than assume it worked. */
  registerFocusHandler: (fn: ((bookId?: string | null) => boolean) | null) => void
  requestFocus: (bookId?: string | null) => boolean
  /** Same wiring as the focus handler, but for a hard reset: clear the
   *  selection and force the camera back to frame the whole arrangement,
   *  even if panning/zooming away didn't itself count as a layout change. */
  registerResetHandler: (fn: (() => void) | null) => void
  requestReset: () => void
  /** Put a book on the stage and snap the camera to it, paging there first if
   *  it isn't on the current page. Registered by the library, because only it
   *  knows the filtered order the pages are cut from. */
  registerRevealHandler: (fn: ((bookId: string) => void) | null) => void
  requestReveal: (bookId: string) => void
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
  const [state, setState] = useState<AppState>(() => ({
    view: 'home',
    libraryView: 'flat',
    layout: 'grid',
    sidebarOpen: true,
    sidebarWidth: loadWidth(SIDEBAR_WIDTH_KEY, 240, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH),
    rightPanelWidth: loadWidth(RIGHT_PANEL_WIDTH_KEY, 360, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH),
    uiVisible: true,
    shelfFilter: 'all',
    searchQuery: '',
    settingsOpen: false,
    readableOnly: false,
    availability: [],
    librarySource: null,
    collectionId: null,
    listId: null,
    playlistId: null,
    indexSection: null,
    cardMode: 'cover',
    sortKey: 'default',
    sortDir: 'asc',
    detailBookId: null,
    rightPanelOpen: true,
    rightPanelTab: 'details',
    outlineQuery: '',
    outlineSortKey: 'title',
    outlineSortDir: 'asc',
    stageSize: 'auto',
    gridCols: 0,
    gridRows: 0,
  }))
  const [collections, setCollections] = useState<Collection[]>(loadCollections)
  // Plain refs, not state — only one scene is ever mounted at a time and a
  // camera jump shouldn't trigger a re-render of anything outside the scene.
  const focusHandlerRef = useRef<((bookId?: string | null) => boolean) | null>(null)
  const registerFocusHandler = useCallback((fn: ((bookId?: string | null) => boolean) | null) => {
    focusHandlerRef.current = fn
  }, [])
  const requestFocus = useCallback(
    (bookId?: string | null) => focusHandlerRef.current?.(bookId) ?? false,
    [],
  )

  const resetHandlerRef = useRef<(() => void) | null>(null)
  const registerResetHandler = useCallback((fn: (() => void) | null) => {
    resetHandlerRef.current = fn
  }, [])
  const requestReset = useCallback(() => { resetHandlerRef.current?.() }, [])

  const revealHandlerRef = useRef<((bookId: string) => void) | null>(null)
  const registerRevealHandler = useCallback((fn: ((bookId: string) => void) | null) => {
    revealHandlerRef.current = fn
  }, [])
  const requestReveal = useCallback((bookId: string) => {
    revealHandlerRef.current?.(bookId)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
    } catch { /* quota */ }
  }, [collections])

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(state.sidebarWidth)) } catch { /* quota */ }
  }, [state.sidebarWidth])
  useEffect(() => {
    try { localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(state.rightPanelWidth)) } catch { /* quota */ }
  }, [state.rightPanelWidth])

  const setView = useCallback((view: ViewMode) =>
    setState(s => ({ ...s, view })), [])
  const setLibraryView = useCallback((libraryView: LibraryViewMode) =>
    setState(s => ({ ...s, libraryView })), [])
  const setLayout = useCallback((layout: LayoutMode) =>
    setState(s => ({ ...s, layout })), [])
  // Clamped here rather than at the slider, so nothing can put the scene into a
  // hundred-column arrangement by writing to the context directly.
  const setGridCols = useCallback((n: number) =>
    setState(s => ({ ...s, gridCols: Math.max(0, Math.min(40, Math.round(n) || 0)) })), [])
  const setGridRows = useCallback((n: number) =>
    setState(s => ({ ...s, gridRows: Math.max(0, Math.min(24, Math.round(n) || 0)) })), [])
  const toggleSidebar = useCallback(() =>
    setState(s => ({ ...s, sidebarOpen: !s.sidebarOpen })), [])
  const setSidebarWidth = useCallback((w: number | ((prev: number) => number)) =>
    setState(s => ({
      ...s,
      sidebarWidth: clampWidth(
        typeof w === 'function' ? w(s.sidebarWidth) : w, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH,
      ),
    })), [])
  const setRightPanelWidth = useCallback((w: number | ((prev: number) => number)) =>
    setState(s => ({
      ...s,
      rightPanelWidth: clampWidth(
        typeof w === 'function' ? w(s.rightPanelWidth) : w, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH,
      ),
    })), [])
  const toggleUI = useCallback(() =>
    setState(s => ({ ...s, uiVisible: !s.uiVisible })), [])
  // The detail panel is docked in the shell, which the reader covers, so the
  // selection is left alone: closing the reader puts you back on the book you
  // were looking at.
  const openReader = useCallback(() =>
    setState(s => ({ ...s, view: 'reader' })), [])
  const closeReader = useCallback(() =>
    setState(s => ({ ...s, view: 'library' })), [])
  const setSearchQuery = useCallback((searchQuery: string) =>
    setState(s => ({ ...s, searchQuery })), [])
  const setSettingsOpen = useCallback((settingsOpen: boolean) =>
    setState(s => ({ ...s, settingsOpen })), [])
  const setReadableOnly = useCallback((readableOnly: boolean) =>
    setState(s => ({ ...s, readableOnly })), [])

  // Shelf, collection and curated list are three ways of naming *one* place, so
  // picking any of them clears the other two — otherwise "Favorites" and "Tech
  // Canon" would silently intersect and the sidebar counts would lie. Source and
  // availability are separate facets and deliberately survive the switch.
  const setShelfFilter = useCallback((shelfFilter: ShelfFilter) =>
    setState(s => ({ ...s, shelfFilter, collectionId: null, listId: null, view: 'library' })), [])
  const setLibrarySource = useCallback((librarySource: BookSource | null) =>
    setState(s => ({ ...s, librarySource, view: 'library' })), [])
  const setCollectionId = useCallback((collectionId: string | null) =>
    setState(s => ({ ...s, collectionId, listId: null, shelfFilter: 'all', view: 'library' })), [])
  const setListId = useCallback((listId: string | null) =>
    setState(s => ({ ...s, listId, collectionId: null, shelfFilter: 'all', view: 'library' })), [])

  /* A clip playlist is a screen of its own rather than a library filter — it
     holds excerpts, not books you own. Closing one returns you to Home. */
  const setPlaylistId = useCallback((playlistId: string | null) =>
    setState(s => ({ ...s, playlistId, view: playlistId ? 'playlist' : 'home' })), [])

  /* A section header opens that section's own overview screen — all its items
     at once, sortable — distinct from picking one item off the sidebar. Any
     single-item selection is cleared so its row doesn't stay highlighted
     while a different screen is open. */
  const openIndex = useCallback((indexSection: IndexSection) =>
    setState(s => ({
      ...s, view: 'index', indexSection, playlistId: null, listId: null, collectionId: null,
    })), [])

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

  /* Selecting a book deliberately does *not* open the panel or change its tab.
     Collapsing it is a decision to have the stage to yourself, and the outliner
     is somewhere you work — neither should be overridden by a click on a book.
     The rail marks the Details tab when there's a selection waiting in it. */
  const toggleRightPanel = useCallback(() =>
    setState(s => ({ ...s, rightPanelOpen: !s.rightPanelOpen })), [])
  const setRightPanelTab = useCallback((rightPanelTab: RightPanelTab) =>
    setState(s => ({ ...s, rightPanelTab, rightPanelOpen: true })), [])
  const setOutlineQuery = useCallback((outlineQuery: string) =>
    setState(s => ({ ...s, outlineQuery })), [])
  const setOutlineSortKey = useCallback((outlineSortKey: SortKey) =>
    setState(s => ({
      ...s,
      outlineSortKey,
      outlineSortDir:
        outlineSortKey === 'published' || outlineSortKey === 'added' || outlineSortKey === 'rating'
          ? 'desc'
          : 'asc',
    })), [])
  const toggleOutlineSortDir = useCallback(() =>
    setState(s => ({ ...s, outlineSortDir: s.outlineSortDir === 'asc' ? 'desc' : 'asc' })), [])
  const setStageSize = useCallback((stageSize: StageSize) =>
    setState(s => ({ ...s, stageSize })), [])

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
      setView, setLibraryView, setLayout, setGridCols, setGridRows,
      setSidebarWidth, setRightPanelWidth,
      toggleSidebar, toggleUI, openReader, closeReader,
      setShelfFilter, setSearchQuery, setSettingsOpen, setReadableOnly,
      toggleAvailability, setLibrarySource, setCollectionId, setListId, setPlaylistId, openIndex,
      setCardMode, setSortKey, toggleSortDir, openDetail, closeDetail,
      createCollection, deleteCollection, toggleBookInCollection,
      toggleRightPanel, setRightPanelTab,
      setOutlineQuery, setOutlineSortKey, toggleOutlineSortDir, setStageSize,
      registerFocusHandler, requestFocus,
      registerResetHandler, requestReset,
      registerRevealHandler, requestReveal,
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
