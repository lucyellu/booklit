import React, { useState } from 'react';
import { useBook } from '../context/BookContext';
import { Bookmark, X, Calendar, FileText } from 'lucide-react';

interface BookmarksListProps {
  isDarkMode: boolean;
}

const BookmarksList: React.FC<BookmarksListProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { bookmarks, removeBookmark, goToBookmark } = useBook();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl glass transition-all duration-200 hover:scale-105 border relative ${
          isDarkMode 
            ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
            : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        title="View bookmarks"
      >
        <Bookmark className="w-4 h-4" />
        {bookmarks.length > 0 && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 text-xs rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
          }`}>
            {bookmarks.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={handleBackdropClick}
          />
          
          {/* Menu */}
          <div 
            className={`absolute bottom-full right-0 mb-2 p-4 rounded-2xl backdrop-blur-3xl border shadow-2xl w-80 max-w-[calc(100vw-1.5rem)] max-h-96 overflow-y-auto z-50 ${
              isDarkMode 
                ? 'bg-black/80 border-white/20' 
                : 'bg-white/80 border-white/40'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Bookmarks
              </h3>
              <span className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                {bookmarks.length} saved
              </span>
            </div>
            
            {bookmarks.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No bookmarks yet</p>
                <p className="text-xs mt-1">Click the bookmark button while reading to save your place</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className={`group p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
                      isDarkMode 
                        ? 'bg-black/20 hover:bg-black/30 border-white/10' 
                        : 'bg-white/20 hover:bg-white/30 border-white/20'
                    }`}
                    onClick={() => {
                      goToBookmark(bookmark);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <FileText className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                          <span className={`text-xs font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                            Chapter {bookmark.chapterIndex + 1}, Page {bookmark.pageIndex + 1}
                          </span>
                        </div>
                        <p className={`text-sm line-clamp-2 mb-2 ${isDarkMode ? 'text-white/90' : 'text-gray-800'}`}>
                          {bookmark.text}
                        </p>
                        <div className="flex items-center space-x-1">
                          <Calendar className={`w-3 h-3 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
                          <span className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
                            {formatDate(bookmark.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(bookmark.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all duration-200 ${
                          isDarkMode 
                            ? 'text-white/50 hover:text-red-400 hover:bg-red-500/20' 
                            : 'text-gray-500 hover:text-red-600 hover:bg-red-500/20'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className={`w-full mt-4 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 border ${
                isDarkMode 
                  ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-400/30' 
                  : 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 border-blue-500/30'
              }`}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BookmarksList;