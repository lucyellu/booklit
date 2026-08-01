import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import {
  SkipBack, Play, Pause, SkipForward, BookOpen,
} from 'lucide-react'

export function PlayerBar() {
  const { openReader } = useApp()
  const {
    book, currentChapter, currentPage, totalPages,
    isPlaying, togglePlayback, playbackSpeed, setPlaybackSpeed,
    goToPreviousPage, goToNextPage,
  } = useBook()

  const hasBook = !!book && !!currentChapter

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.2, 1.5, 2.0]
    const idx = speeds.indexOf(playbackSpeed)
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length])
  }

  return (
    <div className="chrome h-[88px] flex items-center px-6 gap-6 flex-shrink-0">
      {/* Left: now playing */}
      <div
        className={`flex items-center gap-4 w-[260px] flex-shrink-0 ${hasBook ? 'cursor-pointer group' : ''}`}
        onClick={hasBook ? openReader : undefined}
      >
        <div className="w-14 h-14 rounded-lg bg-chrome-elevated flex items-center justify-center flex-shrink-0 shadow-sm">
          <BookOpen className="w-5 h-5 text-on-chrome-dim" />
        </div>
        <div className="min-w-0">
          {hasBook ? (
            <>
              <p className="text-[13px] font-bold truncate text-on-chrome group-hover:underline">
                {book.title}
              </p>
              <p className="text-[11.5px] truncate text-on-chrome-dim mt-0.5">{book.author}</p>
            </>
          ) : (
            <p className="text-[12.5px] font-medium truncate text-on-chrome-dim">
              Select a book to start reading
            </p>
          )}
        </div>
      </div>

      {/* Center: controls */}
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <button
            onClick={goToPreviousPage}
            disabled={!hasBook}
            className="p-1.5 text-on-chrome-dim hover:text-on-chrome transition-colors disabled:opacity-30"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={togglePlayback}
            disabled={!hasBook}
            className="w-10 h-10 rounded-full bg-on-chrome flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-30 shadow-sm"
          >
            {isPlaying
              ? <Pause className="w-5 h-5 text-chrome fill-current" />
              : <Play className="w-5 h-5 text-chrome fill-current ml-0.5" />
            }
          </button>
          <button
            onClick={goToNextPage}
            disabled={!hasBook}
            className="p-1.5 text-on-chrome-dim hover:text-on-chrome transition-colors disabled:opacity-30"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Progress */}
        <div className="w-full max-w-xl flex items-center gap-3">
          <span className="text-[10px] text-on-chrome-dim font-mono w-10 text-right">
            {hasBook ? currentPage : 0}
          </span>
          <div className="flex-1 h-1.5 bg-on-chrome-muted/25 rounded-full overflow-hidden group cursor-pointer">
            <div
              className="h-full bg-accent-vivid rounded-full transition-[width]"
              style={{ width: hasBook ? `${(currentPage / totalPages) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] text-on-chrome-dim font-mono w-10">
            {hasBook ? totalPages : 0}
          </span>
        </div>
      </div>

      {/* Right: speed */}
      <div className="w-[260px] flex items-center justify-end gap-3 flex-shrink-0">
        <span className="text-[10px] text-on-chrome-muted uppercase tracking-[0.14em] font-bold">
          Speed
        </span>
        <button
          onClick={cycleSpeed}
          className="text-[12px] text-on-chrome font-mono font-bold rounded-lg border border-on-chrome-muted/30 px-2.5 py-1 hover:border-on-chrome-dim hover:bg-chrome-elevated transition-colors"
        >
          {playbackSpeed}x
        </button>
      </div>
    </div>
  )
}
