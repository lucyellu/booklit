import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export type ViewMode = 'library' | 'reader'
export type LibraryViewMode = 'css3d' | 'webgl' | 'flat'
export type LayoutMode = 'shelf' | 'grid' | 'sphere' | 'helix'
export type ShelfFilter = 'all' | 'reading' | 'want' | 'read' | 'recent' | 'local'

interface AppState {
  view: ViewMode
  libraryView: LibraryViewMode
  layout: LayoutMode
  colorScheme: number
  sidebarOpen: boolean
  uiVisible: boolean
  shelfFilter: ShelfFilter
  searchQuery: string
  /** Global animation speed multiplier for the liquid-gradient background (0–1). */
  gradientSpeed: number
  settingsOpen: boolean
}

interface AppContextValue extends AppState {
  setView: (v: ViewMode) => void
  setLibraryView: (v: LibraryViewMode) => void
  setLayout: (l: LayoutMode) => void
  setColorScheme: (s: number) => void
  toggleSidebar: () => void
  toggleUI: () => void
  openReader: () => void
  closeReader: () => void
  setShelfFilter: (f: ShelfFilter) => void
  setSearchQuery: (q: string) => void
  setGradientSpeed: (s: number) => void
  setSettingsOpen: (open: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    view: 'library',
    libraryView: 'css3d',
    layout: 'grid',
    colorScheme: 0,
    sidebarOpen: true,
    uiVisible: true,
    shelfFilter: 'all',
    searchQuery: '',
    gradientSpeed: 0.1,
    settingsOpen: false,
  })

  const setView = useCallback((view: ViewMode) =>
    setState(s => ({ ...s, view })), [])
  const setLibraryView = useCallback((libraryView: LibraryViewMode) =>
    setState(s => ({ ...s, libraryView })), [])
  const setLayout = useCallback((layout: LayoutMode) =>
    setState(s => ({ ...s, layout })), [])
  const setColorScheme = useCallback((colorScheme: number) =>
    setState(s => ({ ...s, colorScheme })), [])
  const toggleSidebar = useCallback(() =>
    setState(s => ({ ...s, sidebarOpen: !s.sidebarOpen })), [])
  const toggleUI = useCallback(() =>
    setState(s => ({ ...s, uiVisible: !s.uiVisible })), [])
  const openReader = useCallback(() =>
    setState(s => ({ ...s, view: 'reader' })), [])
  const closeReader = useCallback(() =>
    setState(s => ({ ...s, view: 'library' })), [])
  const setShelfFilter = useCallback((shelfFilter: ShelfFilter) =>
    setState(s => ({ ...s, shelfFilter })), [])
  const setSearchQuery = useCallback((searchQuery: string) =>
    setState(s => ({ ...s, searchQuery })), [])
  const setGradientSpeed = useCallback((gradientSpeed: number) =>
    setState(s => ({ ...s, gradientSpeed })), [])
  const setSettingsOpen = useCallback((settingsOpen: boolean) =>
    setState(s => ({ ...s, settingsOpen })), [])

  return (
    <AppContext.Provider value={{
      ...state,
      setView, setLibraryView, setLayout, setColorScheme,
      toggleSidebar, toggleUI, openReader, closeReader,
      setShelfFilter, setSearchQuery, setGradientSpeed, setSettingsOpen,
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
