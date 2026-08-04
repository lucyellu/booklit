import React, { useState } from 'react';
import { useBook } from '../context/BookContext';
import KaraokeHighlighter from './KaraokeHighlighter';
import { Bookmark } from 'lucide-react';

interface SwipeablePageReaderProps {
  isDarkMode: boolean;
  pageContent: string;
  chapterTitle: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
}

const SwipeablePageReader: React.FC<SwipeablePageReaderProps> = ({
  isDarkMode,
  pageContent,
  chapterTitle,
}) => {
  const {
    highlightedWordIndex,
    readWordIndices,
    readWordStyle,
    fontSize,
    wordSpacing,
    sentenceSpacing,
    fontFamily,
    accentColor,
    highlightColor,
    addBookmark,
    isPlaying,
    translationLanguage,
    translatedText,
    showSideBySide,
    textHighlights,
    currentChapterIndex,
    currentPage,
    addTextHighlight,
    columnCount
  } = useBook();

  /* Layout → Double. The class for this was being computed in BookReader and
     then never put on anything, so the setting did nothing — every page was one
     column whichever you picked. A two-column page also needs a wider sheet
     than the 672px single column, or each column ends up too narrow to read,
     and the chapter title stays outside the flow so it spans both. */
  const twoColumn = columnCount === 2 && !(showSideBySide && translationLanguage !== 'none');

  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const HIGHLIGHT_COLORS = ['#FFD700', '#90EE90', '#87CEEB', '#FFB6C1', '#DDA0DD'];

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionPopup(null);
      return;
    }
    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text });
  };

  const handleHighlight = (color: string) => {
    if (!selectionPopup) return;
    addTextHighlight({ chapterIndex: currentChapterIndex, pageIndex: currentPage - 1, selectedText: selectionPopup.text, color });
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  const pageHighlights = textHighlights
    .filter(h => h.chapterIndex === currentChapterIndex && h.pageIndex === currentPage - 1)
    .map(h => ({ selectedText: h.selectedText, color: h.color }));

  return (
    <div className="h-full w-full relative" onMouseUp={handleMouseUp}>
      {/* Bookmark Button */}
      <button
        onClick={addBookmark}
        className={`absolute top-4 right-4 z-10 p-2 rounded-xl glass transition-all duration-200 hover:scale-105 border ${
          isDarkMode
            ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10'
            : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        title="Bookmark this page"
      >
        <Bookmark className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="h-full overflow-y-auto">
        <div className={`${twoColumn ? 'max-w-6xl' : 'max-w-2xl'} mx-auto px-8 py-8`}>
          <h2 className="text-xl md:text-2xl font-bold mb-6" style={{ color: accentColor || 'var(--rd-title)' }}>
            {chapterTitle}
          </h2>

          <div className={twoColumn ? 'md:columns-2 md:gap-10' : ''}>
          {showSideBySide && translationLanguage !== 'none' && translatedText ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className={`text-xs font-semibold mb-2 opacity-60 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>ORIGINAL</h3>
                <KaraokeHighlighter
                  text={pageContent}
                  isPlaying={isPlaying}
                  highlightedWordIndex={highlightedWordIndex}
                  readWordIndices={readWordIndices}
                  readWordStyle={readWordStyle}
                  highlightColor={highlightColor}
                  fontSize={fontSize}
                  sentenceSpacing={sentenceSpacing}
                  wordSpacing={wordSpacing}
                  fontFamily={fontFamily}
                  isDarkMode={isDarkMode}
                  pageHighlights={pageHighlights}
                />
              </div>
              <div>
                <h3 className={`text-xs font-semibold mb-2 opacity-60 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {translationLanguage === 'zh' ? 'CHINESE' : 'FRENCH'}
                </h3>
                <div className={`leading-relaxed text-justify ${isDarkMode ? 'text-white/95' : 'text-gray-900'}`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: sentenceSpacing, fontFamily, wordBreak: 'break-word', userSelect: 'text' }}>
                  {translatedText}
                </div>
              </div>
            </div>
          ) : translationLanguage !== 'none' && translatedText && !showSideBySide ? (
            <div className={`leading-relaxed text-justify ${isDarkMode ? 'text-white/95' : 'text-gray-900'}`}
              style={{ fontSize: `${fontSize}px`, lineHeight: sentenceSpacing, fontFamily, wordBreak: 'break-word', userSelect: 'text' }}>
              {translatedText}
            </div>
          ) : (
            <KaraokeHighlighter
              text={pageContent}
              isPlaying={isPlaying}
              highlightedWordIndex={highlightedWordIndex}
              readWordIndices={readWordIndices}
              readWordStyle={readWordStyle}
              highlightColor={highlightColor}
              fontSize={fontSize}
              sentenceSpacing={sentenceSpacing}
              wordSpacing={wordSpacing}
              fontFamily={fontFamily}
              isDarkMode={isDarkMode}
              pageHighlights={pageHighlights}
            />
          )}
          </div>
        </div>
      </div>

      {/* Highlight popup */}
      {selectionPopup && (
        <div
          className="fixed z-[100] flex items-center gap-1 p-1.5 rounded-xl shadow-lg border backdrop-blur-xl bg-black/80 border-white/20"
          style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)' }}
          onMouseDown={e => e.preventDefault()}
        >
          <span className="text-white/70 text-xs px-1">Highlight:</span>
          {HIGHLIGHT_COLORS.map(color => (
            <button key={color} onClick={() => handleHighlight(color)}
              className="w-5 h-5 rounded-full hover:scale-125 transition-transform border border-white/30"
              style={{ backgroundColor: color }} />
          ))}
          <button onClick={() => setSelectionPopup(null)} className="text-white/50 hover:text-white text-xs px-1 ml-1">✕</button>
        </div>
      )}
    </div>
  );
};

export default SwipeablePageReader;
