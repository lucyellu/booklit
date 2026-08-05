import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type ReadWordStyle = 'highlight' | 'bold' | 'underline' | 'italic' | 'off';

export interface Chapter {
  title: string;
  content: string[];
}

export interface Book {
  title: string;
  author: string;
  chapters: Chapter[];
}

export interface Bookmark {
  id: string;
  chapterIndex: number;
  pageIndex: number;
  text: string;
  timestamp: string;
}

export interface TextHighlight {
  id: string;
  chapterIndex: number;
  pageIndex: number;
  selectedText: string;
  // Position of the selection within the page, in word units — used instead
  // of re-searching for selectedText so a repeated word/phrase only highlights
  // the one occurrence that was actually selected.
  startWordIndex: number;
  wordCount: number;
  color: string;
  timestamp: string;
}

export interface LocalBook {
  id: string;
  title: string;
  author: string;
  handle?: FileSystemFileHandle;
  bookData?: Book;
  lastRead: string;
  progress: number;
  rating: number;
  pages: number;
  bookmarks: number;
  highlights: number;
}

interface BookContextType {
  book: Book;
  currentChapterIndex: number;
  currentChapter: Chapter | null;
  currentPage: number;
  totalPages: number;
  isPlaying: boolean;
  highlightedWordIndex: number;
  readWordIndices: number[];
  readWordStyle: ReadWordStyle;
  playbackSpeed: number;
  volume: number;
  fontSize: number;
  selectedVoice: SpeechSynthesisVoice | null;
  columnCount: number;
  wordSpacing: number;
  sentenceSpacing: number;
  readerWidth: number;
  readerHeight: number;
  fontFamily: string;
  accentColor: string;
  highlightColor: string;
  autoPlayNext: boolean;
  backgroundImage: string;
  showPageNumbers: boolean;
  paddingSize: 'small' | 'medium' | 'large' | 'extra-large';
  marginSize: 'narrow' | 'normal' | 'wide' | 'extra-wide';
  pageWidth: number;
  pageHeight: number;
  containerTransparent: boolean;
  bookmarks: Bookmark[];
  isMobile: boolean;
  translationLanguage: 'none' | 'zh' | 'fr';
  translatedText: string;
  isTranslating: boolean;
  localBooks: LocalBook[];
  isLoadingLocalBooks: boolean;
  showSideBySide: boolean;
  textHighlights: TextHighlight[];
  continuousScroll: boolean;
  addTextHighlight: (highlight: Omit<TextHighlight, 'id' | 'timestamp'>) => void;
  removeTextHighlight: (id: string) => void;
  setContinuousScroll: (v: boolean) => void;

  setBook: (book: Book, startPosition?: { chapterIndex: number; wordOffset: number }) => void;
  addUploadedBook: (book: Book) => void;
  loadLocalBooks: () => Promise<void>;
  loadLocalBookContent: (fileHandle: FileSystemFileHandle) => Promise<void>;
  setCurrentChapter: (index: number) => void;
  setCurrentPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToNextChapter: () => void;
  goToPreviousChapter: () => void;
  togglePlayback: () => void;
  playFromWordIndex: (wordIndex: number) => void;
  setReadingCursor: (wordIndex: number) => void;
  stopPlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setReadWordStyle: (style: ReadWordStyle) => void;
  setVolume: (volume: number) => void;
  setFontSize: (size: number) => void;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  setColumnCount: (count: number) => void;
  setWordSpacing: (spacing: number) => void;
  setSentenceSpacing: (spacing: number) => void;
  setReaderWidth: (width: number) => void;
  setReaderHeight: (height: number) => void;
  setFontFamily: (family: string) => void;
  setAccentColor: (color: string) => void;
  setHighlightColor: (color: string) => void;
  setAutoPlayNext: (auto: boolean) => void;
  setBackgroundImage: (image: string) => void;
  setShowPageNumbers: (show: boolean) => void;
  setPaddingSize: (size: 'small' | 'medium' | 'large' | 'extra-large') => void;
  setMarginSize: (size: 'narrow' | 'normal' | 'wide' | 'extra-wide') => void;
  setPageWidth: (width: number) => void;
  setPageHeight: (height: number) => void;
  setContainerTransparent: (transparent: boolean) => void;
  repaginateCurrentChapter: () => void;
  addBookmark: () => void;
  removeBookmark: (id: string) => void;
  goToBookmark: (bookmark: Bookmark) => void;
  setTranslationLanguage: (language: 'none' | 'zh' | 'fr') => void;
  translateCurrentPage: () => Promise<void>;
  setShowSideBySide: (show: boolean) => void;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

export const useBook = () => {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBook must be used within a BookProvider');
  }
  return context;
};

interface BookProviderProps {
  children: React.ReactNode;
  initialBook: Book;
}

export const BookProvider: React.FC<BookProviderProps> = ({ children, initialBook }) => {
  const [book, setBookState] = useState<Book>(initialBook);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
  const [readWordIndices, setReadWordIndices] = useState<number[]>([]);
  const [readWordStyle, setReadWordStyle] = useState<ReadWordStyle>('highlight');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.2);
  const [volume, setVolume] = useState(0.8);
  const [fontSize, setFontSize] = useState(18);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechUtterance, setSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [wordSpacing, setWordSpacing] = useState(0);
  const [sentenceSpacing, setSentenceSpacing] = useState(1.2);
  const [readerWidth, setReaderWidth] = useState(92);
  const [readerHeight, setReaderHeight] = useState(88);
  const [fontFamily, setFontFamily] = useState('Georgia, serif');
  // '' means "follow the theme" (--rd-title), which flips with day/evening the
  // way a colour frozen into state cannot.
  const [accentColor, setAccentColor] = useState('');
  const [highlightColor, setHighlightColor] = useState('#A8B5C7');
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  /* Embedded in Booklit the reader starts on the theme ground, so the iframe has
     no seam against the host; standalone it keeps its photo. Either way the
     customizer can change it, and '' means "theme ground". */
  const [backgroundImage, setBackgroundImage] = useState(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed')
      ? ''
      : '/aranprime-KbytCpI1i5I-unsplash.jpg'
  );
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [paddingSize, setPaddingSize] = useState<'small' | 'medium' | 'large' | 'extra-large'>('medium');
  const [marginSize, setMarginSize] = useState<'narrow' | 'normal' | 'wide' | 'extra-wide'>('normal');
  const [pageWidth, setPageWidth] = useState(7.5);
  const [pageHeight, setPageHeight] = useState(4.4);
  const [containerTransparent, setContainerTransparent] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState<'none' | 'zh' | 'fr'>('none');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [textHighlights, setTextHighlights] = useState<TextHighlight[]>([]);
  const [continuousScroll, setContinuousScroll] = useState(false);
  const [localBooks, setLocalBooks] = useState<LocalBook[]>([{
    id: 'sample-book',
    title: initialBook.title,
    author: initialBook.author,
    bookData: initialBook,
    lastRead: new Date().toISOString(),
    progress: 0,
    rating: 0,
    pages: initialBook.chapters.reduce((sum, ch) => sum + ch.content.length, 0),
    bookmarks: 0,
    highlights: 0,
  }]);
  const [isLoadingLocalBooks, setIsLoadingLocalBooks] = useState(false);

  /* Many voices (most Windows/Chrome SAPI voices in particular) never fire
     per-word `onboundary` events at all, so highlightedWordIndex would sit at
     -1 for the whole utterance and no read-word style would ever show. This
     ref lets us fall back to a timer-simulated advance when we detect that's
     happening, without leaking timers across replays/cancels. */
  /* speakText() leads with speechSynthesis.cancel(), which fires the
     *previous* utterance's own onerror/onend asynchronously — including
     * whenever we cancel a still-speaking utterance to start a new one
     * (page turn while playing, click-to-read-from-word, auto-advance,
     * settings-change restart). That stale callback then lands *after* the
     * new utterance already set isPlaying(true), snapping it back to false
     * even though audio is still going. Each speakText() call bumps this
     * generation counter and every handler checks it's still current before
     * touching state, so a superseded utterance's callbacks are no-ops. */
  const utteranceGenRef = useRef(0);
  /* setBook()'s resume logic figures out which word within the target page
     to land on, but the "reset highlighting on page change" effect below
     runs right after any setCurrentPage/setCurrentChapterIndex call and
     would otherwise wipe that back to -1. This hands the value across that
     boundary — the effect consumes and clears it. */
  const pendingResumeWordIndexRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<{ timeoutId?: ReturnType<typeof setTimeout>; intervalId?: ReturnType<typeof setInterval> }>({});
  const clearFallbackHighlightTimer = useCallback(() => {
    if (fallbackTimerRef.current.timeoutId) clearTimeout(fallbackTimerRef.current.timeoutId);
    if (fallbackTimerRef.current.intervalId) clearInterval(fallbackTimerRef.current.intervalId);
    fallbackTimerRef.current = {};
  }, []);
  useEffect(() => clearFallbackHighlightTimer, [clearFallbackHighlightTimer]);

  // Load persisted library from localStorage on mount (merge with sample book)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('reader-library');
      if (stored) {
        const parsed: LocalBook[] = JSON.parse(stored);
        setLocalBooks(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const toAdd = parsed.filter(b => b.bookData && !existingIds.has(b.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Save library to localStorage whenever it changes (skip file handles)
  useEffect(() => {
    try {
      const saveable = localBooks
        .filter(b => b.bookData)
        .map(({ handle, ...rest }) => rest);
      localStorage.setItem('reader-library', JSON.stringify(saveable));
    } catch (e) { /* quota exceeded or other error */ }
  }, [localBooks]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
                           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Translation function using Google Translate API (client-side fallback)
  const translateText = async (text: string, targetLang: string): Promise<string> => {
    try {
      // Using a free translation API service (MyMemory)
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
      );
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        return data.responseData.translatedText;
      } else {
        throw new Error('Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      // Fallback: return original text if translation fails
      return text;
    }
  };

  const translateCurrentPage = async () => {
    if (translationLanguage === 'none' || !currentChapter) return;
    
    setIsTranslating(true);
    try {
      const pageContent = currentChapter.content[currentPage - 1];
      const translated = await translateText(pageContent, translationLanguage);
      setTranslatedText(translated);
    } catch (error) {
      console.error('Translation failed:', error);
      setTranslatedText('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-translate when language or page changes
  useEffect(() => {
    if (translationLanguage !== 'none') {
      translateCurrentPage();
    } else {
      setTranslatedText('');
    }
  }, [translationLanguage, currentPage, currentChapterIndex]);

  const currentChapter = book.chapters[currentChapterIndex] || null;
  const totalPages = currentChapter?.content.length || 0;

  // Function to repaginate text based on current viewport and font settings
  const repaginateText = useCallback((text: string): string[] => {
    // The sheet is readerHeight% of the viewport, not the whole of it, so size a
    // page against that: minus the outer container's padding (~48px), the text
    // column's py-8 (64px) and the chapter title with its margin (~64px).
    const sheetHeight = window.innerHeight * (readerHeight / 100);
    const availableHeight = Math.max(240, sheetHeight - 48 - 64 - 64);
    // Text sheet: max-w-2xl (672px), or max-w-6xl (1152px) for two columns,
    // minus px-8 (64px each side) and the 40px gap between the columns.
    const columnGap = 40;
    const sheetWidth = Math.min(columnCount === 2 ? 1152 : 672, window.innerWidth * 0.9) - 64;
    const availableWidth = columnCount === 2
      ? (sheetWidth - columnGap) / 2
      : sheetWidth;

    const avgCharWidth = fontSize * 0.52; // Georgia ~0.52x width ratio
    const lineHeight = fontSize * sentenceSpacing;

    const charsPerLine = Math.floor(availableWidth / avgCharWidth);
    const linesPerPage = Math.floor(availableHeight / lineHeight);
    // Two columns is two of those on one sheet.
    const charsPerPage = Math.max(800, charsPerLine * linesPerPage * columnCount);
    
    const sentences = text.split(/(?<=[.!?])\s+/);
    const pages: string[] = [];
    let currentPageText = '';
    
    for (const sentence of sentences) {
      const testText = currentPageText + (currentPageText ? ' ' : '') + sentence;
      
      if (testText.length > charsPerPage && currentPageText.length > 0) {
        const trimmedPage = currentPageText.trim();
        if (trimmedPage) {
          pages.push(trimmedPage);
        }
        currentPageText = sentence;
      } else {
        currentPageText = testText;
      }
    }
    
    if (currentPageText.trim()) {
      pages.push(currentPageText.trim());
    }
    
    return pages.filter(page => page.length > 0);
  }, [fontSize, sentenceSpacing, readerHeight, columnCount]);

  const repaginateCurrentChapter = useCallback(() => {
    if (currentChapter) {
      const fullText = currentChapter.content.join(' ');
      const newPages = repaginateText(fullText);
      
      const updatedChapters = [...book.chapters];
      updatedChapters[currentChapterIndex] = {
        ...currentChapter,
        content: newPages
      };
      
      setBookState({
        ...book,
        chapters: updatedChapters
      });
      
      if (currentPage > newPages.length) {
        setCurrentPage(Math.max(1, newPages.length));
      }
    }
  }, [currentChapter, currentChapterIndex, book, currentPage, repaginateText]);

  useEffect(() => {
    if (currentChapter) {
      repaginateCurrentChapter();
    }
  }, [fontSize, sentenceSpacing, readerHeight, columnCount]);

  // Repaginate on window resize
  useEffect(() => {
    const handleResize = () => {
      if (currentChapter) repaginateCurrentChapter();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [repaginateCurrentChapter]);

  const setBook = useCallback((newBook: Book, startPosition?: { chapterIndex: number; wordOffset: number }) => {
    /* Pages arrive at whatever size whoever produced them chose — the Booklit
       host splits chapters at 900 characters, about half of what a sheet holds
       here, which is why an imported book only filled the top half of the page.
       Repagination used to run on a font change or a resize and never on load,
       so nothing ever corrected it. Reflow to this viewport up front. */
    const reflowed: Book = {
      ...newBook,
      chapters: newBook.chapters.map(ch => {
        const pages = repaginateText(ch.content.join(' '));
        return pages.length ? { ...ch, content: pages } : ch;
      }),
    };
    setBookState(reflowed);

    /* Resume where reading left off. wordOffset counts into the chapter's
       full text rather than a page index, since pages get re-cut by the
       reflow above whenever font size/viewport/columns differ from last
       time — re-walking THIS pagination's pages to find which one now
       covers that offset lands on the right page regardless, and the
       remainder after subtracting the words on every page before it is
       exactly which word on THAT page to resume from. */
    let startChapterIndex = 0;
    let startPage = 1;
    let startWordIndexInPage = 0;
    if (startPosition && startPosition.chapterIndex < reflowed.chapters.length) {
      startChapterIndex = startPosition.chapterIndex;
      const pages = reflowed.chapters[startChapterIndex].content;
      let wordsSeen = 0;
      for (let i = 0; i < pages.length; i++) {
        const pageWords = (pages[i].match(/\S+/g) || []).length;
        if (wordsSeen + pageWords > startPosition.wordOffset || i === pages.length - 1) {
          startPage = i + 1;
          startWordIndexInPage = pageWords > 0
            ? Math.max(0, Math.min(pageWords - 1, startPosition.wordOffset - wordsSeen))
            : 0;
          break;
        }
        wordsSeen += pageWords;
      }
    }

    pendingResumeWordIndexRef.current = startPosition ? startWordIndexInPage : null;
    setCurrentChapterIndex(startChapterIndex);
    setCurrentPage(startPage);
    setIsPlaying(false);
    speechSynthesis.cancel();
    setHighlightedWordIndex(startPosition ? startWordIndexInPage : -1);
    setReadWordIndices([]);
    setBookmarks([]);
  }, [repaginateText]);

  const addUploadedBook = useCallback((newBook: Book) => {
    const entry: LocalBook = {
      id: `uploaded-${Date.now()}`,
      title: newBook.title,
      author: newBook.author,
      bookData: newBook,
      lastRead: new Date().toISOString(),
      progress: 0,
      rating: 0,
      pages: newBook.chapters.reduce((sum, ch) => sum + ch.content.length, 0),
      bookmarks: 0,
      highlights: 0,
    };
    setLocalBooks(prev => {
      const exists = prev.some(b => b.title === entry.title && b.author === entry.author);
      return exists ? prev : [entry, ...prev];
    });
  }, []);

  const addTextHighlight = useCallback((h: Omit<TextHighlight, 'id' | 'timestamp'>) => {
    setTextHighlights(prev => [...prev, { ...h, id: Date.now().toString(), timestamp: new Date().toISOString() }]);
  }, []);

  const removeTextHighlight = useCallback((id: string) => {
    setTextHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

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

  const createChaptersFromText = (text: string) => {
    const chapterSplits = text.split(/(?:^|\n)\s*(?:Chapter|CHAPTER|Ch\.|CH\.)\s*\d+/i);
    
    if (chapterSplits.length > 1) {
      return chapterSplits.slice(1).map((chapterText, index) => {
        const pages = splitIntoPages(chapterText.trim());
        return {
          title: `Chapter ${index + 1}`,
          content: pages
        };
      });
    } else {
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
        const pages = splitIntoPages(text);
        const chaptersFromPages = [];
        const pagesPerChapter = Math.max(3, Math.ceil(pages.length / 10));
        
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

  const loadLocalBooks = async () => {
    setIsLoadingLocalBooks(true);
    try {
      const directoryHandle = await (window as any).showDirectoryPicker();
      const books: LocalBook[] = [];
      
      const scanDirectory = async (handle: FileSystemDirectoryHandle) => {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            if (entry.name.toLowerCase().endsWith('.epub')) {
              books.push({
                id: entry.name,
                title: entry.name.replace(/\.[^/.]+$/, ''),
                author: 'Local EPUB',
                handle: entry as FileSystemFileHandle,
                lastRead: new Date().toISOString(),
                progress: 0,
                rating: 0,
                pages: 0,
                bookmarks: 0,
                highlights: 0
              });
            }
          } else if (entry.kind === 'directory') {
            await scanDirectory(entry);
          }
        }
      };

      await scanDirectory(directoryHandle);
      setLocalBooks(books);
    } catch (error) {
      console.error('Failed to load local books:', error);
    } finally {
      setIsLoadingLocalBooks(false);
    }
  };

  const loadLocalBookContent = async (fileHandle: FileSystemFileHandle) => {
    try {
      const file = await fileHandle.getFile();
      const fileExtension = file.name.toLowerCase().split('.').pop();
      let bookData: Book;

      if (fileExtension === 'txt' || fileExtension === 'md') {
        const text = await file.text();
        bookData = {
          title: file.name.replace(/\.[^/.]+$/, ''),
          author: 'Local File',
          chapters: createChaptersFromText(text)
        };
        setBook(bookData);
      } else if (fileExtension === 'epub') {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);

        // OPF parsing logic (simplified from DocumentUpload)
        let opfFile = null;
        let opfContent = '';
        let opfBasePath = '';
        const containerFile = zipContent.file('META-INF/container.xml');
        if (containerFile) {
          const containerXml = await containerFile.async('text');
          const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
          if (opfPathMatch) {
            const opfPath = opfPathMatch[1];
            const slashIdx = opfPath.lastIndexOf('/');
            opfBasePath = slashIdx >= 0 ? opfPath.substring(0, slashIdx + 1) : '';
            opfFile = zipContent.file(opfPath);
          }
        }

        if (!opfFile) {
          const opfFiles = Object.keys(zipContent.files).filter(name => name.endsWith('.opf'));
          if (opfFiles.length > 0) {
            const opfPath = opfFiles[0];
            const slashIdx = opfPath.lastIndexOf('/');
            opfBasePath = slashIdx >= 0 ? opfPath.substring(0, slashIdx + 1) : '';
            opfFile = zipContent.file(opfPath);
          }
        }
        
        if (opfFile) opfContent = await opfFile.async('text');
        
        let title = file.name.replace(/\.[^/.]+$/, '');
        let author = 'Unknown Author';
        if (opfContent) {
          const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
          const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
          if (titleMatch) title = titleMatch[1].trim();
          if (authorMatch) author = authorMatch[1].trim();
        }
        
        const spineItems: string[] = [];
        if (opfContent) {
          const spineMatches = opfContent.match(/<spine[^>]*>(.*?)<\/spine>/is);
          if (spineMatches) {
            const itemrefMatches = spineMatches[1].match(/<itemref[^>]*idref="([^"]+)"/g);
            if (itemrefMatches) {
              itemrefMatches.forEach(match => {
                const idMatch = match.match(/idref="([^"]+)"/);
                if (idMatch) {
                  const manifestMatch = opfContent.match(new RegExp(`<item[^>]*id="${idMatch[1]}"[^>]*href="([^"]+)"`, 'i'));
                  if (manifestMatch) spineItems.push(manifestMatch[1]);
                }
              });
            }
          }
        }
        
        const chapters: any[] = [];
        let chapterIndex = 1;
        for (const filename of spineItems) {
          const zipFile = zipContent.file(opfBasePath + filename) || zipContent.file(filename);
          if (zipFile) {
            const content = await zipFile.async('text');
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            doc.querySelectorAll('script, style').forEach(el => el.remove());
            let textContent = doc.body?.textContent || doc.documentElement?.textContent || '';
            textContent = textContent.replace(/\s+/g, ' ').trim();
            
            if (textContent.length > 100) {
              let chapterTitle = `Chapter ${chapterIndex}`;
              const headings = doc.querySelectorAll('h1, h2, h3');
              if (headings.length > 0) chapterTitle = headings[0].textContent?.trim() || chapterTitle;
              
              chapters.push({
                title: chapterTitle,
                content: splitIntoPages(textContent)
              });
              chapterIndex++;
            }
          }
        }
        
        bookData = { title, author, chapters };
        setBook(bookData);
      }
    } catch (error) {
      console.error('Failed to load book content:', error);
    }
  };

  const setCurrentChapter = useCallback((index: number) => {
    if (index >= 0 && index < book.chapters.length) {
      setCurrentChapterIndex(index);
      setCurrentPage(1);
      setIsPlaying(false);
      speechSynthesis.cancel();
      setHighlightedWordIndex(-1);
      setReadWordIndices([]);
    }
  }, [book.chapters.length]);

  const goToNextPage = useCallback(() => {
    if (currentChapter && currentPage < currentChapter.content.length) {
      setCurrentPage(prev => prev + 1);
      setHighlightedWordIndex(-1);
      setReadWordIndices([]);
    } else {
      goToNextChapter();
    }
  }, [currentChapter, currentPage]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setHighlightedWordIndex(-1);
      setReadWordIndices([]);
    } else {
      goToPreviousChapter();
    }
  }, [currentPage]);

  const goToNextChapter = useCallback(() => {
    if (currentChapterIndex < book.chapters.length - 1) {
      setCurrentChapter(currentChapterIndex + 1);
    }
  }, [currentChapterIndex, book.chapters.length, setCurrentChapter]);

  const goToPreviousChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      setCurrentChapter(currentChapterIndex - 1);
      const prevChapter = book.chapters[currentChapterIndex - 1];
      setCurrentPage(prevChapter.content.length);
    }
  }, [currentChapterIndex, book.chapters, setCurrentChapter]);

  const stopPlayback = useCallback(() => {
    utteranceGenRef.current++; // invalidate the cancelled utterance's own onerror/onend
    clearFallbackHighlightTimer();
    speechSynthesis.cancel();
    setIsPlaying(false);
    setHighlightedWordIndex(-1);
  }, [clearFallbackHighlightTimer]);

  const speakText = useCallback((text: string, startWordIndex: number = 0) => {
    const gen = ++utteranceGenRef.current;
    clearFallbackHighlightTimer();
    speechSynthesis.cancel();
    setReadWordIndices([]);

    // Determine what text to speak based on translation mode
    let textToSpeak = text;
    let voiceLang = 'en';

    if (translationLanguage !== 'none' && translatedText) {
      if (showSideBySide) {
        // In side-by-side mode, speak the translated text
        textToSpeak = translatedText;
        voiceLang = translationLanguage;
      } else {
        // In overlay mode, speak original text
        textToSpeak = text;
        voiceLang = 'en';
      }
    }

    // Jumping into the middle of the page only makes sense when we're
    // actually speaking the original text — a translated overlay has its own
    // word boundaries that don't line up with startWordIndex. Slice both the
    // utterance and the word counter to the same starting point so the
    // karaoke highlight lands on the right word instead of drifting.
    let initialWordIndex = 0;
    if (startWordIndex > 0 && textToSpeak === text) {
      const startMatch = [...text.matchAll(/\S+/g)][startWordIndex];
      if (startMatch) {
        textToSpeak = text.slice(startMatch.index ?? 0);
        initialWordIndex = startWordIndex;
      }
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = playbackSpeed;
    utterance.volume = volume;
    
    // Set voice based on what we're actually speaking
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      const voices = speechSynthesis.getVoices();
      
      let preferredVoice = null;
      
      if (voiceLang === 'zh') {
        // Chinese voices
        preferredVoice = voices.find(voice => 
          voice.lang.includes('zh') || voice.lang.includes('cmn')
        );
      } else if (voiceLang === 'fr') {
        // French voices
        preferredVoice = voices.find(voice => 
          voice.lang.includes('fr')
        );
      } else {
        // English voices (UK Male preferred)
        preferredVoice = voices.find(voice => 
          voice.lang.includes('en-GB') && 
          (voice.name.toLowerCase().includes('male') || 
           voice.name.toLowerCase().includes('daniel') ||
           voice.name.toLowerCase().includes('arthur'))
        ) || voices.find(voice => voice.lang.includes('en-GB')) || voices.find(voice => voice.lang.startsWith('en'));
      }
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    // Extract words from text (matching our rendering logic)
    const words = text.match(/\S+/g) || []; // Always use original text for word tracking
    let currentWordIndex = initialWordIndex;
    let charPosition = 0;

    console.log('Starting speech with words:', words, 'Speaking:', voiceLang, 'Text:', textToSpeak.substring(0, 50)); // Debug log

    // Some voices (notably local Windows/SAPI voices in Chrome) never emit
    // per-word onboundary events. If we don't see a real one shortly after
    // speech starts, fall back to advancing the highlight on a timer paced
    // to the utterance's own rate, so highlighting still works either way.
    let boundaryFired = false;
    let simulating = false;

    const advanceSimulatedWord = () => {
      if (gen !== utteranceGenRef.current) return;
      if (currentWordIndex > initialWordIndex) {
        setReadWordIndices(prev =>
          prev.includes(currentWordIndex - 1) ? prev : [...prev, currentWordIndex - 1]
        );
      }
      if (currentWordIndex >= words.length) {
        clearFallbackHighlightTimer();
        return;
      }
      setHighlightedWordIndex(currentWordIndex);
      currentWordIndex++;
    };

    utterance.onstart = () => {
      if (gen !== utteranceGenRef.current) return;
      fallbackTimerRef.current.timeoutId = setTimeout(() => {
        if (gen !== utteranceGenRef.current) return;
        if (boundaryFired) return;
        simulating = true;
        const msPerWord = Math.max(120, 60000 / (155 * (utterance.rate || 1)));
        advanceSimulatedWord();
        fallbackTimerRef.current.intervalId = setInterval(advanceSimulatedWord, msPerWord);
      }, 350);
    };

    utterance.onboundary = (event) => {
      if (gen !== utteranceGenRef.current) return;
      if (event.name === 'word') {
        if (simulating) return; // already timer-driven; ignore late/duplicate real events
        boundaryFired = true;
        clearFallbackHighlightTimer();
        console.log(`Word boundary at char ${event.charIndex}, word index: ${currentWordIndex}`); // Debug log

        // Mark previous word as read
        if (currentWordIndex > initialWordIndex) {
          setReadWordIndices(prev => {
            if (!prev.includes(currentWordIndex - 1)) {
              return [...prev, currentWordIndex - 1];
            }
            return prev;
          });
        }

        // Highlight current word
        setHighlightedWordIndex(currentWordIndex);
        currentWordIndex++;
      }
    };

    utterance.onend = () => {
      if (gen !== utteranceGenRef.current) return;
      console.log('Speech ended'); // Debug log
      clearFallbackHighlightTimer();

      // Mark the last word as read
      if (currentWordIndex > initialWordIndex) {
        setReadWordIndices(prev => {
          const lastWordIndex = Math.min(currentWordIndex - 1, words.length - 1);
          if (!prev.includes(lastWordIndex)) {
            return [...prev, lastWordIndex];
          }
          return prev;
        });
      }
      
      setHighlightedWordIndex(-1);
      setIsPlaying(false);
      
      // Auto-play next page if enabled
      if (autoPlayNext) {
        setTimeout(() => {
          if (currentChapter && currentPage < currentChapter.content.length) {
            setCurrentPage(prev => prev + 1);
            setTimeout(() => {
              const nextPageContent = currentChapter.content[currentPage];
              if (nextPageContent) {
                setIsPlaying(true);
                speakText(nextPageContent);
              }
            }, 500);
          } else if (currentChapterIndex < book.chapters.length - 1) {
            setCurrentChapter(currentChapterIndex + 1);
            setTimeout(() => {
              const nextChapter = book.chapters[currentChapterIndex + 1];
              if (nextChapter && nextChapter.content[0]) {
                setIsPlaying(true);
                speakText(nextChapter.content[0]);
              }
            }, 500);
          }
        }, 1000);
      }
    };

    utterance.onerror = (event) => {
      if (gen !== utteranceGenRef.current) return;
      console.error('Speech error:', event); // Debug log
      clearFallbackHighlightTimer();
      setIsPlaying(false);
      setHighlightedWordIndex(-1);
    };

    setSpeechUtterance(utterance);
    speechSynthesis.speak(utterance);
  }, [playbackSpeed, volume, selectedVoice, autoPlayNext, currentChapter, currentPage, currentChapterIndex, book.chapters.length, setCurrentChapter, translationLanguage, translatedText, clearFallbackHighlightTimer]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      // Bump the generation *before* cancelling — cancel() fires the
      // now-stopping utterance's own onerror asynchronously (browsers treat
      // an intentional cancel as an "interrupted" error), and that handler
      // would otherwise reset highlightedWordIndex to -1 right after we
      // deliberately leave it in place below, undoing the resume point.
      utteranceGenRef.current++;
      clearFallbackHighlightTimer();
      speechSynthesis.cancel();
      setIsPlaying(false);
      // Leave highlightedWordIndex where it is (don't reset to -1) — that's
      // the resume point for the next Play press, below. It still gets
      // cleared on an actual page/chapter change or Stop, both of which mean
      // "start over", unlike Pause.
    } else {
      if (currentChapter && currentPage <= currentChapter.content.length) {
        const pageContent = translationLanguage !== 'none' && translatedText
          ? translatedText
          : currentChapter.content[currentPage - 1];
        console.log('Starting playback for page content:', pageContent); // Debug log
        setIsPlaying(true);
        speakText(pageContent, highlightedWordIndex >= 0 ? highlightedWordIndex : 0);
      }
    }
  }, [isPlaying, currentChapter, currentPage, speakText, translationLanguage, translatedText, clearFallbackHighlightTimer, highlightedWordIndex]);

  // Jump playback to a specific word on the current page — used by the
  // drag-select popup's explicit "Play from here" action, where the click is
  // itself the decision to start.
  const playFromWordIndex = useCallback((wordIndex: number) => {
    if (!currentChapter || currentPage > currentChapter.content.length) return;
    const pageContent = translationLanguage !== 'none' && translatedText
      ? translatedText
      : currentChapter.content[currentPage - 1];
    if (!pageContent) return;
    setIsPlaying(true);
    speakText(pageContent, wordIndex);
  }, [currentChapter, currentPage, speakText, translationLanguage, translatedText]);

  // Mark where the next Play press should start, without starting it —
  // used when the reader double-clicks a word to pick a spot. Stops any
  // playback already in progress rather than leaving it reading from the
  // old position while the highlight jumps elsewhere.
  const setReadingCursor = useCallback((wordIndex: number) => {
    utteranceGenRef.current++; // invalidate any in-flight utterance's callbacks
    clearFallbackHighlightTimer();
    speechSynthesis.cancel();
    setIsPlaying(false);
    setHighlightedWordIndex(wordIndex);
  }, [clearFallbackHighlightTimer]);

  // Bookmark functions
  const addBookmark = useCallback(() => {
    if (currentChapter && currentPage <= currentChapter.content.length) {
      const pageContent = currentChapter.content[currentPage - 1];
      const preview = pageContent.substring(0, 100) + (pageContent.length > 100 ? '...' : '');
      
      const bookmark: Bookmark = {
        id: Date.now().toString(),
        chapterIndex: currentChapterIndex,
        pageIndex: currentPage - 1,
        text: preview,
        timestamp: new Date().toISOString()
      };
      
      setBookmarks(prev => [...prev, bookmark]);
    }
  }, [currentChapter, currentPage, currentChapterIndex]);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
  }, []);

  const goToBookmark = useCallback((bookmark: Bookmark) => {
    setCurrentChapterIndex(bookmark.chapterIndex);
    setCurrentPage(bookmark.pageIndex + 1);
    setHighlightedWordIndex(-1);
    setReadWordIndices([]);
  }, []);

  // Update speech settings when they change during playback
  useEffect(() => {
    if (speechUtterance && isPlaying) {
      speechSynthesis.cancel();
      if (currentChapter && currentPage <= currentChapter.content.length) {
        const pageContent = currentChapter.content[currentPage - 1];
        speakText(pageContent, highlightedWordIndex >= 0 ? highlightedWordIndex : 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackSpeed, volume, selectedVoice]);

  // Reset highlighting when page changes — unless setBook() just handed us a
  // resume position for this exact page change, in which case land there
  // instead of at the top.
  useEffect(() => {
    const pending = pendingResumeWordIndexRef.current;
    pendingResumeWordIndexRef.current = null;
    setHighlightedWordIndex(pending ?? -1);
    setReadWordIndices([]);
  }, [currentPage, currentChapterIndex]);

  // Tell the host (Booklit) where we are, so it can persist it and resume
  // here next time. Fires on page/chapter changes (manual turns, TTS
  // auto-advance) *and* as highlightedWordIndex moves through the current
  // page during playback — a short, single-page article never changes
  // currentPage at all, so without the word-level component here, reading
  // one start-to-finish would never register as "progress" and it would
  // never show up in history. No-op when not embedded in an iframe.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    if (!currentChapter) return;
    const wordsBeforePage = currentChapter.content
      .slice(0, currentPage - 1)
      .reduce((sum, page) => sum + (page.match(/\S+/g) || []).length, 0);
    // Natural completion resets highlightedWordIndex to -1 (so the karaoke
    // highlight doesn't linger), which would otherwise make "finished the
    // whole page" report back as "start of page" — readWordIndices still
    // holds the true high-water mark until the next speakText() clears it.
    const furthest = Math.max(highlightedWordIndex, readWordIndices.length ? Math.max(...readWordIndices) : -1);
    const wordOffset = wordsBeforePage + Math.max(0, furthest);
    window.parent.postMessage({
      type: 'booklit:progress',
      chapterIndex: currentChapterIndex,
      wordOffset,
    }, '*');
  }, [currentPage, currentChapterIndex, currentChapter, highlightedWordIndex, readWordIndices]);

  // Load voices when available - prioritize UK Male English
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0 && !selectedVoice) {
        // Try to find UK Male English voice (Google UK English Male, Daniel, etc.)
        const ukMaleVoice = voices.find(voice => 
          voice.lang.includes('en-GB') && 
          (voice.name.toLowerCase().includes('male') || 
           voice.name.toLowerCase().includes('daniel') ||
           voice.name.toLowerCase().includes('arthur'))
        ) || voices.find(voice => voice.lang.includes('en-GB')) || voices.find(voice => voice.lang.startsWith('en'));
        
        setSelectedVoice(ukMaleVoice || voices[0]);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice]);

  const value: BookContextType = {
    book,
    currentChapterIndex,
    currentChapter,
    currentPage,
    totalPages,
    isPlaying,
    highlightedWordIndex,
    readWordIndices,
    readWordStyle,
    playbackSpeed,
    volume,
    fontSize,
    selectedVoice,
    columnCount,
    wordSpacing,
    sentenceSpacing,
    readerWidth,
    readerHeight,
    fontFamily,
    accentColor,
    highlightColor,
    autoPlayNext,
    backgroundImage,
    showPageNumbers,
    paddingSize,
    marginSize,
    pageWidth,
    pageHeight,
    containerTransparent,
    bookmarks,
    isMobile,
    translationLanguage,
    translatedText,
    isTranslating,
    showSideBySide,
    textHighlights,
    continuousScroll,
    addTextHighlight,
    removeTextHighlight,
    setContinuousScroll,
    localBooks,
    isLoadingLocalBooks,

    setBook,
    addUploadedBook,
    loadLocalBooks,
    loadLocalBookContent,
    setCurrentChapter,
    setCurrentPage,
    goToNextPage,
    goToPreviousPage,
    goToNextChapter,
    goToPreviousChapter,
    togglePlayback,
    playFromWordIndex,
    setReadingCursor,
    stopPlayback,
    setPlaybackSpeed,
    setReadWordStyle,
    setVolume,
    setFontSize,
    setSelectedVoice,
    setColumnCount,
    setWordSpacing,
    setSentenceSpacing,
    setReaderWidth,
    setReaderHeight,
    setFontFamily,
    setAccentColor,
    setHighlightColor,
    setAutoPlayNext,
    setBackgroundImage,
    setShowPageNumbers,
    setPaddingSize,
    setMarginSize,
    setPageWidth,
    setPageHeight,
    setContainerTransparent,
    repaginateCurrentChapter,
    addBookmark,
    removeBookmark,
    goToBookmark,
    setTranslationLanguage,
    translateCurrentPage,
    setShowSideBySide,
  };

  return (
    <BookContext.Provider value={value}>
      {children}
    </BookContext.Provider>
  );
};