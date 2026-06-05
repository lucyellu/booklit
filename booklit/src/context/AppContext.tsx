import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export type ViewMode = 'library' | 'reader'
export type LibraryViewMode = 'css3d' | 'webgl' | 'flat'
export type LayoutMode = 'shelf' | 'grid' | 'sphere' | 'helix'

interface AppState {
  view: ViewMode
  libraryView: LibraryViewMode
  layout: LayoutMode
  colorScheme: number
  sidebarOpen: boolean
  uiVisible: boolean
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

  return (
    <AppContext.Provider value={{
      ...state,
      setView, setLibraryView, setLayout, setColorScheme,
      toggleSidebar, toggleUI, openReader, closeReader,
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
