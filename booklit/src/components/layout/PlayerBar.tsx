import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import {
  SkipBack, Play, Pause, SkipForward,
} from 'lucide-react'

export function PlayerBar() {
  const { openReader } = useApp()
  const {
    book, currentChapter, currentPage, totalPages,
    isPlaying, togglePlayback, playbackSpeed, setPlaybackSpeed,
    goToPreviousPage, goToNextPage,
  } = useBook()

  const hasBook = !!book && !!currentChapter
  const pageText = hasBook ? currentChapter.content[currentPage - 1] : ''
  const previewText = pageText ? pageText.substring(0, 60) + (pageText.length > 60 ? '...' : '') : ''

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.2, 1.5, 2.0]
    const idx = speeds.indexOf(playbackSpeed)
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length])
  }

  return (
    <div className="h-[88px] glass-panel flex items-center px-5 gap-6 flex-shrink-0 border-t border-border">
      {/* Left: now playing */}
      <div
        className={`flex items-center gap-3 w-[220px] flex-shrink-0 ${hasBook ? 'cursor-pointer' : ''}`}
        onClick={hasBook ? openReader : undefined}
      >
        <div className="w-[52px] h-[52px] rounded-md bg-bg-glass flex items-center justify-center text-xl flex-shrink-0">
          <span className="text-text-muted">&#x1F4D6;</span>
        </div>
        <div className="min-w-0">
          {hasBook ? (
            <>
              <p className="text-[12.5px] font-medium truncate text-text">{book.title}</p>
              <p className="text-[11px] truncate text-text-muted">{book.author}</p>
            </>
          ) : (
            <p className="text-[12.5px] font-medium truncate text-text-dim">
              Select a book to start reading
            </p>
          )}
        </div>
      </div>

      {/* Center: controls */}
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousPage}
            disabled={!hasBook}
            className="p-1.5 text-text-dim hover:text-text transition-colors disabled:opacity-30"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlayback}
            disabled={!hasBook}
            className="w-9 h-9 rounded-full bg-text flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-30"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 text-bg" />
              : <Play className="w-4 h-4 text-bg ml-0.5" />
            }
          </button>
          <button
            onClick={goToNextPage}
            disabled={!hasBook}
            className="p-1.5 text-text-dim hover:text-text transition-colors disabled:opacity-30"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-lg flex items-center gap-2">
          <span className="text-[10px] text-text-muted font-mono w-10 text-right">
            {hasBook ? currentPage : 0}
          </span>
          <div className="flex-1 h-1 bg-bg-glass-active rounded-full overflow-hidden group cursor-pointer">
            <div
              className="h-full bg-text-dim rounded-full group-hover:bg-accent transition-colors"
              style={{ width: hasBook ? `${(currentPage / totalPages) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] text-text-muted font-mono w-10">
            {hasBook ? totalPages : 0}
          </span>
        </div>
      </div>

      {/* Right: speed */}
      <div className="w-[220px] flex items-center justify-end gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Speed</span>
          <button
            onClick={cycleSpeed}
            className="text-[12px] text-text-dim font-mono bg-bg-glass rounded px-2 py-0.5 hover:bg-bg-glass-hover transition-colors"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  )
}
