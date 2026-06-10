import { useApp } from '../../context/AppContext'
import {
  Search, PanelLeftClose, PanelLeft, Eye, EyeOff,
} from 'lucide-react'
import { COLOR_SCHEMES } from '../background/ColorSchemes'

export function TopBar() {
  const {
    sidebarOpen, toggleSidebar,
    uiVisible, toggleUI,
    colorScheme, setColorScheme,
    searchQuery, setSearchQuery,
  } = useApp()

  return (
    <div className="h-[52px] flex items-center gap-4 px-5 border-b border-border flex-shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-md text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors"
      >
        {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="glass rounded-full flex items-center gap-2 px-4 py-1.5">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search your library..."
            className="bg-transparent outline-none text-[12.5px] text-text placeholder:text-text-muted w-full"
          />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Color scheme pills */}
      <div className="flex items-center gap-1.5">
        {COLOR_SCHEMES.map((scheme, i) => (
          <button
            key={i}
            onClick={() => setColorScheme(i)}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              colorScheme === i
                ? 'border-white/60 scale-110'
                : 'border-transparent hover:border-white/20'
            }`}
            style={{
              background: `linear-gradient(135deg, ${scheme.preview[0]}, ${scheme.preview[1]})`,
            }}
            title={scheme.name}
          />
        ))}
      </div>

      {/* UI toggle */}
      <button
        onClick={toggleUI}
        className="p-1.5 rounded-md text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors"
      >
        {uiVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  )
}
