import React, { useEffect } from 'react';
import { useBook } from '../context/BookContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, Square } from 'lucide-react';

interface AudioControlsProps {
  isDarkMode: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({ isDarkMode }) => {
  const { 
    isPlaying, 
    playbackSpeed, 
    volume,
    togglePlayback, 
    setPlaybackSpeed, 
    setVolume,
    goToPreviousPage,
    goToNextPage,
    stopPlayback
  } = useBook();

  // Add spacebar keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Prevent default only if not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          togglePlayback();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayback]);

  return (
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-4">
      {/* Previous */}
      <button
        onClick={goToPreviousPage}
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
        <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* Play/Pause - Changes icon based on state */}
      <button
        onClick={togglePlayback}
        className={`p-3 md:p-4 rounded-xl md:rounded-2xl glass transition-all duration-200 hover:scale-105 border ${
          isDarkMode 
            ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 border-blue-400/30' 
            : 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 hover:text-blue-700 border-blue-500/30'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6" />}
      </button>

      {/* Stop - Always visible, disabled when not playing */}
      <button
        onClick={stopPlayback}
        disabled={!isPlaying}
        className={`p-2 md:p-3 rounded-xl md:rounded-2xl glass transition-all duration-200 hover:scale-105 border ${
          !isPlaying
            ? `opacity-40 cursor-not-allowed ${isDarkMode ? 'bg-black/10 text-white/40 border-white/5' : 'bg-white/10 text-gray-400 border-white/10'}`
            : isDarkMode 
              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:text-red-200 border-red-400/30' 
              : 'bg-red-500/20 text-red-600 hover:bg-red-500/30 hover:text-red-700 border-red-500/30'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <Square className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* Next */}
      <button
        onClick={goToNextPage}
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
        <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* Speed Control */}
      <div className="flex items-center space-x-2">
        <span className={`text-xs md:text-sm font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
          Speed:
        </span>
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className={`px-2 md:px-3 py-1 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 glass border ${
            isDarkMode 
              ? 'bg-black/20 text-white/80 border-white/10' 
              : 'bg-white/30 text-gray-700 border-white/20'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.2}>1.2x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
          <option value={2.5}>2.5x</option>
          <option value={3}>3x</option>
        </select>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-2">
        <Volume2 className={`w-3 h-3 md:w-4 md:h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-12 md:w-20 accent-blue-500"
        />
      </div>
    </div>
  );
};

export default AudioControls;