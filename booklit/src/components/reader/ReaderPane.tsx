import { useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { X } from 'lucide-react'

// Booklit hosts the Bibliophile Reader (reader-bolt) as an embedded iframe and
// hands it the parsed book over postMessage. The reader's dist lives in
// public/reader/ and is loaded with ?embed=1 so it hides its own library/auth UI.
export function ReaderPane() {
  const { view, closeReader } = useApp()
  const { book } = useBook()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const postBook = () => {
    if (book) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'booklit:load-book', book }, '*')
    }
  }

  // When the embedded reader announces it's ready, send the current book.
  useEffect(() => {
    if (view !== 'reader') return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'booklit:ready') postBook()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, book])

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
        onLoad={postBook}
      />
      {/* Host close button (the embedded reader hides its own library/back nav) */}
      <button
        onClick={closeReader}
        className="fixed top-4 left-4 z-[60] p-3 rounded-2xl bg-black/40 text-white/90 hover:bg-black/60 backdrop-blur-xl border border-white/10 transition-colors"
        title="Back to library (Esc)"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
