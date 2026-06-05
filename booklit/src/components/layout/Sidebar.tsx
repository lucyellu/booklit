import { useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import {
  Library, BookOpen, BookMarked, Clock, Star,
  Upload, Settings, Grid3x3, Box, Circle, Dna,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'all', label: 'All Books', icon: Library },
  { id: 'reading', label: 'Reading Now', icon: BookOpen },
  { id: 'want', label: 'Want to Read', icon: BookMarked },
  { id: 'read', label: 'Read', icon: Star },
  { id: 'recent', label: 'Recent', icon: Clock },
] as const

const LAYOUT_ITEMS = [
  { id: 'grid' as const, label: 'Grid', icon: Grid3x3 },
  { id: 'shelf' as const, label: 'Shelf', icon: Box },
  { id: 'sphere' as const, label: 'Sphere', icon: Circle },
  { id: 'helix' as const, label: 'Helix', icon: Dna },
]

export function Sidebar() {
  const { layout, setLayout, libraryView, setLibraryView } = useApp()
  const { uploadFile } = useBook()
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="glass-panel h-full w-[240px] flex flex-col rounded-tr-xl rounded-br-xl overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-bg" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Booklit
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="py-3 border-b border-border">
        <div className="px-5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted">
          Library
        </div>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="w-full flex items-center gap-3 px-5 py-2 text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors text-[12.5px]"
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* View mode */}
      <div className="py-3 border-b border-border">
        <div className="px-5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted">
          View
        </div>
        <div className="px-4 flex gap-1">
          {(['css3d', 'webgl', 'flat'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setLibraryView(mode)}
              className={`flex-1 py-1.5 rounded text-[11px] font-medium uppercase tracking-wider transition-colors ${
                libraryView === mode
                  ? 'bg-bg-glass-active text-text'
                  : 'text-text-muted hover:text-text-dim'
              }`}
            >
              {mode === 'css3d' ? '3D' : mode === 'webgl' ? 'GLB' : 'Flat'}
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div className="py-3 border-b border-border">
        <div className="px-5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted">
          Layout
        </div>
        {LAYOUT_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setLayout(id)}
            className={`w-full flex items-center gap-3 px-5 py-2 text-[12.5px] transition-colors ${
              layout === id
                ? 'text-text bg-bg-glass-active'
                : 'text-text-dim hover:text-text hover:bg-bg-glass-hover'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="mt-auto py-3 border-t border-border">
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,.md,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 px-5 py-2 text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors text-[12.5px]"
        >
          <Upload className="w-4 h-4" />
          <span>Import Books</span>
        </button>
        <button className="w-full flex items-center gap-3 px-5 py-2 text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors text-[12.5px]">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
