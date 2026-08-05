import React, { useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { useBook } from '../context/BookContext';
import JSZip from 'jszip';

interface DocumentUploadProps {
  isDarkMode: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ isDarkMode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
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

  const fetchArticleFromUrl = async (rawUrl: string): Promise<{ title: string; author: string; chapters: any[] }> => {
    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    let hostname = 'Web Article';
    try {
      hostname = new URL(normalizedUrl).hostname.replace(/^www\./, '');
    } catch {
      throw new Error('That doesn\'t look like a valid URL.');
    }

    let title = '';
    let bodyText = '';

    try {
      // r.jina.ai returns a clean, readable text extraction of the page,
      // stripping nav/ads/scripts far better than a naive DOM strip.
      const response = await fetch(`https://r.jina.ai/${normalizedUrl}`);
      if (!response.ok) throw new Error(`Reader service returned ${response.status}`);
      const raw = await response.text();

      const titleMatch = raw.match(/^Title:\s*(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim();

      const contentMatch = raw.match(/Markdown Content:\s*([\s\S]*)/);
      bodyText = (contentMatch ? contentMatch[1] : raw).trim();
    } catch {
      // Fallback: fetch raw HTML through a CORS proxy and extract text ourselves
      const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`;
      const response = await fetch(proxied);
      if (!response.ok) throw new Error('Could not load that page. It may be blocking automated access.');
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, nav, header, footer, aside, noscript, iframe, svg').forEach(el => el.remove());

      title = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';

      const article = doc.querySelector('article') || doc.querySelector('main') || doc.body;
      // Join block-level elements with blank lines so paragraph structure
      // survives — .textContent on the whole article flattens everything,
      // including <p> boundaries, into one run with no separators at all.
      const blocks = Array.from(article?.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote') || []);
      bodyText = blocks.length
        ? blocks.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n')
        : (article?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    if (!title) title = hostname;

    // Pull images out before stripping markdown, so they can be shown near
    // the title instead of just vanishing. Order matters: a "click to
    // enlarge" linked image (`[![alt](img)](link)`) has to be matched before
    // the plain-image pattern, or its outer `](link)` survives as a bare
    // "(https://...)" left sitting in the text — which is what was getting
    // read aloud at the start/end of articles.
    const images: { url: string; alt: string }[] = [];
    bodyText = bodyText
      // "Click to enlarge" linked image: [![alt](img)](link). Whitespace-
      // tolerant between the bracket/paren boundaries — some sources wrap
      // this construct across a line break, which broke a stricter match.
      .replace(/\[\s*!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)\s*\]\(\s*[^)]*\)/g, (_m, alt, url) => {
        images.push({ url, alt: alt.trim() });
        return '';
      })
      .replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g, (_m, alt, url) => {
        images.push({ url, alt: alt.trim() });
        return '';
      })
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#*_`>]+/g, '')
      // Safety net for anything the patterns above didn't fully catch: a
      // bare URL still wrapped in its now-orphaned parens, or a bare URL on
      // its own.
      .replace(/\(\s*https?:\/\/[^()\s]+\s*\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    // Collapse each paragraph's internal soft-wraps to spaces but keep the
    // blank line *between* paragraphs, so the reader shows real paragraph
    // breaks instead of one flattened wall of text.
    bodyText = bodyText
      .split(/\n{2,}/)
      .map(p => p.replace(/\n/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');

    if (bodyText.length < 100) {
      throw new Error('No readable article content found at that URL.');
    }

    const seen = new Set<string>();
    const dedupedImages = images.filter(img => {
      if (!img.url || seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    }).slice(0, 20);

    const pages = splitArticleIntoPages(bodyText, 900);

    return {
      title,
      author: hostname,
      chapters: [{ title, content: pages, images: dedupedImages }]
    };
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

  // Paragraph-aware pagination for URL-loaded articles. splitIntoPages joins
  // every sentence with a single space, which is fine for prose that's
  // already been reflowed (EPUB/PDF/TXT) but flattens a blog post's
  // paragraph breaks into one wall of text. This keeps the blank line
  // between paragraphs intact so KaraokeHighlighter can render them as
  // separate <p> blocks.
  const splitArticleIntoPages = (text: string, charactersPerPage: number = 900): string[] => {
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const units: { text: string; sep: string }[] = [];
    paragraphs.forEach((para, pi) => {
      const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
      sentences.forEach((s, si) => {
        const isLastInPara = si === sentences.length - 1;
        units.push({ text: s, sep: isLastInPara ? (pi < paragraphs.length - 1 ? '\n\n' : '') : ' ' });
      });
    });

    const pages: string[] = [];
    let current = '';
    for (const u of units) {
      if (current.length + u.text.length > charactersPerPage && current.length > 0) {
        pages.push(current.trim());
        current = u.text + u.sep;
      } else {
        current += u.text + u.sep;
      }
    }
    if (current.trim()) pages.push(current.trim());
    return pages.filter(p => p.length > 0);
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

  const handleUrlImport = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = urlValue.trim();
    if (!url) return;

    setIsUploading(true);
    setUploadStatus('Fetching article...');

    try {
      const bookData = await fetchArticleFromUrl(url);

      setBook(bookData);
      addUploadedBook(bookData);
      setUploadStatus(`Loaded article: ${bookData.title}`);
      setUrlValue('');
      setShowUrlInput(false);

      setTimeout(() => {
        setUploadStatus('');
      }, 3000);
    } catch (error) {
      console.error('URL import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load that URL.';
      setUploadStatus(errorMessage);
      setTimeout(() => {
        setUploadStatus('');
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative flex items-center space-x-2">
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

      <button
        onClick={() => setShowUrlInput(prev => !prev)}
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
        title="Load article from URL"
      >
        <LinkIcon className="w-5 h-5" />
      </button>

      {showUrlInput && (
        <form
          onSubmit={handleUrlImport}
          className={`absolute top-full right-0 mt-2 p-3 rounded-xl glass border z-50 w-80 flex items-center space-x-2 ${
            isDarkMode ? 'bg-black/40 border-white/10' : 'bg-white/40 border-white/20'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <input
            type="text"
            autoFocus
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="Paste an article or blog post URL"
            disabled={isUploading}
            className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-sm bg-transparent border focus:outline-none ${
              isDarkMode
                ? 'border-white/20 text-white placeholder-white/40'
                : 'border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
          <button
            type="submit"
            disabled={isUploading || !urlValue.trim()}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isUploading || !urlValue.trim()
                ? 'opacity-50 cursor-not-allowed'
                : isDarkMode
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-gray-900/10 text-gray-900 hover:bg-gray-900/20'
            }`}
          >
            Load
          </button>
          <button
            type="button"
            onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
            className={isDarkMode ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

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