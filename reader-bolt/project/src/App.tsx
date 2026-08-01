import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import BookReader from './components/BookReader';
import ControlPanel from './components/ControlPanel';
import LibraryView from './components/LibraryView';
import AuthModal from './components/AuthModal';
import UserProfile from './components/UserProfile';
import { BookProvider, useBook } from './context/BookContext';
import { sampleBook } from './data/sampleBook';
import { Eye, EyeOff, Library, LogIn } from 'lucide-react';

export type ThemeType = 'midnight' | 'ocean-breeze' | 'forest-dawn' | 'warm-sunset' | 'lavender-mist';
export type ReadingMode = 'vertical-scroll' | 'page-flip';

const themes = {
  'midnight': {
    light: 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100',
    dark: 'bg-gradient-to-br from-black via-gray-900 to-black',
    accent1: 'from-gray-400/15',
    accent2: 'from-slate-400/15'
  },
  'ocean-breeze': {
    light: 'bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50',
    dark: 'bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950',
    accent1: 'from-sky-400/15',
    accent2: 'from-cyan-400/15'
  },
  'forest-dawn': {
    light: 'bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50',
    dark: 'bg-gradient-to-br from-slate-900 via-emerald-950 to-green-950',
    accent1: 'from-emerald-400/15',
    accent2: 'from-green-400/15'
  },
  'warm-sunset': {
    light: 'bg-gradient-to-br from-amber-50 via-orange-50 to-red-50',
    dark: 'bg-gradient-to-br from-slate-900 via-amber-950 to-orange-950',
    accent1: 'from-amber-400/15',
    accent2: 'from-orange-400/15'
  },
  'lavender-mist': {
    light: 'bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50',
    dark: 'bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950',
    accent1: 'from-purple-400/15',
    accent2: 'from-indigo-400/15'
  }
};

function AppContent() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>('midnight');
  const [uiVisible, setUiVisible] = useState(true);
  const [currentView, setCurrentView] = useState<'reader' | 'library'>('reader');
  const [readingMode, setReadingMode] = useState<ReadingMode>('page-flip');
  const { backgroundImage, setBook } = useBook();
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  /* The control panel used to ask to be hidden shortly after any click outside
     it. It no longer does — the eye button below is the only way it goes away.
     See the note in ControlPanel. */

  // Embedded mode: accept a book pushed from the host (Booklit) via postMessage.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.type === 'booklit:load-book' && d.book && Array.isArray(d.book.chapters)) {
        setBook(d.book);
        setCurrentView('reader');
      }
      // Follow the host's Forest Day / Forest Evening choice. data-theme drives
      // the palette ramps in index.css; isDarkMode is what the components
      // themselves branch on, so both have to move together.
      if (d && d.type === 'booklit:theme' && (d.theme === 'day' || d.theme === 'evening')) {
        document.documentElement.dataset.theme = d.theme;
        setIsDarkMode(d.theme === 'evening');
      }
    };
    window.addEventListener('message', onMsg);
    // Tell the host we're ready to receive a book.
    try { window.parent?.postMessage({ type: 'booklit:ready' }, '*'); } catch { /* not embedded */ }
    return () => window.removeEventListener('message', onMsg);
  }, [setBook]);

  const currentTheme = themes[selectedTheme];

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={isEmbed
        // Embedded in Booklit: the standalone reader's photo backdrop would
        // show a hard seam against the host's flat forest ground, so use the
        // ground colour instead. --rd-bg tracks the host's --color-bg.
        ? { background: 'var(--rd-bg)' }
        : {
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
          }
      }
    >
      {/* Background overlay for better readability — only needed over the photo. */}
      {!isEmbed && (
        <div className={`absolute inset-0 transition-all duration-500 ${
          isDarkMode
            ? 'bg-black/40'
            : 'bg-white/20'
        }`} />
      )}

      {/* Subtle gradient overlays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial ${currentTheme.accent1} to-transparent rounded-full blur-3xl opacity-30`} />
        <div className={`absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial ${currentTheme.accent2} to-transparent rounded-full blur-3xl opacity-30`} />
      </div>

      {/* Top Controls */}
      <div className="fixed top-4 left-4 right-4 z-[60] flex justify-between items-center">
        {/* Library Button (hidden when embedded in Booklit) */}
        {!isEmbed && (
        <button
          onClick={() => setCurrentView(currentView === 'library' ? 'reader' : 'library')}
          className={`p-3 rounded-2xl transition-all duration-200 hover:scale-105 border backdrop-blur-xl ${
            currentView === 'library'
              ? isDarkMode 
                ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
                : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
              : isDarkMode 
                ? 'bg-black/10 text-white/80 hover:bg-black/20 hover:text-white border-white/10' 
                : 'bg-white/10 text-gray-700 hover:bg-white/20 hover:text-gray-900 border-white/20'
          }`}
          style={{
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        >
          <Library className="w-5 h-5" />
        </button>
        )}
        {isEmbed && <div />}

        <div className="flex items-center gap-3">
          {/* Auth/Profile Button (hidden when embedded) */}
          {!isEmbed && (user ? (
            <UserProfile user={user} isDarkMode={isDarkMode} />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className={`p-3 rounded-2xl transition-all duration-200 hover:scale-105 border backdrop-blur-xl ${
                isDarkMode 
                  ? 'bg-black/10 text-white/80 hover:bg-black/20 hover:text-white border-white/10' 
                  : 'bg-white/10 text-gray-700 hover:bg-white/20 hover:text-gray-900 border-white/20'
              }`}
              style={{
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              }}
            >
              <LogIn className="w-5 h-5" />
            </button>
          ))}

          {/* UI Toggle Button */}
          <button
            data-ui-toggle
            onClick={() => setUiVisible(!uiVisible)}
            className={`p-3 rounded-2xl transition-all duration-200 hover:scale-105 border backdrop-blur-xl ${
              isDarkMode 
                ? 'bg-black/10 text-white/80 hover:bg-black/20 hover:text-white border-white/10' 
                : 'bg-white/10 text-gray-700 hover:bg-white/20 hover:text-gray-900 border-white/20'
            }`}
            style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            {uiVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {currentView === 'library' ? (
          <LibraryView 
            isDarkMode={isDarkMode} 
            onSelectBook={() => setCurrentView('reader')}
          />
        ) : (
          <>
            <BookReader 
              isDarkMode={isDarkMode} 
              readingMode={readingMode}
            />
            <ControlPanel 
              isDarkMode={isDarkMode} 
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
              showControls={uiVisible}
              selectedTheme={selectedTheme}
              onThemeChange={setSelectedTheme}
              readingMode={readingMode}
              onReadingModeChange={setReadingMode}
            />
          </>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        isDarkMode={isDarkMode} 
      />
    </div>
  );
}

function App() {
  return (
    <BookProvider initialBook={sampleBook}>
      <AppContent />
    </BookProvider>
  );
}

export default App;