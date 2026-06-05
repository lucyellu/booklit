import React, { useState } from 'react';
import { useBook } from '../context/BookContext';
import { Download, Copy, Camera, CheckCircle, FileText } from 'lucide-react';

interface ExportOptionsProps {
  isDarkMode: boolean;
}

const ExportOptions: React.FC<ExportOptionsProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [screenshotStatus, setScreenshotStatus] = useState<string>('');
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const { book, currentChapter, currentPage, fontSize } = useBook();

  const copyToClipboard = async () => {
    try {
      // Get all text with proper spacing
      const allText = book.chapters.map(chapter => {
        const chapterText = `${chapter.title}\n\n${chapter.content.join('\n\n')}`;
        return chapterText;
      }).join('\n\n---\n\n');

      const fullText = `${book.title}\nby ${book.author}\n\n${allText}`;
      
      await navigator.clipboard.writeText(fullText);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (error) {
      setCopyStatus('Failed to copy');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  const downloadAsTextFile = () => {
    try {
      setDownloadStatus('Creating file...');
      
      // Get all text with proper spacing
      const allText = book.chapters.map(chapter => {
        const chapterText = `${chapter.title}\n\n${chapter.content.join('\n\n')}`;
        return chapterText;
      }).join('\n\n---\n\n');

      const fullText = `${book.title}\nby ${book.author}\n\n${allText}`;
      
      // Create blob and download
      const blob = new Blob([fullText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${timestamp}.txt`;
      
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setDownloadStatus('Downloaded!');
      setTimeout(() => setDownloadStatus(''), 2000);
    } catch (error) {
      setDownloadStatus('Download failed');
      setTimeout(() => setDownloadStatus(''), 2000);
    }
  };

  const takeScreenshot = async () => {
    try {
      setScreenshotStatus('Taking screenshot...');
      
      // Use html2canvas-like approach with canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Set canvas size to viewport
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Fill with current background
      const isDark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add text content
      ctx.fillStyle = isDark ? '#ffffff' : '#000000';
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      
      const text = `${book.title}\nby ${book.author}\n\nChapter: ${currentChapter?.title}\nPage ${currentPage}\n\n${currentChapter?.content[currentPage - 1] || ''}`;
      const lines = text.split('\n');
      
      let y = 100;
      lines.forEach(line => {
        if (line.trim()) {
          ctx.fillText(line, 50, y);
        }
        y += fontSize * 1.5;
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_page_${currentPage}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setScreenshotStatus('Screenshot saved!');
        }
      }, 'image/png');

      setTimeout(() => setScreenshotStatus(''), 2000);
    } catch (error) {
      setScreenshotStatus('Screenshot failed');
      setTimeout(() => setScreenshotStatus(''), 2000);
    }
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
        <Download className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className={`absolute bottom-full right-0 mb-2 p-4 md:p-6 rounded-2xl md:rounded-3xl backdrop-blur-3xl border shadow-2xl min-w-64 z-50 ${
            isDarkMode 
              ? 'bg-black/80 border-white/20' 
              : 'bg-white/80 border-white/40'
          }`}>
            <h3 className={`text-base md:text-lg font-semibold mb-3 md:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Export Options
            </h3>
            
            <div className="space-y-2">
              <button
                onClick={copyToClipboard}
                className={`w-full flex items-center space-x-3 p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 border text-sm ${
                  isDarkMode 
                    ? 'bg-black/20 hover:bg-black/30 text-white/80 hover:text-white border-white/10' 
                    : 'bg-white/20 hover:bg-white/30 text-gray-700 hover:text-gray-900 border-white/20'
                }`}
              >
                {copyStatus === 'Copied!' ? <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="font-medium">
                  {copyStatus || 'Copy Full Text'}
                </span>
              </button>

              <button
                onClick={downloadAsTextFile}
                className={`w-full flex items-center space-x-3 p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 border text-sm ${
                  isDarkMode 
                    ? 'bg-black/20 hover:bg-black/30 text-white/80 hover:text-white border-white/10' 
                    : 'bg-white/20 hover:bg-white/30 text-gray-700 hover:text-gray-900 border-white/20'
                }`}
              >
                {downloadStatus === 'Downloaded!' ? <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <FileText className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="font-medium">
                  {downloadStatus || 'Save as TXT File'}
                </span>
              </button>

              <button
                onClick={takeScreenshot}
                className={`w-full flex items-center space-x-3 p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 border text-sm ${
                  isDarkMode 
                    ? 'bg-black/20 hover:bg-black/30 text-white/80 hover:text-white border-white/10' 
                    : 'bg-white/20 hover:bg-white/30 text-gray-700 hover:text-gray-900 border-white/20'
                }`}
              >
                <Camera className="w-4 h-4 md:w-5 md:h-5" />
                <span className="font-medium">
                  {screenshotStatus || 'Save Screenshot'}
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className={`w-full mt-3 md:mt-4 py-2 md:py-3 px-4 rounded-lg md:rounded-xl text-sm font-medium transition-all duration-200 border ${
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

export default ExportOptions;