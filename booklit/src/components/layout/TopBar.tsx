import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import {
  Search, PanelLeftClose, PanelLeft, Eye, EyeOff, Sun, Moon,
} from 'lucide-react'

const VIEW_MODES = [
  { id: 'css3d' as const, label: '3D' },
  { id: 'webgl' as const, label: 'GLB' },
  { id: 'flat' as const, label: 'Flat' },
]

export function TopBar() {
  const {
    sidebarOpen, toggleSidebar,
    uiVisible, toggleUI,
    libraryView, setLibraryView,
    searchQuery, setSearchQuery,
  } = useApp()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="h-16 flex items-center gap-4 px-8 bg-bg-elevated border-b border-border flex-shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg transition-colors"
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
      </button>

      {/* Search — a pill sunk into the ground colour, as in Forest Day */}
      <div className="w-72">
        <div className="flex items-center gap-2 rounded-full bg-bg px-4 py-2 focus-within:ring-1 focus-within:ring-accent transition-shadow">
          <Search className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search title, author…"
            className="bg-transparent outline-none text-sm text-text placeholder:text-text-muted w-full"
          />
        </div>
      </div>

      <div className="flex-1" />

      {/* Segmented view switcher */}
      <div className="flex items-center bg-bg rounded-full p-1 border border-border">
        {VIEW_MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setLibraryView(id)}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              libraryView === id
                ? 'bg-accent text-on-accent shadow-sm'
                : 'text-text-muted hover:text-text-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border-hover mx-1" />

      {/* Day / Evening */}
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg text-text-dim hover:text-accent-warm hover:bg-bg transition-colors"
        title={theme === 'day' ? 'Switch to Forest Evening' : 'Switch to Forest Day'}
      >
        {theme === 'day' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      {/* UI toggle */}
      <button
        onClick={toggleUI}
        className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg transition-colors"
        title={uiVisible ? 'Hide chrome' : 'Show chrome'}
      >
        {uiVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  )
}
