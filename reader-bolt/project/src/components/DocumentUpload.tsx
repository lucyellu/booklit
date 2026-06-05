import React, { useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useBook } from '../context/BookContext';
import JSZip from 'jszip';

interface DocumentUploadProps {
  isDarkMode: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ isDarkMode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const { setBook, addUploadedBook } = useBook();

  const parseEPUB = async (file: File): Promise<{ title: string; author: string; chapters: any[] }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        // Find and parse the content.opf file to get metadata and spine
        let opfFile = null;
        let opfContent = '';
        
        // Look for META-INF/container.xml first
        const containerFile = zipContent.file('META-INF/container.xml');
        if (containerFile) {
          const containerXml = await containerFile.async('text');
          const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
          if (opfPathMatch) {
            opfFile = zipContent.file(opfPathMatch[1]);
          }
        }
        
        // Fallback: look for .opf files
        if (!opfFile) {
          const opfFiles = Object.keys(zipContent.files).filter(name => name.endsWith('.opf'));
          if (opfFiles.length > 0) {
            opfFile = zipContent.file(opfFiles[0]);
          }
        }
        
        if (opfFile) {
          opfContent = await opfFile.async('text');
        }
        
        // Extract metadata
        let title = file.name.replace(/\.[^/.]+$/, '');
        let author = 'Unknown Author';
        
        if (opfContent) {
          const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
          const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
          
          if (titleMatch) title = titleMatch[1].trim();
          if (authorMatch) author = authorMatch[1].trim();
        }
        
        // Get spine order from OPF
        const spineItems: string[] = [];
        if (opfContent) {
          const spineMatches = opfContent.match(/<spine[^>]*>(.*?)<\/spine>/is);
          if (spineMatches) {
            const itemrefMatches = spineMatches[1].match(/<itemref[^>]*idref="([^"]+)"/g);
            if (itemrefMatches) {
              itemrefMatches.forEach(match => {
                const idMatch = match.match(/idref="([^"]+)"/);
                if (idMatch) {
                  // Find the corresponding href in manifest
                  const manifestMatch = opfContent.match(new RegExp(`<item[^>]*id="${idMatch[1]}"[^>]*href="([^"]+)"`, 'i'));
                  if (manifestMatch) {
                    spineItems.push(manifestMatch[1]);
                  }
                }
              });
            }
          }
        }
        
        // If no spine found, get all HTML/XHTML files
        if (spineItems.length === 0) {
          Object.keys(zipContent.files).forEach(filename => {
            if (filename.match(/\.(x?html?)$/i) && !filename.includes('toc') && !filename.includes('nav')) {
              spineItems.push(filename);
            }
          });
          spineItems.sort(); // Basic alphabetical sort
        }
        
        // Extract text from each file in spine order
        const chapters: any[] = [];
        let chapterIndex = 1;
        
        for (const filename of spineItems) {
          const file = zipContent.file(filename);
          if (file) {
            try {
              const content = await file.async('text');
              
              // Parse HTML/XHTML content
              const parser = new DOMParser();
              const doc = parser.parseFromString(content, 'text/html');
              
              // Remove script and style elements
              const scripts = doc.querySelectorAll('script, style');
              scripts.forEach(el => el.remove());
              
              // Get text content
              let textContent = doc.body?.textContent || doc.documentElement?.textContent || '';
              
              // Clean up the text
              textContent = textContent
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n\n')
                .trim();
              
              if (textContent.length > 100) { // Only include substantial content
                // Try to extract chapter title
                let chapterTitle = `Chapter ${chapterIndex}`;
                
                // Look for headings
                const headings = doc.querySelectorAll('h1, h2, h3, .chapter-title, .title');
                if (headings.length > 0) {
                  const heading = headings[0].textContent?.trim();
                  if (heading && heading.length < 100) {
                    chapterTitle = heading;
                  }
                }
                
                // Split into pages (approximately 800-1000 characters per page)
                const pages = splitIntoPages(textContent, 900);
                
                if (pages.length > 0) {
                  chapters.push({
                    title: chapterTitle,
                    content: pages
                  });
                  chapterIndex++;
                }
              }
            } catch (error) {
              console.warn(`Failed to parse file ${filename}:`, error);
            }
          }
        }
        
        if (chapters.length === 0) {
          throw new Error('No readable content found in EPUB file');
        }
        
        resolve({ title, author, chapters });
        
      } catch (error) {
        console.error('EPUB parsing error:', error);
        reject(new Error('Failed to parse EPUB file. The file may be corrupted or use an unsupported format.'));
      }
    });
  };

  const parsePDF = async (file: File): Promise<{ title: string; author: string; chapters: any[] }> => {
    // Basic PDF text extraction (very limited without external libraries)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Very basic PDF text extraction - look for text streams
          const decoder = new TextDecoder('utf-8', { fatal: false });
          let content = decoder.decode(uint8Array);
          
          // Try to extract readable text (this is very limited)
          const textMatches = content.match(/\(([^)]+)\)/g);
          if (textMatches) {
            const extractedText = textMatches
              .map(match => match.slice(1, -1))
              .filter(text => text.length > 3 && /[a-zA-Z]/.test(text))
              .join(' ');
            
            if (extractedText.length > 100) {
              const title = file.name.replace(/\.[^/.]+$/, '');
              const chapters = createChaptersFromText(extractedText);
              resolve({ title, author: 'Unknown Author', chapters });
              return;
            }
          }
          
          throw new Error('Could not extract readable text from PDF');
        } catch (error) {
          reject(new Error('PDF parsing failed. For better results, please convert to EPUB or TXT format using Calibre or similar tools.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read PDF file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseKindle = async (file: File): Promise<{ title: string; author: string; chapters: any[] }> => {
    // Kindle files (.azw, .mobi) are proprietary and require special handling
    throw new Error('Kindle format not supported. Please convert to EPUB or TXT format using Calibre (free software) for best results.');
  };

  const createChaptersFromText = (text: string) => {
    // Split by common chapter indicators
    const chapterSplits = text.split(/(?:^|\n)\s*(?:Chapter|CHAPTER|Ch\.|CH\.)\s*\d+/i);
    
    if (chapterSplits.length > 1) {
      // Found chapter markers
      return chapterSplits.slice(1).map((chapterText, index) => {
        const pages = splitIntoPages(chapterText.trim());
        return {
          title: `Chapter ${index + 1}`,
          content: pages
        };
      });
    } else {
      // No chapter markers found, split by double line breaks
      const sections = text.split(/\n\s*\n\s*\n/).filter(section => section.trim().length > 100);
      
      if (sections.length > 1) {
        return sections.map((section, index) => {
          const lines = section.trim().split('\n').filter(line => line.trim());
          const title = lines[0]?.trim() || `Section ${index + 1}`;
          const content = lines.slice(1).join('\n').trim() || section.trim();
          
          return {
            title: title.length > 50 ? title.substring(0, 50) + '...' : title,
            content: splitIntoPages(content)
          };
        });
      } else {
        // Single section, split into multiple chapters
        const pages = splitIntoPages(text);
        const chaptersFromPages = [];
        const pagesPerChapter = Math.max(3, Math.ceil(pages.length / 10)); // 3-10 pages per chapter
        
        for (let i = 0; i < pages.length; i += pagesPerChapter) {
          chaptersFromPages.push({
            title: `Chapter ${Math.floor(i / pagesPerChapter) + 1}`,
            content: pages.slice(i, i + pagesPerChapter)
          });
        }
        
        return chaptersFromPages;
      }
    }
  };

  const splitIntoPages = (text: string, charactersPerPage: number = 900): string[] => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const pages = [];
    let currentPage = '';
    
    for (const sentence of sentences) {
      if (currentPage.length + sentence.length > charactersPerPage && currentPage.length > 0) {
        pages.push(currentPage.trim());
        currentPage = sentence;
      } else {
        currentPage += (currentPage ? ' ' : '') + sentence;
      }
    }
    
    if (currentPage.trim()) {
      pages.push(currentPage.trim());
    }
    
    return pages.filter(page => page.length > 0);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Processing...');

    try {
      let bookData: { title: string; author: string; chapters: any[] };
      const fileExtension = file.name.toLowerCase().split('.').pop();
      
      switch (fileExtension) {
        case 'epub':
          setUploadStatus('Parsing EPUB file...');
          bookData = await parseEPUB(file);
          break;
        case 'pdf':
          setUploadStatus('Extracting text from PDF...');
          bookData = await parsePDF(file);
          break;
        case 'azw':
        case 'azw3':
        case 'mobi':
          bookData = await parseKindle(file);
          break;
        case 'txt':
        case 'md':
          setUploadStatus('Processing text file...');
          const text = await file.text();
          bookData = {
            title: file.name.replace(/\.[^/.]+$/, ''),
            author: 'Unknown Author',
            chapters: createChaptersFromText(text)
          };
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: EPUB, PDF, TXT, MD`);
      }
      
      if (!bookData.chapters || bookData.chapters.length === 0) {
        throw new Error('No readable content found in the file');
      }
      
      setBook(bookData);
      addUploadedBook(bookData);
      setUploadStatus(`Upload successful! Loaded ${bookData.chapters.length} chapters.`);
      
      setTimeout(() => {
        setUploadStatus('');
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try a different file format.';
      setUploadStatus(errorMessage);
      setTimeout(() => {
        setUploadStatus('');
      }, 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.epub,.pdf,.azw,.azw3,.mobi"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={`p-2 rounded-xl glass transition-all duration-200 hover:scale-105 border ${
          isUploading
            ? 'opacity-50 cursor-not-allowed'
            : isDarkMode 
              ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
              : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        title="Upload eBook (EPUB, PDF, TXT, MD)"
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className="w-5 h-5" />
        )}
      </button>

      {uploadStatus && (
        <div className={`absolute top-full right-0 mt-2 p-3 rounded-xl glass border text-sm font-medium whitespace-nowrap z-50 max-w-xs ${
          uploadStatus.includes('failed') || uploadStatus.includes('error') || uploadStatus.includes('not supported')
            ? isDarkMode 
              ? 'bg-red-500/20 border-red-400/30 text-red-300' 
              : 'bg-red-500/20 border-red-500/30 text-red-600'
            : isDarkMode 
              ? 'bg-green-500/20 border-green-400/30 text-green-300' 
              : 'bg-green-500/20 border-green-500/30 text-green-600'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          <div className="flex items-start space-x-2">
            {uploadStatus.includes('successful') ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : uploadStatus.includes('failed') || uploadStatus.includes('error') || uploadStatus.includes('not supported') ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : null}
            <span className="text-xs leading-tight">{uploadStatus}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;