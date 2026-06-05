import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { KaraokeHighlighter } from './KaraokeHighlighter'
import {
  X, ChevronLeft, ChevronRight, Bookmark, List,
} from 'lucide-react'

export function ReaderPane() {
  const { view, closeReader } = useApp()
  const {
    book, currentChapter, currentChapterIndex, currentPage, totalPages,
    highlightedWordIndex, readWordIndices, highlightColor,
    fontSize, sentenceSpacing, wordSpacing, fontFamily,
    textHighlights, addTextHighlight,
    goToNextPage, goToPreviousPage, setCurrentChapter, addBookmark,
  } = useBook()

  const [showChapters, setShowChapters] = useState(false)
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null)
  const HIGHLIGHT_COLORS = ['#FFD700', '#90EE90', '#87CEEB', '#FFB6C1', '#DDA0DD']

  useEffect(() => {
    if (view !== 'reader') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToNextPage()
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPreviousPage()
      else if (e.key === 'Escape') closeReader()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [view, goToNextPage, goToPreviousPage, closeReader])

  if (view !== 'reader' || !book || !currentChapter) return null

  const pageContent = currentChapter.content[currentPage - 1] || ''
  const pageHighlights = textHighlights
    .filter(h => h.chapterIndex === currentChapterIndex && h.pageIndex === currentPage - 1)
    .map(h => ({ selectedText: h.selectedText, color: h.color }))

  const totalBookPages = book.chapters.reduce((sum, ch) => sum + ch.content.length, 0)
  const pagesBeforeCurrent = book.chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.content.length, 0)
  const overallPage = pagesBeforeCurrent + currentPage
  const progressPct = (overallPage / totalBookPages) * 100

  const handleMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelectionPopup(null); return }
    const text = sel.toString().trim()
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    setSelectionPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text })
  }

  const handleHighlight = (color: string) => {
    if (!selectionPopup) return
    addTextHighlight({ chapterIndex: currentChapterIndex, pageIndex: currentPage - 1, selectedText: selectionPopup.text, color })
    window.getSelection()?.removeAllRanges()
    setSelectionPopup(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-xl animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={closeReader} className="p-2 rounded-lg text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div>
            <p className="text-sm font-medium text-text">{book.title}</p>
            <p className="text-[11px] text-text-muted">{book.author}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChapters(!showChapters)} className="p-2 rounded-lg text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors">
            <List className="w-4 h-4" />
          </button>
          <button onClick={addBookmark} className="p-2 rounded-lg text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors">
            <Bookmark className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-text-muted font-mono ml-2">
            {currentPage}/{totalPages}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-bg-glass">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Chapter sidebar */}
        {showChapters && (
          <div className="w-64 border-r border-border overflow-auto py-2 flex-shrink-0">
            {book.chapters.map((ch, i) => (
              <button
                key={i}
                onClick={() => { setCurrentChapter(i); setShowChapters(false) }}
                className={`w-full text-left px-4 py-2 text-[12px] transition-colors ${
                  i === currentChapterIndex
                    ? 'text-text bg-bg-glass-active'
                    : 'text-text-dim hover:text-text hover:bg-bg-glass-hover'
                }`}
              >
                {ch.title}
              </button>
            ))}
          </div>
        )}

        {/* Reading area */}
        <div className="flex-1 flex min-w-0" onMouseUp={handleMouseUp}>
          {/* Left click zone */}
          <button onClick={goToPreviousPage} className="w-16 flex-shrink-0 flex items-center justify-center text-text-muted hover:text-text-dim transition-colors opacity-0 hover:opacity-100">
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="flex-1 overflow-y-auto py-8">
            <div className="max-w-2xl mx-auto px-8">
              <h2 className="font-display text-xl font-semibold text-accent mb-6">
                {currentChapter.title}
              </h2>
              <KaraokeHighlighter
                text={pageContent}
                highlightedWordIndex={highlightedWordIndex}
                readWordIndices={readWordIndices}
                highlightColor={highlightColor}
                fontSize={fontSize}
                sentenceSpacing={sentenceSpacing}
                wordSpacing={wordSpacing}
                fontFamily={fontFamily}
                pageHighlights={pageHighlights}
              />
            </div>
          </div>

          {/* Right click zone */}
          <button onClick={goToNextPage} className="w-16 flex-shrink-0 flex items-center justify-center text-text-muted hover:text-text-dim transition-colors opacity-0 hover:opacity-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Highlight popup */}
      {selectionPopup && (
        <div
          className="fixed z-[100] flex items-center gap-1 p-1.5 rounded-xl shadow-lg border backdrop-blur-xl bg-bg-elevated/90 border-border"
          style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)' }}
          onMouseDown={e => e.preventDefault()}
        >
          <span className="text-text-muted text-xs px-1">Highlight:</span>
          {HIGHLIGHT_COLORS.map(color => (
            <button key={color} onClick={() => handleHighlight(color)}
              className="w-5 h-5 rounded-full hover:scale-125 transition-transform border border-border-hover"
              style={{ backgroundColor: color }} />
          ))}
          <button onClick={() => setSelectionPopup(null)} className="text-text-muted hover:text-text text-xs px-1 ml-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
