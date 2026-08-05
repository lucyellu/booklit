import { useCallback, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { useProfiles } from '../../context/ProfileContext'
import { useTheme } from '../../context/ThemeContext'
import { bookKey } from '../../lib/profiles'
import { X } from 'lucide-react'

// Booklit hosts the Bibliophile Reader (reader-bolt) as an embedded iframe and
// hands it the parsed book over postMessage. The reader's dist lives in
// public/reader/ and is loaded with ?embed=1 so it hides its own library/auth UI.
export function ReaderPane() {
  const { view, closeReader } = useApp()
  const { book, updateReadingProgress } = useBook()
  const { overrides } = useProfiles()
  const { theme } = useTheme()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const postBook = () => {
    if (book) {
      // Resume where reading left off, if we have a saved position — the
      // iframe re-resolves this word offset to a page after its own
      // pagination, so it's exact even if font size/viewport differ from
      // last time.
      const lastPosition = overrides[bookKey(book.title, book.author)]?.lastPosition
      iframeRef.current?.contentWindow?.postMessage({
        type: 'booklit:load-book',
        book,
        startChapterIndex: lastPosition?.chapterIndex,
        startWordOffset: lastPosition?.wordOffset,
      }, '*')
    }
  }

  const postTheme = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'booklit:theme', theme }, '*')
  }, [theme])

  // When the embedded reader announces it's ready, send the current book and
  // the active theme. The theme has to be pushed on ready as well as on change,
  // or the reader keeps whatever prefers-color-scheme gave it at load. The
  // reader also reports back its position as the user reads, so we can
  // persist it and resume there next time.
  useEffect(() => {
    if (view !== 'reader') return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'booklit:ready') { postBook(); postTheme() }
      if (e.data?.type === 'booklit:progress') {
        const { chapterIndex, wordOffset } = e.data
        if (typeof chapterIndex === 'number' && typeof wordOffset === 'number') {
          updateReadingProgress(chapterIndex, wordOffset)
        }
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, book, postTheme, updateReadingProgress])

  // Follow the host theme live while the reader is open.
  useEffect(() => {
    if (view === 'reader') postTheme()
  }, [view, postTheme])

  // If the book changes while the reader is already open, push the new one.
  useEffect(() => {
    if (view === 'reader') postBook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, view])

  // Esc closes the reader from the host side.
  useEffect(() => {
    if (view !== 'reader') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeReader() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, closeReader])

  if (view !== 'reader' || !book) return null

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <iframe
        ref={iframeRef}
        src="/reader/index.html?embed=1"
        title="Booklit Reader"
        className="w-full h-full border-0"
        onLoad={() => { postBook(); postTheme() }}
      />
      {/* Host close button (the embedded reader hides its own library/back nav) */}
      <button
        onClick={closeReader}
        className="fixed top-4 left-4 z-[60] p-3 rounded-2xl bg-chrome text-on-chrome hover:bg-chrome-elevated border border-on-chrome-muted/25 shadow-md transition-colors"
        title="Back to library (Esc)"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
