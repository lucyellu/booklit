import React, { useState, useEffect, useCallback } from 'react';
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

/*
 * One theme, the host's.
 *
 * There used to be five (midnight, ocean-breeze, forest-dawn, warm-sunset,
 * lavender-mist), three of which reached for emerald/amber/orange — ramps the
 * forest remap in tailwind.config.js deliberately leaves alone, because they
 * carry meaning elsewhere. So picking one put a lilac or apricot wash behind a
 * forest-green reader. Nothing ever rendered a picker for them either: both
 * DesignCustomizer and ReadingSettings take `selectedTheme` and ignore it, so
 * the app sat on 'midnight' forever. The two blurred blobs below are all that
 * survived, tinted from the accent ramp so they follow the host.
 */
export type ThemeType = 'forest';
export type ReadingMode = 'vertical-scroll' | 'page-flip';

const AMBIENT = { accent1: 'from-accent-400/15', accent2: 'from-accent-600/15' };

function AppContent() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [currentView, setCurrentView] = useState<'reader' | 'library'>('reader');
  const [readingMode, setReadingMode] = useState<ReadingMode>('page-flip');
  const { backgroundImage, setBook } = useBook();
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');

  /* Dark mode has to move `data-theme` with it, not just the boolean.
     `isDarkMode` picks which end of each ramp a component reaches for, but the
     ramps' two ends — --rd-white, --rd-black, --rd-bg — are what `data-theme`
     selects. Flipping only the boolean left the ground pale while every piece of
     text moved to its dark-mode colour, which is why dark mode read as "the text
     changed and now I can't see it". One call sets both. */
  const applyDark = useCallback((dark: boolean) => {
    document.documentElement.dataset.theme = dark ? 'evening' : 'day';
    setIsDarkMode(dark);
  }, []);

  useEffect(() => {
    applyDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, [applyDark]);

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
        const startPosition = typeof d.startChapterIndex === 'number' && typeof d.startWordOffset === 'number'
          ? { chapterIndex: d.startChapterIndex, wordOffset: d.startWordOffset }
          : undefined;
        setBook(d.book, startPosition);
        setCurrentView('reader');
      }
      // Follow the host's Forest Day / Forest Evening choice.
      if (d && d.type === 'booklit:theme' && (d.theme === 'day' || d.theme === 'evening')) {
        applyDark(d.theme === 'evening');
      }
    };
    window.addEventListener('message', onMsg);
    // Tell the host we're ready to receive a book.
    try { window.parent?.postMessage({ type: 'booklit:ready' }, '*'); } catch { /* not embedded */ }
    return () => window.removeEventListener('message', onMsg);
  }, [setBook, applyDark]);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      /* The picture, when there is one. This used to be ignored outright when
         embedded — the ground colour was forced, so choosing or uploading a
         background in the customizer did nothing at all in Booklit. Now the
         picture wins wherever it is set, and "None" (the customizer's first
         option, and the default when embedded) falls back to the theme ground,
         which is what keeps the iframe seamless against the host. */
      style={backgroundImage
        ? {
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
          }
        // --rd-bg tracks the host's --color-bg.
        : { background: 'var(--rd-bg)' }
      }
    >
      {/* Readability wash — only needed over a photo. */}
      {backgroundImage && (
        <div className={`absolute inset-0 transition-all duration-500 ${
          isDarkMode
            ? 'bg-black/40'
            : 'bg-white/20'
        }`} />
      )}

      {/* Two blurred blobs of the accent, for depth over a flat ground. Not over
          a picture, which has plenty of its own. */}
      {!backgroundImage && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial ${AMBIENT.accent1} to-transparent rounded-full blur-3xl opacity-30`} />
          <div className={`absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial ${AMBIENT.accent2} to-transparent rounded-full blur-3xl opacity-30`} />
        </div>
      )}

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
              onToggleDarkMode={() => applyDark(!isDarkMode)}
              showControls={uiVisible}
              selectedTheme="forest"
              onThemeChange={() => {}}
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