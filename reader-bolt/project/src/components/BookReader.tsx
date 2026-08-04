import React, { useRef, useEffect } from 'react';
import { useBook } from '../context/BookContext';
import { ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { ReadingMode } from '../App';
import SwipeablePageReader from './SwipeablePageReader';
import KaraokeHighlighter from './KaraokeHighlighter';

interface BookReaderProps {
  isDarkMode: boolean;
  readingMode: ReadingMode;
}

const BookReader: React.FC<BookReaderProps> = ({ isDarkMode, readingMode }) => {
  const {
    currentChapter,
    currentPage,
    totalPages,
    goToNextPage,
    goToPreviousPage,
    highlightedWordIndex,
    readWordIndices,
    readWordStyle,
    isPlaying,
    fontSize,
    currentChapterIndex,
    goToNextChapter,
    goToPreviousChapter,
    columnCount,
    wordSpacing,
    sentenceSpacing,
    readerWidth,
    readerHeight,
    fontFamily,
    accentColor,
    highlightColor,
    showPageNumbers,
    paddingSize,
    marginSize,
    pageWidth,
    pageHeight,
    containerTransparent,
    book,
    setCurrentPage,
    addBookmark,
    isMobile,
    translationLanguage,
    translatedText,
    isTranslating,
    showSideBySide,
    textHighlights,
    addTextHighlight,
    continuousScroll,
  } = useBook();
  
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentPage < (currentChapter?.content.length || 0)) {
          goToNextPage();
        } else {
          goToNextChapter();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentPage > 1) {
          goToPreviousPage();
        } else {
          goToPreviousChapter();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, currentChapter, currentChapterIndex, goToNextPage, goToPreviousPage, goToNextChapter, goToPreviousChapter]);

  const handleSideClick = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    
    if (side === 'left') {
      if (currentPage > 1) {
        goToPreviousPage();
      } else {
        goToPreviousChapter();
      }
    } else {
      if (currentPage < (currentChapter?.content.length || 0)) {
        goToNextPage();
      } else {
        goToNextChapter();
      }
    }
  };

  const handleSwipeLeft = () => {
    if (currentPage < (currentChapter?.content.length || 0)) {
      goToNextPage();
    } else {
      goToNextChapter();
    }
  };

  const handleSwipeRight = () => {
    if (currentPage > 1) {
      goToPreviousPage();
    } else {
      goToPreviousChapter();
    }
  };

  // Calculate overall book progress
  let totalPagesInBook = 0;
  let currentAbsolutePage = 0;
  
  book.chapters.forEach((chapter, index) => {
    totalPagesInBook += chapter.content.length;
    if (index < currentChapterIndex) {
      currentAbsolutePage += chapter.content.length;
    }
  });
  currentAbsolutePage += currentPage;

  if (!currentChapter) return null;

  // Use translated text if available, otherwise use original
  const currentPageContent = translationLanguage !== 'none' && translatedText && !showSideBySide
    ? translatedText 
    : currentChapter.content[currentPage - 1] || '';
  
  const paddingClass = {
    small: 'p-4 md:p-6',
    medium: 'p-6 md:p-8',
    large: 'p-8 md:p-12',
    'extra-large': 'p-12 md:p-16'
  }[paddingSize];

  const marginClass = {
    narrow: 'mx-2 md:mx-8',
    normal: 'mx-4 md:mx-16',
    wide: 'mx-6 md:mx-24',
    'extra-wide': 'mx-8 md:mx-32'
  }[marginSize];

  /* Layout → Double. This was computed and then never put on an element, so the
     setting did nothing. Page-flip applies its own in SwipeablePageReader, where
     the sheet also has to widen; here it wraps the continuous scroll, whose
     pages are already stacked in one flow. */
  const columnClass = columnCount === 2 ? 'md:columns-2 md:gap-10' : '';

  // Calculate page dimensions in pixels for display
  const pixelsPerInch = 96;
  const pageWidthPx = pageWidth * pixelsPerInch;
  const pageHeightPx = pageHeight * pixelsPerInch;

  // Render different reading modes
  const renderContent = () => {
    switch (readingMode) {
      case 'horizontal-scroll':
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-hidden relative">
              <div
                className={`w-full h-full rounded-lg border transition-all duration-300 ${
                  containerTransparent
                    ? 'bg-transparent border-transparent'
                    : isDarkMode
                      ? 'bg-black/10 border-white/5'
                      : 'bg-white/10 border-white/10'
                }`}
                style={{
                  backdropFilter: containerTransparent ? 'none' : 'blur(20px)',
                  WebkitBackdropFilter: containerTransparent ? 'none' : 'blur(20px)',
                }}
              >
                <div className="h-full p-4 md:p-6 overflow-y-auto">
                  {currentPage === 1 && (
                    <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: accentColor || 'var(--rd-title)' }}>
                      {currentChapter.title}
                    </h2>
                  )}
                  <KaraokeHighlighter
                    text={currentPageContent}
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
                  />
                </div>
              </div>
              {/* Prev / Next overlay buttons */}
              <button
                onClick={() => currentPage > 1 ? goToPreviousPage() : goToPreviousChapter()}
                disabled={currentChapterIndex === 0 && currentPage === 1}
                className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-xl border backdrop-blur-xl transition-all duration-200 hover:scale-110 opacity-40 hover:opacity-100 ${isDarkMode ? 'bg-black/30 text-white/80 border-white/10' : 'bg-white/30 text-gray-700 border-white/20'}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => currentPage < (currentChapter?.content.length || 0) ? goToNextPage() : goToNextChapter()}
                disabled={currentChapterIndex === (book.chapters.length - 1) && currentPage === (currentChapter?.content.length || 0)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-xl border backdrop-blur-xl transition-all duration-200 hover:scale-110 opacity-40 hover:opacity-100 ${isDarkMode ? 'bg-black/30 text-white/80 border-white/10' : 'bg-white/30 text-gray-700 border-white/20'}`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            {showPageNumbers && (
              <div className="flex justify-between text-xs mt-2 px-1">
                <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>Ch. {currentPage} / {totalPages}</span>
                <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{currentAbsolutePage} / {totalPagesInBook}</span>
              </div>
            )}
          </div>
        );

      case 'vertical-scroll':
        if (continuousScroll) {
          return (
            <div className="space-y-4">
              <h2 className={`text-xl md:text-2xl font-bold mb-4`} style={{ color: accentColor || 'var(--rd-title)' }}>
                {currentChapter.title}
              </h2>
              <div className={columnClass}>
              {currentChapter.content.map((pageContent, index) => (
                <p
                  key={index}
                  className={`leading-relaxed text-justify ${isDarkMode ? 'text-white/95' : 'text-gray-900'}`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: sentenceSpacing, fontFamily, wordBreak: 'break-word', hyphens: 'auto' as const, userSelect: 'text', WebkitUserSelect: 'text' as any }}
                >
                  {pageContent}
                </p>
              ))}
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-8">
            {currentChapter.content.map((pageContent, index) => (
              <div
                key={index}
                onClick={() => setCurrentPage(index + 1)}
                className={`cursor-pointer rounded-lg border transition-all duration-300 relative ${
                  index + 1 === currentPage ? 'ring-2 ring-blue-400' : ''
                } ${
                  containerTransparent
                    ? 'bg-transparent border-transparent'
                    : isDarkMode
                      ? 'bg-black/10 border-white/5'
                      : 'bg-white/10 border-white/10'
                }`}
                style={{
                  backdropFilter: containerTransparent ? 'none' : 'blur(20px)',
                  WebkitBackdropFilter: containerTransparent ? 'none' : 'blur(20px)',
                }}
              >
                <div className="p-4 md:p-6">
                  {index === 0 && (
                    <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: accentColor || 'var(--rd-title)' }}>
                      {currentChapter.title}
                    </h2>
                  )}
                  <div
                    className={`leading-relaxed text-justify ${isDarkMode ? 'text-white/95' : 'text-gray-900'}`}
                    style={{ fontSize: `${fontSize}px`, lineHeight: sentenceSpacing, fontFamily, wordBreak: 'break-word', hyphens: 'auto' as const, userSelect: 'text', WebkitUserSelect: 'text' as any }}
                  >
                    {pageContent}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'page-flip':
      default:
        return (
          <div className={`relative overflow-hidden rounded-lg border transition-all duration-300 w-full h-full ${
              containerTransparent
                ? 'bg-transparent border-transparent'
                : isDarkMode
                  ? 'bg-black/10 border-white/5'
                  : 'bg-white/10 border-white/10'
            }`}
            style={{
              backdropFilter: containerTransparent ? 'none' : 'blur(20px)',
              WebkitBackdropFilter: containerTransparent ? 'none' : 'blur(20px)',
            }}
          >
            <SwipeablePageReader
              isDarkMode={isDarkMode}
              pageContent={currentPageContent}
              chapterTitle={currentChapter.title}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              canSwipeLeft={currentPage < (currentChapter?.content.length || 0) || currentChapterIndex < (book.chapters.length - 1)}
              canSwipeRight={currentPage > 1 || currentChapterIndex > 0}
            />
            {/* Navigation Buttons - Desktop page-flip */}
            {!isMobile && (
              <>
                <button
                  onClick={() => currentPage > 1 ? goToPreviousPage() : goToPreviousChapter()}
                  disabled={currentChapterIndex === 0 && currentPage === 1}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-xl transition-all duration-200 hover:scale-110 opacity-30 hover:opacity-100 border backdrop-blur-xl ${
                    currentChapterIndex === 0 && currentPage === 1
                      ? 'opacity-0 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-black/20 text-white/80 border-white/10 hover:bg-black/40'
                        : 'bg-white/20 text-gray-700 border-white/20 hover:bg-white/40'
                  }`}
                  style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => currentPage < (currentChapter?.content.length || 0) ? goToNextPage() : goToNextChapter()}
                  disabled={currentChapterIndex === (book.chapters.length - 1) && currentPage === (currentChapter?.content.length || 0)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-xl transition-all duration-200 hover:scale-110 opacity-30 hover:opacity-100 border backdrop-blur-xl ${
                    currentChapterIndex === (book.chapters.length - 1) && currentPage === (currentChapter?.content.length || 0)
                      ? 'opacity-0 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-black/20 text-white/80 border-white/10 hover:bg-black/40'
                        : 'bg-white/20 text-gray-700 border-white/20 hover:bg-white/40'
                  }`}
                  style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center pt-16 pb-32">
      {/* Left click area - Hidden on mobile and for scroll modes */}
      {readingMode === 'page-flip' && !isMobile && (
        <div 
          className="fixed left-0 top-0 bottom-0 w-16 md:w-24 z-30 cursor-pointer"
          onClick={(e) => handleSideClick(e, 'left')}
        />
      )}
      
      {/* Right click area - Hidden on mobile and for scroll modes */}
      {readingMode === 'page-flip' && !isMobile && (
        <div 
          className="fixed right-0 top-0 bottom-0 w-16 md:w-24 z-30 cursor-pointer"
          onClick={(e) => handleSideClick(e, 'right')}
        />
      )}

      {/* Outer Container - Controls overall reader size */}
      <div 
        ref={containerRef}
        className={`relative rounded-none md:rounded-3xl glass border-0 md:border transition-all duration-500 ${marginClass} ${
          isDarkMode
            ? 'bg-black/5 md:border-white/10 shadow-2xl'
            : 'bg-white/5 md:border-white/20 shadow-2xl'
        }`}
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          width: isMobile ? '100vw' : `${readerWidth}vw`,
          height: isMobile ? '100vh' : `${readerHeight}vh`,
          maxHeight: isMobile ? '100vh' : '90vh',
          maxWidth: isMobile ? '100vw' : '95vw'
        }}
      >
        {/* Reading Area */}
        <div className={`h-full ${readingMode === 'page-flip' ? 'overflow-hidden flex items-center justify-center' : 'overflow-auto'} ${paddingClass} relative`}>
          {/* Translation Loading Overlay */}
          {isTranslating && (
            <div className={`absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm ${
              isDarkMode ? 'bg-black/50' : 'bg-white/50'
            }`}>
              <div className={`flex items-center space-x-3 p-4 rounded-xl glass border ${
                isDarkMode 
                  ? 'bg-black/80 text-white border-white/20' 
                  : 'bg-white/80 text-gray-800 border-white/40'
              }`}>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="font-medium">Translating page...</span>
              </div>
            </div>
          )}
          
          {renderContent()}
          
          {/* Page Numbers - Outside the inner container */}
          {showPageNumbers && (
            <>
              <div className={`absolute bottom-4 left-4 text-sm font-medium ${
                isDarkMode ? 'text-white/50' : 'text-gray-500'
              }`}>
                Ch. {currentPage} / {totalPages}
              </div>
              <div className={`absolute bottom-4 right-4 text-sm font-medium ${
                isDarkMode ? 'text-white/50' : 'text-gray-500'
              }`}>
                {currentAbsolutePage} / {totalPagesInBook}
              </div>
            </>
          )}
        </div>

        {/* Mobile Navigation Buttons - Only for page-flip mode */}
        {readingMode === 'page-flip' && isMobile && (
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
            <button
              onClick={() => currentPage > 1 ? goToPreviousPage() : goToPreviousChapter()}
              disabled={currentChapterIndex === 0 && currentPage === 1}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl glass transition-all duration-200 border text-sm ${
                currentChapterIndex === 0 && currentPage === 1
                  ? `opacity-40 cursor-not-allowed ${isDarkMode ? 'text-white/40 bg-black/10 border-white/5' : 'text-gray-400 bg-white/10 border-white/10'}`
                  : `hover:scale-105 ${
                      isDarkMode 
                        ? 'text-white/80 bg-black/20 hover:bg-black/30 hover:text-white border-white/10' 
                        : 'text-gray-700 bg-white/20 hover:bg-white/30 hover:text-gray-900 border-white/20'
                    }`
              }`}
              style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {!showPageNumbers && (
              <div className={`px-3 py-2 rounded-xl glass border text-sm font-medium ${
                isDarkMode 
                  ? 'text-white/70 bg-black/20 border-white/10' 
                  : 'text-gray-600 bg-white/20 border-white/20'
              }`}
              style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}>
                {currentPage} / {totalPages}
              </div>
            )}

            <button
              onClick={() => currentPage < (currentChapter?.content.length || 0) ? goToNextPage() : goToNextChapter()}
              disabled={currentChapterIndex === (book.chapters.length - 1) && currentPage === (currentChapter?.content.length || 0)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl glass transition-all duration-200 border text-sm ${
                currentChapterIndex === (book.chapters.length - 1) && currentPage === (currentChapter?.content.length || 0)
                  ? `opacity-40 cursor-not-allowed ${isDarkMode ? 'text-white/40 bg-black/10 border-white/5' : 'text-gray-400 bg-white/10 border-white/10'}`
                  : `hover:scale-105 ${
                      isDarkMode 
                        ? 'text-white/80 bg-black/20 hover:bg-black/30 hover:text-white border-white/10' 
                        : 'text-gray-700 bg-white/20 hover:bg-white/30 hover:text-gray-900 border-white/20'
                    }`
              }`}
              style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookReader;