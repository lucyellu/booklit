import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { CSS3DScene } from './CSS3DScene'
import type { LocalBook } from '../../context/BookContext'

export function LibraryView() {
  const { libraryView, openReader } = useApp()
  const { localBooks, setBook } = useBook()

  if (localBooks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight mb-4">Booklit</h1>
          <p className="text-text-dim text-sm max-w-md">
            Your library lives here. Import a Goodreads CSV or upload EPUBs to get started.
          </p>
        </div>
      </div>
    )
  }

  if (libraryView === 'css3d') {
    return <CSS3DScene />
  }

  if (libraryView === 'webgl') {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-muted text-sm">WebGL 3D model view — coming soon</p>
      </div>
    )
  }

  return <FlatGrid localBooks={localBooks} onOpen={(b) => { setBook(b); openReader() }} />
}

function FlatGrid({ localBooks, onOpen }: { localBooks: LocalBook[]; onOpen: (book: any) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Your Library</h2>
        <span className="text-[11px] text-text-muted">{localBooks.length} books</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4">
        {localBooks.map(lb => (
          <button
            key={lb.id}
            onClick={() => lb.bookData && onOpen(lb.bookData)}
            className="group text-left hover:scale-[1.03] transition-transform"
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-bg-glass-active shadow-lg">
              {lb.coverUrl ? (
                <img src={lb.coverUrl} alt={lb.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-surface to-bg-elevated">
                  <span className="font-display text-3xl text-text-muted">{lb.title.charAt(0)}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] font-medium text-text truncate leading-tight">{lb.title}</p>
            <p className="text-[10px] text-text-muted truncate">{lb.author || ''}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
