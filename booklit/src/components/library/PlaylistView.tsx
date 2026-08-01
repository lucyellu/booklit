import { useApp } from '../../context/AppContext'
import { useClips } from '../../context/ClipContext'
import {
  PLAYLISTS, clipsFor, clipDuration, playlistDuration, formatDuration, patternStyle,
} from '../../lib/clips'
import type { Playlist } from '../../lib/clips'
import { ChevronLeft, Play, Pause, ListMusic } from 'lucide-react'

/**
 * One clip playlist: the header card, then the track list.
 *
 * A playlist holds excerpts rather than books, so this is a screen of its own
 * and not another library filter — there is nothing here to sort by "date
 * added" or to open in the reader.
 */
export function PlaylistView() {
  const { playlistId, setPlaylistId } = useApp()
  const {
    playlist: activePl, clipIndex, isClipPlaying, clipActive,
    playPlaylist, playClipAt, toggleClip,
  } = useClips()

  const pl = PLAYLISTS.find(p => p.id === playlistId)
  if (!pl) return <PlaylistIndex />

  const clips = clipsFor(pl)
  const isThis = clipActive && activePl?.id === pl.id

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <button
        onClick={() => setPlaylistId(null)}
        className="flex items-center gap-1 text-[12px] font-bold text-text-dim hover:text-accent-warm transition-colors mb-6"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>

      <header className="flex items-end gap-6 mb-9">
        <div
          className="w-44 h-44 rounded-2xl shadow-md flex-shrink-0 flex items-end p-4"
          style={patternStyle(pl)}
        >
          <ListMusic className="w-6 h-6 text-white/80" />
        </div>
        <div className="min-w-0 pb-1">
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-accent-warm mb-2">
            Clip playlist
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-text leading-tight">
            {pl.title}
          </h1>
          <p className="text-text-dim text-[14px] mt-2 max-w-lg">{pl.description}</p>
          <p className="text-text-muted text-[12px] mt-2 font-mono">
            {clips.length} clips · {formatDuration(playlistDuration(pl))}
          </p>

          <button
            onClick={() => (isThis ? toggleClip() : playPlaylist(pl))}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent text-on-accent px-5 py-2 text-[13px] font-bold shadow-sm hover:brightness-110 transition"
          >
            {isThis && isClipPlaying
              ? <><Pause className="w-4 h-4 fill-current" /> Pause</>
              : <><Play className="w-4 h-4 fill-current" /> Play</>}
          </button>
        </div>
      </header>

      <ol className="flex flex-col gap-1">
        {clips.map((c, i) => {
          const current = isThis && clipIndex === i
          return (
            <li key={`${c.id}-${i}`}>
              <button
                onClick={() => (current ? toggleClip() : playClipAt(pl, i))}
                className={`w-full text-left flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                  current ? 'bg-bg-surface' : 'hover:bg-bg-surface/70'
                }`}
              >
                <span className="w-5 flex-shrink-0 flex items-center justify-center">
                  {current && isClipPlaying
                    ? <Pause className="w-3.5 h-3.5 text-accent fill-current" />
                    : current
                      ? <Play className="w-3.5 h-3.5 text-accent fill-current" />
                      : <span className="text-[12px] font-mono text-text-muted">{i + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13.5px] font-bold truncate ${
                    current ? 'text-accent' : 'text-text'
                  }`}>
                    {c.book}
                  </span>
                  <span className="block text-[11.5px] text-text-muted truncate mt-0.5">
                    {c.author} · {c.year}
                  </span>
                </span>
                <span className="hidden md:flex gap-1.5 flex-shrink-0">
                  {c.themes.slice(0, 3).map(t => (
                    <span
                      key={t}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-bg-sunken/60 text-text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </span>
                <span className="text-[11px] font-mono text-text-muted flex-shrink-0 w-10 text-right">
                  {formatDuration(clipDuration(c))}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Fallback when the id doesn't resolve — show them all rather than nothing. */
function PlaylistIndex() {
  const { setPlaylistId } = useApp()
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-3xl font-extrabold text-text mb-6">Playlists</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {PLAYLISTS.map(p => (
          <PlaylistCard key={p.id} playlist={p} onOpen={() => setPlaylistId(p.id)} />
        ))}
      </div>
    </div>
  )
}

/**
 * The square playlist card from bibli_009: flat colour, tiled motif, title in
 * the display italic. Shared by the index above and the Home rows.
 */
export function PlaylistCard({ playlist, onOpen }: {
  playlist: Playlist
  onOpen: () => void
}) {
  const { playPlaylist, playlist: activePl, isClipPlaying } = useClips()
  const clips = clipsFor(playlist)
  const playingThis = activePl?.id === playlist.id && isClipPlaying

  return (
    <div className="group relative w-40 flex-shrink-0">
      <button onClick={onOpen} className="w-full text-left">
        <div
          className="relative aspect-square rounded-xl shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1 overflow-hidden flex items-end p-3"
          style={patternStyle(playlist)}
        >
          <h3
            className="font-display italic text-[15px] leading-tight"
            style={{ color: playlist.lightColor, textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}
          >
            {playlist.title}
          </h3>
        </div>
        <p className="text-[10.5px] text-text-muted mt-1.5 font-mono">
          {clips.length} clips · {formatDuration(playlistDuration(playlist))}
        </p>
      </button>

      {/* Play straight from the card. A sibling of the card button, not a child
          — a <button> inside a <button> is invalid and swallows the click. */}
      <button
        onClick={() => playPlaylist(playlist)}
        title={`Play ${playlist.title}`}
        aria-label={`Play ${playlist.title}`}
        className={`absolute right-2 bottom-11 w-9 h-9 rounded-full bg-accent text-on-accent shadow-lg flex items-center justify-center transition-all hover:scale-105 ${
          playingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        {playingThis
          ? <Pause className="w-4 h-4 fill-current" />
          : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
    </div>
  )
}
