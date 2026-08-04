import React, { useState } from 'react';
import { useBook } from '../context/BookContext';
import { Settings, Type, Mic, Columns, Space as Spacing, Maximize, Hash, Move, RotateCcw, BookOpen, Eye, EyeOff, Scroll, Highlighter } from 'lucide-react';
import { ThemeType } from '../App';
import { ReadWordStyle } from '../context/BookContext';

interface ReadingSettingsProps {
  isDarkMode: boolean;
  selectedTheme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
}

const ReadingSettings: React.FC<ReadingSettingsProps> = ({ 
  isDarkMode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    fontSize, 
    setFontSize, 
    selectedVoice, 
    setSelectedVoice,
    columnCount,
    setColumnCount,
    wordSpacing,
    setWordSpacing,
    sentenceSpacing,
    setSentenceSpacing,
    readerWidth,
    setReaderWidth,
    readerHeight,
    setReaderHeight,
    playbackSpeed,
    setPlaybackSpeed,
    readWordStyle,
    setReadWordStyle,
    showPageNumbers,
    setShowPageNumbers,
    paddingSize,
    setPaddingSize,
    marginSize,
    setMarginSize,
    pageWidth,
    setPageWidth,
    pageHeight,
    setPageHeight,
    containerTransparent,
    setContainerTransparent,
    continuousScroll,
    setContinuousScroll,
  } = useBook();

  const availableVoices = speechSynthesis.getVoices();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  const resetDimensions = () => {
    setReaderWidth(92);
    setReaderHeight(88);
  };

  const resetPageSize = () => {
    setPageWidth(7.5);
    setPageHeight(4.4);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 md:p-3 rounded-xl md:rounded-2xl backdrop-blur-xl transition-all duration-200 hover:scale-105 border ${
          isDarkMode 
            ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
            : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
      >
        <Settings className="w-4 h-4 md:w-5 md:h-5" />
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
            className={`absolute bottom-full right-0 mb-2 p-4 rounded-2xl backdrop-blur-3xl border shadow-2xl w-80 max-w-[calc(100vw-1.5rem)] z-50 max-h-96 overflow-y-auto ${
              isDarkMode 
                ? 'bg-black/80 border-white/20' 
                : 'bg-white/80 border-white/40'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Reading Settings
            </h3>
            
            {/* Page Size Controls */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <BookOpen className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Page Size (inches)
                  </label>
                </div>
                <button
                  onClick={resetPageSize}
                  className={`p-1 rounded text-xs ${
                    isDarkMode ? 'text-white/50 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Reset to default (7.5 x 4.4)"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Width: {pageWidth}"</span>
                    <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>3" - 12"</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="0.1"
                    value={pageWidth}
                    onChange={(e) => setPageWidth(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Height: {pageHeight}"</span>
                    <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>2" - 10"</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.1"
                    value={pageHeight}
                    onChange={(e) => setPageHeight(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Container Transparency Toggle */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {containerTransparent ? (
                    <EyeOff className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  ) : (
                    <Eye className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  )}
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Transparent Container
                  </label>
                </div>
                <button
                  onClick={() => setContainerTransparent(!containerTransparent)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    containerTransparent
                      ? 'bg-blue-500'
                      : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      containerTransparent ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Column Layout */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Columns className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Layout
                </label>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setColumnCount(1)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 border ${
                    columnCount === 1
                      ? isDarkMode 
                        ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
                        : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
                      : isDarkMode 
                        ? 'bg-black/20 text-white/70 hover:bg-black/30 border-white/10' 
                        : 'bg-white/20 text-gray-600 hover:bg-white/30 border-white/20'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setColumnCount(2)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 border ${
                    columnCount === 2
                      ? isDarkMode 
                        ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' 
                        : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
                      : isDarkMode 
                        ? 'bg-black/20 text-white/70 hover:bg-black/30 border-white/10' 
                        : 'bg-white/20 text-gray-600 hover:bg-white/30 border-white/20'
                  }`}
                >
                  Double
                </button>
              </div>
            </div>

            {/* Reader Container Dimensions */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Move className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Container Size
                  </label>
                </div>
                <button
                  onClick={resetDimensions}
                  className={`p-1 rounded text-xs ${
                    isDarkMode ? 'text-white/50 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Reset to default"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Width: {readerWidth}%</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="95"
                    value={readerWidth}
                    onChange={(e) => setReaderWidth(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Height: {readerHeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={readerHeight}
                    onChange={(e) => setReaderHeight(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Padding and Margin */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Maximize className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Spacing
                </label>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                    Padding (text to border)
                  </label>
                  <select
                    value={paddingSize}
                    onChange={(e) => setPaddingSize(e.target.value as 'small' | 'medium' | 'large' | 'extra-large')}
                    className={`w-full px-2 py-1 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                      isDarkMode 
                        ? 'bg-black/20 text-white/80 border-white/10' 
                        : 'bg-white/30 text-gray-700 border-white/20'
                    }`}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="extra-large">Extra Large</option>
                  </select>
                </div>
                
                <div>
                  <label className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                    Margin (lateral spacing)
                  </label>
                  <select
                    value={marginSize}
                    onChange={(e) => setMarginSize(e.target.value as 'narrow' | 'normal' | 'wide' | 'extra-wide')}
                    className={`w-full px-2 py-1 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                      isDarkMode 
                        ? 'bg-black/20 text-white/80 border-white/10' 
                        : 'bg-white/30 text-gray-700 border-white/20'
                    }`}
                  >
                    <option value="narrow">Narrow</option>
                    <option value="normal">Normal</option>
                    <option value="wide">Wide</option>
                    <option value="extra-wide">Extra Wide</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Text Spacing */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Spacing className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Text Spacing
                </label>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Word Spacing: {wordSpacing}em</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={wordSpacing}
                    onChange={(e) => setWordSpacing(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Line Height: {sentenceSpacing}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.1"
                    value={sentenceSpacing}
                    onChange={(e) => setSentenceSpacing(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Page Numbers Toggle */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Hash className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Show Page Numbers
                  </label>
                </div>
                <button
                  onClick={() => setShowPageNumbers(!showPageNumbers)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showPageNumbers
                      ? 'bg-blue-500'
                      : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showPageNumbers ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Continuous Scroll Toggle */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Scroll className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Continuous Scroll
                  </label>
                </div>
                <button
                  onClick={() => setContinuousScroll(!continuousScroll)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    continuousScroll ? 'bg-blue-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${continuousScroll ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                Affects vertical scroll mode
              </p>
            </div>

            {/* Font Size */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Type className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Font Size: {fontSize}px
                </label>
              </div>
              <input
                type="range"
                min="12"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Voice Selection */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Mic className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Voice
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
                <option value="">Default UK Male English</option>
                {availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Read Word Style */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Highlighter className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Read Word Style
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'highlight', label: 'Highlight' },
                  { value: 'bold', label: 'Bold' },
                  { value: 'underline', label: 'Underline' },
                  { value: 'italic', label: 'Italic' },
                  { value: 'off', label: 'Off' },
                ] as { value: ReadWordStyle; label: string }[]).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setReadWordStyle(value)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      readWordStyle === value
                        ? isDarkMode
                          ? 'bg-blue-500/30 text-blue-300 border-blue-400/50'
                          : 'bg-blue-500/20 text-blue-600 border-blue-500/50'
                        : isDarkMode
                          ? 'bg-black/20 text-white/70 hover:bg-black/30 border-white/10'
                          : 'bg-white/20 text-gray-600 hover:bg-white/30 border-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                How the word being read aloud is styled while playing
              </p>
            </div>

            {/* Playback Speed */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Speed: {playbackSpeed}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 border ${
                isDarkMode 
                  ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-400/30' 
                  : 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 border-blue-500/30'
              }`}
            >
              Save Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ReadingSettings;