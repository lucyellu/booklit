import React, { useState } from 'react';
import { useBook } from '../context/BookContext';

interface ProgressScrubberProps {
  isDarkMode: boolean;
}

const ProgressScrubber: React.FC<ProgressScrubberProps> = ({ isDarkMode }) => {
  const {
    currentPage,
    totalPages,
    book,
    currentChapterIndex,
    setCurrentPage,
    setCurrentChapter
  } = useBook();

  // Calculate overall progress through the entire book
  let totalPagesInBook = 0;
  let currentAbsolutePage = 0;

  book.chapters.forEach((chapter, index) => {
    totalPagesInBook += chapter.content.length;
    if (index < currentChapterIndex) {
      currentAbsolutePage += chapter.content.length;
    }
  });
  currentAbsolutePage += currentPage;

  // currentAbsolutePage is 1-indexed (page 1 of the book == 1, not 0), so
  // dividing straight by totalPagesInBook put a floor under page 1 — it
  // computed to 1/N, never 0%, so the slider could never rest at the true
  // left edge on the very first page (and looked "stuck" there). Normalizing
  // against N-1 spots the book's N pages across the full 0-100 range: page 1
  // is exactly 0%, the last page is exactly 100%.
  const lastPageIndex = Math.max(totalPagesInBook - 1, 1);
  const pageProgress = totalPagesInBook <= 1 ? 100 : ((currentAbsolutePage - 1) / lastPageIndex) * 100;

  // The book only has whole pages, so pageProgress jumps in discrete steps.
  // Binding the slider's value straight to that meant every pixel of drag
  // snapped back to the nearest page's fixed percentage, fighting the mouse.
  // dragProgress holds the raw, continuous value the user is actively
  // dragging to; it's cleared (falling back to the real, quantized
  // pageProgress) once they let go.
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const progress = dragProgress ?? pageProgress;

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    setDragProgress(newProgress);
    // Inverse of the pageProgress formula above: 0% -> page 1, 100% -> the
    // last page.
    const targetAbsolutePage = Math.round((newProgress / 100) * lastPageIndex) + 1;

    // Find which chapter and page this corresponds to
    let accumulatedPages = 0;
    for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex++) {
      const chapter = book.chapters[chapterIndex];
      if (accumulatedPages + chapter.content.length >= targetAbsolutePage) {
        const pageInChapter = targetAbsolutePage - accumulatedPages;
        setCurrentChapter(chapterIndex);
        setCurrentPage(Math.max(1, pageInChapter));
        break;
      }
      accumulatedPages += chapter.content.length;
    }
  };

  const commitScrub = () => setDragProgress(null);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
          Chapter {currentChapterIndex + 1}: {book.chapters[currentChapterIndex]?.title}
        </span>
        <span className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
          {Math.round(progress)}% Complete
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          onChange={handleScrub}
          onMouseUp={commitScrub}
          onTouchEnd={commitScrub}
          onKeyUp={commitScrub}
          className={`w-full h-3 rounded-full appearance-none cursor-pointer transition-all duration-200 ${
            isDarkMode 
              ? 'bg-white/10 hover:bg-white/20' 
              : 'bg-white/20 hover:bg-white/30'
          }`}
          style={{
            background: `linear-gradient(to right, ${
              isDarkMode ? '#3B82F6' : '#2563EB'
            } 0%, ${
              isDarkMode ? '#3B82F6' : '#2563EB'
            } ${progress}%, ${
              isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'
            } ${progress}%, ${
              isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'
            } 100%)`
          }}
        />
        
        {/* Chapter Markers */}
        <div className="absolute top-0 left-0 w-full h-3 pointer-events-none">
          {book.chapters.map((chapter, index) => {
            let pagesBeforeChapter = 0;
            for (let i = 0; i < index; i++) {
              pagesBeforeChapter += book.chapters[i].content.length;
            }
            // Chapter's first page is absolute page (pagesBeforeChapter + 1);
            // run it through the same (page - 1) / lastPageIndex mapping as
            // pageProgress so the tick lines up with where the thumb
            // actually lands when scrubbed to that chapter.
            const chapterStart = totalPagesInBook <= 1 ? 0 : (pagesBeforeChapter / lastPageIndex) * 100;
            
            return (
              <div
                key={index}
                className={`absolute top-0 w-0.5 h-3 ${
                  isDarkMode ? 'bg-white/30' : 'bg-gray-600/40'
                }`}
                style={{ left: `${chapterStart}%` }}
                title={`Chapter ${index + 1}: ${chapter.title}`}
              />
            );
          })}
        </div>
      </div>
      
      <div className="flex justify-between mt-2 text-xs">
        <span className={`${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
          Page {currentPage} of {totalPages}
        </span>
        <span className={`${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
          {currentAbsolutePage} / {totalPagesInBook} total pages
        </span>
      </div>
    </div>
  );
};

export default ProgressScrubber;