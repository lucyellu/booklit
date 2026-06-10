import { useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import {
  Library, BookOpen, BookMarked, Clock, Star,
  Upload, Settings, Grid3x3, Box, Circle, Dna, BookCopy, HardDrive, Check,
} from 'lucide-react'
import type { ShelfFilter } from '../../context/AppContext'

const NAV_ITEMS: { id: ShelfFilter; label: string; icon: typeof Library }[] = [
  { id: 'all', label: 'All Books', icon: Library },
  { id: 'reading', label: 'Reading Now', icon: BookOpen },
  { id: 'want', label: 'Want to Read', icon: BookMarked },
  { id: 'read', label: 'Read', icon: Star },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'local', label: 'Local Library', icon: HardDrive },
]

const LAYOUT_ITEMS = [
  { id: 'grid' as const, label: 'Grid', icon: Grid3x3 },
  { id: 'shelf' as const, label: 'Shelf', icon: Box },
  { id: 'sphere' as const, label: 'Sphere', icon: Circle },
  { id: 'helix' as const, label: 'Helix', icon: Dna },
]

export function Sidebar() {
  const {
    layout, setLayout, libraryView, setLibraryView,
    shelfFilter, setShelfFilter, setSettingsOpen,
    readableOnly, setReadableOnly,
  } = useApp()
  const { uploadFile, importGoodreads, importLocalLibrary } = useBook()
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
            onClick={() => setShelfFilter(id)}
            className={`w-full flex items-center gap-3 px-5 py-2 transition-colors text-[12.5px] ${
              shelfFilter === id
                ? 'text-text bg-bg-glass-active'
                : 'text-text-dim hover:text-text hover:bg-bg-glass-hover'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}

        {/* Readable-only toggle */}
        <button
          onClick={() => setReadableOnly(!readableOnly)}
          className="w-full flex items-center gap-3 px-5 py-2 mt-1 text-[12.5px] text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors"
        >
          <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center ${
            readableOnly ? 'bg-accent border-accent' : 'border-border-hover'
          }`}>
            {readableOnly && <Check className="w-3 h-3 text-bg" />}
          </span>
          <span>Readable only</span>
        </button>
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
        <button
          onClick={handleGoodreads}
          className="w-full flex items-center gap-3 px-5 py-2 text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors text-[12.5px]"
        >
          <BookCopy className="w-4 h-4" />
          <span>Connect Goodreads</span>
        </button>
        <button
          onClick={handleScanLocal}
          className="w-full flex items-center gap-3 px-5 py-2 text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors text-[12.5px]"
        >
          <HardDrive className="w-4 h-4" />
          <span>Rescan Local Folder</span>
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-2 text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors text-[12.5px]"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
