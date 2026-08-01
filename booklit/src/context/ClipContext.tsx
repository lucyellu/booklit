import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useBook } from './BookContext'
import { clipsFor, findPlaylist } from '../lib/clips'
import type { Clip, Playlist } from '../lib/clips'

/**
 * Playback for clip playlists, ported from bibli_009's CLIP_STATE.
 *
 * Clips and books share one speech synthesiser, so they can't both be speaking:
 * starting a clip stops the book's narration through BookContext, and opening a
 * book stops the clip. That coupling is the reason this provider sits inside
 * BookProvider rather than beside it.
 */

interface ClipContextValue {
  playlist: Playlist | null
  clip: Clip | null
  clipIndex: number
  isClipPlaying: boolean
  /** True while a clip is loaded, whether speaking or paused. */
  clipActive: boolean
  playPlaylist: (pl: Playlist, startIndex?: number) => void
  playClipAt: (pl: Playlist, index: number) => void
  toggleClip: () => void
  nextClip: () => void
  prevClip: () => void
  stopClip: () => void
}

const ClipContext = createContext<ClipContextValue | null>(null)

export function ClipProvider({ children }: { children: ReactNode }) {
  const { stopPlayback, isPlaying, playbackSpeed, volume, selectedVoice } = useBook()

  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [clipIndex, setClipIndex] = useState(0)
  const [isClipPlaying, setIsClipPlaying] = useState(false)
  const [clipActive, setClipActive] = useState(false)

  /* Bumped on every stop or track change. An utterance that ends after its
     generation has passed is stale — without this, cancelling mid-clip fires
     onend and auto-advances to the next track. */
  const genRef = useRef(0)

  const playlist = findPlaylist(playlistId)
  const clips = playlist ? clipsFor(playlist) : []
  const clip = clips[clipIndex] ?? null

  // Latest speech settings, read at speak time so changing the speed mid-list
  // applies to the next clip without re-creating these callbacks.
  const voiceRef = useRef({ playbackSpeed, volume, selectedVoice })
  useEffect(() => {
    voiceRef.current = { playbackSpeed, volume, selectedVoice }
  }, [playbackSpeed, volume, selectedVoice])

  /* `speak` needs to schedule the *next* clip from inside onend, and the next
     clip's speak needs the same ability. A ref breaks that cycle. */
  const speakRef = useRef<(pl: Playlist, index: number) => void>(() => {})

  const speak = useCallback((pl: Playlist, index: number) => {
    const list = clipsFor(pl)
    const next = list[index]
    if (!next) return

    // One synthesiser: silence the book before taking it over.
    stopPlayback()
    speechSynthesis.cancel()
    const gen = ++genRef.current

    setPlaylistId(pl.id)
    setClipIndex(index)
    setClipActive(true)
    setIsClipPlaying(true)

    const { playbackSpeed: rate, volume: vol, selectedVoice: voice } = voiceRef.current
    const utt = new SpeechSynthesisUtterance(next.text)
    utt.rate = rate
    utt.volume = vol
    if (voice) {
      utt.voice = voice
    } else {
      const voices = speechSynthesis.getVoices()
      const preferred = voices.find(v => v.lang.includes('en-GB'))
        ?? voices.find(v => v.lang.startsWith('en'))
      if (preferred) utt.voice = preferred
    }

    utt.onend = () => {
      if (gen !== genRef.current) return
      if (index < list.length - 1) {
        speakRef.current(pl, index + 1)
      } else {
        // End of the playlist: keep the last clip on the player bar, stopped,
        // so it can be replayed without hunting for it again.
        setIsClipPlaying(false)
      }
    }
    utt.onerror = () => {
      if (gen !== genRef.current) return
      setIsClipPlaying(false)
    }

    speechSynthesis.speak(utt)
  }, [stopPlayback])

  useEffect(() => { speakRef.current = speak }, [speak])

  const playPlaylist = useCallback((pl: Playlist, startIndex = 0) => {
    speak(pl, startIndex)
  }, [speak])

  const playClipAt = useCallback((pl: Playlist, index: number) => {
    speak(pl, index)
  }, [speak])

  const stopClip = useCallback(() => {
    genRef.current++
    speechSynthesis.cancel()
    setIsClipPlaying(false)
    setClipActive(false)
  }, [])

  const toggleClip = useCallback(() => {
    if (!clipActive || !playlist) return
    if (isClipPlaying) {
      speechSynthesis.pause()
      setIsClipPlaying(false)
    } else if (speechSynthesis.paused) {
      speechSynthesis.resume()
      setIsClipPlaying(true)
    } else {
      // Nothing queued — the playlist ran to the end, so start this clip over.
      speak(playlist, clipIndex)
    }
  }, [clipActive, playlist, isClipPlaying, clipIndex, speak])

  const nextClip = useCallback(() => {
    if (!playlist) return
    const list = clipsFor(playlist)
    if (clipIndex < list.length - 1) speak(playlist, clipIndex + 1)
  }, [playlist, clipIndex, speak])

  const prevClip = useCallback(() => {
    if (!playlist) return
    if (clipIndex > 0) speak(playlist, clipIndex - 1)
  }, [playlist, clipIndex, speak])

  /* The other half of the exclusivity: `speak` silences the book, and this
     silences the clip when the book starts narrating. Edge-triggered, so a clip
     started while the book happens to be idle isn't immediately killed. */
  const bookWasPlaying = useRef(isPlaying)
  useEffect(() => {
    if (isPlaying && !bookWasPlaying.current && clipActive) stopClip()
    bookWasPlaying.current = isPlaying
  }, [isPlaying, clipActive, stopClip])

  // Leaving the page mid-clip otherwise keeps the browser talking.
  useEffect(() => () => { speechSynthesis.cancel() }, [])

  return (
    <ClipContext.Provider value={{
      playlist, clip, clipIndex, isClipPlaying, clipActive,
      playPlaylist, playClipAt, toggleClip, nextClip, prevClip, stopClip,
    }}>
      {children}
    </ClipContext.Provider>
  )
}

export function useClips() {
  const ctx = useContext(ClipContext)
  if (!ctx) throw new Error('useClips must be inside ClipProvider')
  return ctx
}
