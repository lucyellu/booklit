import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { useClips } from '../../context/ClipContext'
import { clipsFor, clipDuration, formatDuration, patternStyle } from '../../lib/clips'
import {
  SkipBack, Play, Pause, SkipForward, BookOpen, X, ListMusic,
} from 'lucide-react'

export function PlayerBar() {
  const { openReader, setPlaylistId } = useApp()
  const {
    book, currentChapter, currentPage, totalPages,
    isPlaying, togglePlayback, playbackSpeed, setPlaybackSpeed,
    goToPreviousPage, goToNextPage,
  } = useBook()
  const {
    playlist, clip, clipIndex, isClipPlaying, clipActive,
    toggleClip, nextClip, prevClip, stopClip,
  } = useClips()

  const hasBook = !!book && !!currentChapter

  /* A clip and a book can't narrate at once, so the bar shows whichever is
     loaded — the clip wins, because it's the more recent, more deliberate act. */
  const onClip = clipActive && !!clip && !!playlist
  const clipList = playlist ? clipsFor(playlist) : []

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.2, 1.5, 2.0]
    const idx = speeds.indexOf(playbackSpeed)
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length])
  }

  const playing = onClip ? isClipPlaying : isPlaying
  const canTransport = onClip || hasBook

  return (
    <div className="chrome h-[88px] flex items-center px-6 gap-6 flex-shrink-0">
      {/* Left: now playing */}
      <div
        className={`flex items-center gap-4 w-[260px] flex-shrink-0 ${
          onClip || hasBook ? 'cursor-pointer group' : ''
        }`}
        onClick={
          onClip ? () => setPlaylistId(playlist.id)
          : hasBook ? openReader
          : undefined
        }
      >
        <div
          className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden ${
            onClip ? '' : 'bg-chrome-elevated'
          }`}
          style={onClip ? patternStyle(playlist) : undefined}
        >
          {onClip
            ? <ListMusic className="w-5 h-5 text-white/85" />
            : <BookOpen className="w-5 h-5 text-on-chrome-dim" />}
        </div>
        <div className="min-w-0">
          {onClip ? (
            <>
              <p className="text-[13px] font-bold truncate text-on-chrome group-hover:underline">
                {clip.book}
              </p>
              <p className="text-[11.5px] truncate text-on-chrome-dim mt-0.5">
                {clip.author} · {playlist.title}
              </p>
            </>
          ) : hasBook ? (
            <>
              <p className="text-[13px] font-bold truncate text-on-chrome group-hover:underline">
                {book.title}
              </p>
              <p className="text-[11.5px] truncate text-on-chrome-dim mt-0.5">{book.author}</p>
            </>
          ) : (
            <p className="text-[12.5px] font-medium truncate text-on-chrome-dim">
              Select a book or a playlist to start
            </p>
          )}
        </div>
      </div>

      {/* Center: controls */}
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <button
            onClick={onClip ? prevClip : goToPreviousPage}
            disabled={!canTransport || (onClip && clipIndex === 0)}
            title={onClip ? 'Previous clip' : 'Previous page'}
            className="p-1.5 text-on-chrome-dim hover:text-on-chrome transition-colors disabled:opacity-30"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={onClip ? toggleClip : togglePlayback}
            disabled={!canTransport}
            title={playing ? 'Pause' : 'Play'}
            className="w-10 h-10 rounded-full bg-on-chrome flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-30 shadow-sm"
          >
            {playing
              ? <Pause className="w-5 h-5 text-chrome fill-current" />
              : <Play className="w-5 h-5 text-chrome fill-current ml-0.5" />
            }
          </button>
          <button
            onClick={onClip ? nextClip : goToNextPage}
            disabled={!canTransport || (onClip && clipIndex >= clipList.length - 1)}
            title={onClip ? 'Next clip' : 'Next page'}
            className="p-1.5 text-on-chrome-dim hover:text-on-chrome transition-colors disabled:opacity-30"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Progress. The synthesiser reports no playhead for a clip, so this
            counts tracks rather than faking a position inside one. */}
        <div className="w-full max-w-xl flex items-center gap-3">
          <span className="text-[10px] text-on-chrome-dim font-mono w-12 text-right">
            {onClip ? `${clipIndex + 1}/${clipList.length}` : hasBook ? currentPage : 0}
          </span>
          <div className="flex-1 h-1.5 bg-on-chrome-muted/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-vivid rounded-full transition-[width]"
              style={{
                width: onClip
                  ? `${((clipIndex + 1) / Math.max(1, clipList.length)) * 100}%`
                  : hasBook ? `${(currentPage / totalPages) * 100}%` : '0%',
              }}
            />
          </div>
          <span className="text-[10px] text-on-chrome-dim font-mono w-12">
            {onClip ? formatDuration(clipDuration(clip)) : hasBook ? totalPages : 0}
          </span>
        </div>
      </div>

      {/* Right: speed, and a way out of the playlist */}
      <div className="w-[260px] flex items-center justify-end gap-3 flex-shrink-0">
        {onClip && (
          <button
            onClick={stopClip}
            title="Stop playlist"
            aria-label="Stop playlist"
            className="p-1.5 rounded-lg text-on-chrome-muted hover:text-on-chrome hover:bg-chrome-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <span className="text-[10px] text-on-chrome-muted uppercase tracking-[0.14em] font-bold">
          Speed
        </span>
        <button
          onClick={cycleSpeed}
          title="Playback speed — a clip already speaking keeps its rate"
          className="text-[12px] text-on-chrome font-mono font-bold rounded-lg border border-on-chrome-muted/30 px-2.5 py-1 hover:border-on-chrome-dim hover:bg-chrome-elevated transition-colors"
        >
          {playbackSpeed}x
        </button>
      </div>
    </div>
  )
}
