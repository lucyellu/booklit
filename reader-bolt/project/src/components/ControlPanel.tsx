import React, { useRef } from 'react';
import AudioControls from './AudioControls';
import ProgressScrubber from './ProgressScrubber';
import ReadingSettings from './ReadingSettings';
import ExportOptions from './ExportOptions';
import DesignCustomizer from './DesignCustomizer';
import DocumentUpload from './DocumentUpload';
import BookmarksList from './BookmarksList';
import TranslationControls from './TranslationControls';
import { Moon, Sun, Book, Bookmark, Monitor, Scroll, BookOpen } from 'lucide-react';
import { ThemeType, ReadingMode } from '../App';
import { useBook } from '../context/BookContext';

interface ControlPanelProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  showControls: boolean;
  selectedTheme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  readingMode: ReadingMode;
  onReadingModeChange: (mode: ReadingMode) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  isDarkMode, 
  onToggleDarkMode, 
  showControls,
  selectedTheme,
  onThemeChange,
  readingMode,
  onReadingModeChange
}) => {
  const { book, currentChapterIndex, currentChapter, bookmarks } = useBook();
  const panelRef = useRef<HTMLDivElement>(null);

  /* The panel used to hide itself 800ms after any click outside it and then
     only come back while the pointer was within 100px of the bottom edge, which
     made the transport controls feel like they weren't there. It is now
     persistent, and the eye button in the corner is the only thing that hides
     it — one control, in one place, that stays where you put it. */

  const readingModeIcons = {
    'page-flip': BookOpen,
    'horizontal-scroll': Monitor,
    'vertical-scroll': Scroll
  };

  const ReadingModeIcon = readingModeIcons[readingMode];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${
      showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    }`}>
      <div 
        ref={panelRef}
        className={`p-3 md:p-6 border-t glass transition-all duration-200 ${
          isDarkMode
            ? 'bg-black/20 border-white/10'
            : 'bg-white/20 border-white/20'
        }`}
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
      >
        <div className="max-w-6xl mx-auto space-y-3 md:space-y-4">
          {/* Book Info Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
              <Book className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`} />
              <div className="min-w-0 flex-1">
                <h1 className={`text-xs md:text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {book.title} by {book.author}
                </h1>
                <p className={`text-xs truncate ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                  Ch. {currentChapterIndex + 1}: {currentChapter?.title}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <DocumentUpload isDarkMode={isDarkMode} />
              <BookmarksList isDarkMode={isDarkMode} />
            </div>
          </div>

          {/* Progress Scrubber */}
          <ProgressScrubber isDarkMode={isDarkMode} />
          
          {/* Controls Row */}
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-3 lg:space-y-0 lg:space-x-4">
            <div className="w-full lg:w-auto">
              <AudioControls isDarkMode={isDarkMode} />
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              {/* Reading Mode Selector */}
              <div className="relative">
                <select
                  value={readingMode}
                  onChange={(e) => onReadingModeChange(e.target.value as ReadingMode)}
                  className={`pl-10 pr-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-sm font-medium border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 glass border appearance-none ${
                    isDarkMode 
                      ? 'bg-black/20 text-white/80 border-white/10' 
                      : 'bg-white/20 text-gray-700 border-white/20'
                  }`}
                  style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                >
                  <option value="page-flip">Page Flip</option>
                  <option value="vertical-scroll">Vertical Scroll</option>
                </select>
                <ReadingModeIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${
                  isDarkMode ? 'text-white/60' : 'text-gray-600'
                }`} />
              </div>

              <TranslationControls isDarkMode={isDarkMode} />
              
              <ExportOptions isDarkMode={isDarkMode} />
              
              <DesignCustomizer 
                isDarkMode={isDarkMode} 
                selectedTheme={selectedTheme}
                onThemeChange={onThemeChange}
              />
              
              <ReadingSettings 
                isDarkMode={isDarkMode} 
                selectedTheme={selectedTheme}
                onThemeChange={onThemeChange}
              />
              
              {/* Dark Mode Toggle */}
              <button
                onClick={onToggleDarkMode}
                className={`p-2 md:p-3 rounded-xl md:rounded-2xl glass transition-all duration-200 hover:scale-105 border ${
                  isDarkMode 
                    ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
                    : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
                }`}
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;