import React, { useState } from 'react';
import { useBook } from '../context/BookContext';
import { Languages, Volume2, Loader2 } from 'lucide-react';

interface TranslationControlsProps {
  isDarkMode: boolean;
}

const TranslationControls: React.FC<TranslationControlsProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    translationLanguage, 
    setTranslationLanguage, 
    isTranslating,
    showSideBySide,
    setShowSideBySide,
    selectedVoice,
    setSelectedVoice
  } = useBook();

  const languages = [
    { code: 'none', name: 'Original (English)', flag: '🇬🇧' },
    { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
    { code: 'fr', name: 'French', flag: '🇫🇷' }
  ];

  const getVoicesForLanguage = (langCode: string) => {
    const voices = speechSynthesis.getVoices();
    
    switch (langCode) {
      case 'zh':
        return voices.filter(voice => 
          voice.lang.includes('zh') || voice.lang.includes('cmn')
        );
      case 'fr':
        return voices.filter(voice => 
          voice.lang.includes('fr')
        );
      default:
        return voices.filter(voice => 
          voice.lang.startsWith('en')
        );
    }
  };

  const handleLanguageChange = (langCode: 'none' | 'zh' | 'fr') => {
    setTranslationLanguage(langCode);
    
    // Auto-select appropriate voice for the language
    const availableVoices = getVoicesForLanguage(langCode);
    if (availableVoices.length > 0) {
      setSelectedVoice(availableVoices[0]);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  const currentLanguage = languages.find(lang => lang.code === translationLanguage);
  const availableVoices = getVoicesForLanguage(translationLanguage);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 p-2 md:p-3 rounded-xl md:rounded-2xl backdrop-blur-xl transition-all duration-200 hover:scale-105 border ${
          translationLanguage !== 'none'
            ? isDarkMode 
              ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
              : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
            : isDarkMode 
              ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
              : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        title="Translation & Language Settings"
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
        ) : (
          <Languages className="w-4 h-4 md:w-5 md:h-5" />
        )}
        <span className="hidden md:inline text-sm font-medium">
          {currentLanguage?.flag} {currentLanguage?.name.split(' ')[0]}
        </span>
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
            className={`absolute bottom-full right-0 mb-2 p-4 rounded-2xl backdrop-blur-3xl border shadow-2xl w-80 max-w-[calc(100vw-1.5rem)] z-50 ${
              isDarkMode 
                ? 'bg-black/80 border-white/20' 
                : 'bg-white/80 border-white/40'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Translation & Voice
            </h3>
            
            {/* Language Selection */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Languages className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Reading Language
                </label>
              </div>
              
              <div className="space-y-2">
                {languages.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageChange(language.code as 'none' | 'zh' | 'fr')}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 border text-left ${
                      translationLanguage === language.code
                        ? isDarkMode 
                          ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
                          : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
                        : isDarkMode 
                          ? 'bg-black/20 hover:bg-black/30 text-white/80 hover:text-white border-white/10' 
                          : 'bg-white/20 hover:bg-white/30 text-gray-700 hover:text-gray-900 border-white/20'
                    }`}
                  >
                    <span className="text-xl">{language.flag}</span>
                    <div className="flex-1">
                      <div className="font-medium">{language.name}</div>
                      {language.code !== 'none' && (
                        <div className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          Auto-translate and read aloud
                        </div>
                      )}
                    </div>
                    {translationLanguage === language.code && (
                      <div className={`w-2 h-2 rounded-full ${
                        isDarkMode ? 'bg-blue-300' : 'bg-blue-600'
                      }`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Selection */}
            {availableVoices.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Volume2 className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Voice ({availableVoices.length} available)
                  </label>
                </div>
                <select
                  value={selectedVoice?.name || ''}
                  onChange={(e) => {
                    const voice = availableVoices.find(v => v.name === e.target.value);
                    setSelectedVoice(voice || null);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                    isDarkMode 
                      ? 'bg-black/20 text-white/80 border-white/10' 
                      : 'bg-white/30 text-gray-700 border-white/20'
                  }`}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Translation Status */}
            {translationLanguage !== 'none' && (
              <>
                {/* Display Mode Toggle */}
                <div className="mb-4">
                  <label className={`text-sm font-medium mb-2 block ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Display Mode
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowSideBySide(false)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 border ${
                        !showSideBySide
                          ? isDarkMode 
                            ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
                            : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
                          : isDarkMode 
                            ? 'bg-black/20 text-white/70 hover:bg-black/30 border-white/10' 
                            : 'bg-white/20 text-gray-600 hover:bg-white/30 border-white/20'
                      }`}
                    >
                      Overlay
                    </button>
                    <button
                      onClick={() => setShowSideBySide(true)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 border ${
                        showSideBySide
                          ? isDarkMode 
                            ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
                            : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
                          : isDarkMode 
                            ? 'bg-black/20 text-white/70 hover:bg-black/30 border-white/10' 
                            : 'bg-white/20 text-gray-600 hover:bg-white/30 border-white/20'
                      }`}
                    >
                      Side-by-Side
                    </button>
                  </div>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                    {showSideBySide 
                      ? `Shows both languages, reads ${currentLanguage?.name}` 
                      : 'Shows translation only, reads English'
                    }
                  </p>
                </div>
                
                {/* Translation Status */}
                <div className={`p-3 rounded-lg mb-4 ${
                  isDarkMode 
                    ? 'bg-blue-500/20 border border-blue-400/30' 
                    : 'bg-blue-500/10 border border-blue-500/30'
                }`}>
                  <div className="flex items-center space-x-2">
                    {isTranslating ? (
                      <>
                        <Loader2 className={`w-4 h-4 animate-spin ${
                          isDarkMode ? 'text-blue-300' : 'text-blue-600'
                        }`} />
                        <span className={`text-sm ${
                          isDarkMode ? 'text-blue-300' : 'text-blue-600'
                        }`}>
                          Translating page...
                        </span>
                      </>
                    ) : (
                      <>
                        <Languages className={`w-4 h-4 ${
                          isDarkMode ? 'text-blue-300' : 'text-blue-600'
                        }`} />
                        <span className={`text-sm ${
                          isDarkMode ? 'text-blue-300' : 'text-blue-600'
                        }`}>
                          Page translated to {currentLanguage?.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 border ${
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

export default TranslationControls;