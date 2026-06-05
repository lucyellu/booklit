import React, { useState } from 'react';
import { Book, Search, Grid, List, Calendar, FileText, Star, Bookmark, FolderOpen, RefreshCw } from 'lucide-react';
import { useBook, LocalBook } from '../context/BookContext';

interface LibraryViewProps {
  isDarkMode: boolean;
  onSelectBook: () => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ isDarkMode, onSelectBook }) => {
  const { localBooks, loadLocalBooks, loadLocalBookContent, isLoadingLocalBooks, setBook } = useBook();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'recent' | 'rating'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  // Use local books if available, otherwise fallback to mock data
  const books: (LocalBook | any)[] = localBooks.length > 0 ? localBooks : [
    {
      id: "1",
      title: "The Digital Renaissance",
      author: "Alexandra Chen",
      cover: "/api/placeholder/200/300",
      lastRead: "2024-01-15",
      progress: 45,
      rating: 4.5,
      pages: 324,
      bookmarks: 8,
      highlights: 23
    },
    // ... rest of mock books if needed, but we'll focus on local books
  ];

  const handleBookClick = async (book: LocalBook | any) => {
    if (book.handle) {
      await loadLocalBookContent(book.handle);
    } else if (book.bookData) {
      setBook(book.bookData);
    }
    onSelectBook();
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedBooks = [...filteredBooks].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'author':
        return a.author.localeCompare(b.author);
      case 'rating':
        return b.rating - a.rating;
      case 'recent':
      default:
        return new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime();
    }
  });

  return (
    <div className="flex-1 p-6 pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              My Library
            </h1>
            <p className={`text-lg ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              {books.length} books in your collection
            </p>
          </div>
          
          <button
            onClick={loadLocalBooks}
            disabled={isLoadingLocalBooks}
            className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl transition-all duration-200 hover:scale-105 border backdrop-blur-xl ${
              isDarkMode 
                ? 'bg-blue-500/20 text-blue-300 border-blue-400/30 hover:bg-blue-500/30' 
                : 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20'
            }`}
          >
            {isLoadingLocalBooks ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <FolderOpen className="w-5 h-5" />
            )}
            <span className="font-semibold">Load Local Books</span>
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              isDarkMode ? 'text-white/50' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                isDarkMode 
                  ? 'bg-black/20 text-white/80 placeholder-white/50 border-white/10' 
                  : 'bg-white/30 text-gray-700 placeholder-gray-500 border-white/20'
              }`}
              style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
              isDarkMode 
                ? 'bg-black/20 text-white/80 border-white/10' 
                : 'bg-white/30 text-gray-700 border-white/20'
            }`}
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <option value="recent">Recently Read</option>
            <option value="title">Title A-Z</option>
            <option value="author">Author A-Z</option>
            <option value="rating">Highest Rated</option>
          </select>

          {/* View Mode */}
          <div className="flex rounded-xl overflow-hidden border backdrop-blur-xl" style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 transition-all duration-200 ${
                viewMode === 'grid'
                  ? isDarkMode 
                    ? 'bg-blue-500/30 text-blue-300' 
                    : 'bg-blue-500/20 text-blue-600'
                  : isDarkMode 
                    ? 'bg-black/20 text-white/70 hover:bg-black/30' 
                    : 'bg-white/20 text-gray-600 hover:bg-white/30'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-3 transition-all duration-200 ${
                viewMode === 'list'
                  ? isDarkMode 
                    ? 'bg-blue-500/30 text-blue-300' 
                    : 'bg-blue-500/20 text-blue-600'
                  : isDarkMode 
                    ? 'bg-black/20 text-white/70 hover:bg-black/30' 
                    : 'bg-white/20 text-gray-600 hover:bg-white/30'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Books Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {sortedBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => handleBookClick(book)}
                className={`group cursor-pointer rounded-2xl p-4 transition-all duration-200 hover:scale-105 backdrop-blur-xl border ${
                  isDarkMode 
                    ? 'bg-black/20 hover:bg-black/30 border-white/10' 
                    : 'bg-white/20 hover:bg-white/30 border-white/20'
                }`}
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                {/* Book Cover */}
                <div className="aspect-[3/4] bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-3 flex items-center justify-center">
                  <Book className="w-8 h-8 text-white" />
                </div>
                
                {/* Book Info */}
                <h3 className={`font-semibold text-sm mb-1 line-clamp-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {book.title}
                </h3>
                <p className={`text-xs mb-2 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                  {book.author}
                </p>
                
                {/* Stats */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center space-x-1">
                    <Bookmark className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                    <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{book.bookmarks}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                    <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{book.highlights}</span>
                  </div>
                </div>
                
                {/* Progress */}
                <div className="mb-2">
                  <div className={`w-full h-1 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`}>
                    <div 
                      className="h-1 bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${book.progress}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                    {book.progress}% complete
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => handleBookClick(book)}
                className={`group cursor-pointer rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl border ${
                  isDarkMode 
                    ? 'bg-black/20 hover:bg-black/30 border-white/10' 
                    : 'bg-white/20 hover:bg-white/30 border-white/20'
                }`}
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div className="flex items-center space-x-4">
                  {/* Book Cover */}
                  <div className="w-16 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Book className="w-6 h-6 text-white" />
                  </div>
                  
                  {/* Book Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {book.title}
                    </h3>
                    <p className={`text-sm mb-2 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                      by {book.author}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs">
                      <div className="flex items-center space-x-1">
                        <FileText className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                        <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{book.pages} pages</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Bookmark className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                        <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{book.bookmarks} bookmarks</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                        <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{book.rating} • {book.highlights} highlights</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className={`w-3 h-3 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`} />
                        <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>{book.lastRead}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress */}
                  <div className="text-right">
                    <div className={`w-24 h-2 rounded-full mb-1 ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`}>
                      <div 
                        className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${book.progress}%` }}
                      />
                    </div>
                    <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                      {book.progress}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;