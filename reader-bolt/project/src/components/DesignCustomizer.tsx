import React, { useState, useRef } from 'react';
import { useBook } from '../context/BookContext';
import { Palette, Type, Upload, Image, Highlighter } from 'lucide-react';
import { ThemeType } from '../App';

interface DesignCustomizerProps {
  isDarkMode: boolean;
  selectedTheme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
}

const DesignCustomizer: React.FC<DesignCustomizerProps> = ({ 
  isDarkMode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    fontFamily,
    setFontFamily,
    accentColor,
    setAccentColor,
    highlightColor,
    setHighlightColor,
    backgroundImage,
    setBackgroundImage
  } = useBook();

  const backgroundImages = [
    { 
      name: 'Current Background', 
      url: '/aranprime-KbytCpI1i5I-unsplash.jpg',
      preview: '/aranprime-KbytCpI1i5I-unsplash.jpg'
    }
  ];

  const fonts = [
    { id: 'Georgia, serif', name: 'Georgia' },
    { id: 'Times New Roman, serif', name: 'Times' },
    { id: 'Garamond, serif', name: 'Garamond' },
    { id: 'Palatino, serif', name: 'Palatino' },
    { id: 'system-ui, sans-serif', name: 'System' },
    { id: 'Inter, sans-serif', name: 'Inter' }
  ];

  const accentColors = [
    { name: 'Pale Gray-Blue', value: '#A8B5C7' },
    { name: 'Soft Green', value: '#B8D6C5' },
    { name: 'Warm Peach', value: '#D6C5B8' },
    { name: 'Lavender', value: '#C5B8D6' },
    { name: 'Rose Gold', value: '#D6B8C5' },
    { name: 'Mint', value: '#B8D6D6' }
  ];

  const highlightColors = [
    { name: 'Light Gray-Blue', value: '#A8B5C7' },
    { name: 'Soft Yellow', value: '#F5E6A3' },
    { name: 'Light Green', value: '#B8D6C5' },
    { name: 'Light Blue', value: '#A3C4F3' },
    { name: 'Light Pink', value: '#F8BBD9' },
    { name: 'Light Orange', value: '#FFD3A5' }
  ];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBackgroundImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 md:p-3 rounded-xl md:rounded-2xl backdrop-blur-xl transition-all duration-200 hover:scale-105 border ${
          isDarkMode 
            ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
            : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
      >
        <Palette className="w-4 h-4 md:w-5 md:h-5" />
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
              Design Customizer
            </h3>
            
            {/* Background Images */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Image className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Background
                </label>
              </div>
              
              {/* Current Background */}
              <div className="grid grid-cols-1 gap-2 mb-2">
                {backgroundImages.map((bg) => (
                  <button
                    key={bg.url}
                    onClick={() => setBackgroundImage(bg.url)}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                      backgroundImage === bg.url
                        ? 'border-blue-400 ring-2 ring-blue-400/30'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <img 
                      src={bg.preview} 
                      alt={bg.name}
                      className="w-full h-16 object-cover"
                    />
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${
                      isDarkMode ? 'text-white' : 'text-white'
                    }`}>
                      <span className="text-xs font-medium">{bg.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed transition-all duration-200 ${
                  isDarkMode 
                    ? 'border-white/30 hover:border-white/50 text-white/70 hover:text-white' 
                    : 'border-gray-400 hover:border-gray-600 text-gray-600 hover:text-gray-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Upload Image</span>
              </button>
            </div>

            {/* Font Selection */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Type className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Font Family
                </label>
              </div>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                  isDarkMode 
                    ? 'bg-black/20 text-white/80 border-white/10' 
                    : 'bg-white/30 text-gray-700 border-white/20'
                }`}
              >
                {fonts.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Accent Color */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Accent Color
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {accentColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setAccentColor(color.value)}
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-all duration-200 border text-xs ${
                      accentColor === color.value
                        ? isDarkMode 
                          ? 'bg-blue-500/30 border-blue-400/50' 
                          : 'bg-blue-500/20 border-blue-500/50'
                        : isDarkMode 
                          ? 'bg-black/20 hover:bg-black/30 border-white/10' 
                          : 'bg-white/20 hover:bg-white/30 border-white/20'
                    }`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full border border-white/20" 
                      style={{ backgroundColor: color.value }}
                    />
                    <span className={`font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Highlight Color */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Highlighter className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                <label className={`text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Word Highlight Color
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {highlightColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setHighlightColor(color.value)}
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-all duration-200 border text-xs ${
                      highlightColor === color.value
                        ? isDarkMode 
                          ? 'bg-blue-500/30 border-blue-400/50' 
                          : 'bg-blue-500/20 border-blue-500/50'
                        : isDarkMode 
                          ? 'bg-black/20 hover:bg-black/30 border-white/10' 
                          : 'bg-white/20 hover:bg-white/30 border-white/20'
                    }`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full border border-white/20" 
                      style={{ backgroundColor: color.value }}
                    />
                    <span className={`font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
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

export default DesignCustomizer;