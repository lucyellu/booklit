import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import JSZip from 'jszip'

export interface Chapter {
  title: string
  content: string[]
}

export interface Book {
  title: string
  author: string
  chapters: Chapter[]
}

export interface Bookmark {
  id: string
  chapterIndex: number
  pageIndex: number
  text: string
  timestamp: string
}

export interface TextHighlight {
  id: string
  chapterIndex: number
  pageIndex: number
  selectedText: string
  color: string
  timestamp: string
}

export interface LocalBook {
  id: string
  title: string
  author: string
  coverUrl?: string
  isbn?: string
  shelf?: string
  rating?: number
  bookData?: Book
  lastRead: string
  progress: number
  pages: number
}

interface BookContextType {
  book: Book | null
  currentChapterIndex: number
  currentChapter: Chapter | null
  currentPage: number
  totalPages: number
  isPlaying: boolean
  highlightedWordIndex: number
  readWordIndices: number[]
  playbackSpeed: number
  volume: number
  fontSize: number
  selectedVoice: SpeechSynthesisVoice | null
  sentenceSpacing: number
  wordSpacing: number
  fontFamily: string
  highlightColor: string
  autoPlayNext: boolean
  bookmarks: Bookmark[]
  textHighlights: TextHighlight[]
  localBooks: LocalBook[]

  setBook: (book: Book) => void
  setCurrentChapter: (index: number) => void
  setCurrentPage: (page: number) => void
  goToNextPage: () => void
  goToPreviousPage: () => void
  goToNextChapter: () => void
  goToPreviousChapter: () => void
  togglePlayback: () => void
  stopPlayback: () => void
  setPlaybackSpeed: (speed: number) => void
  setVolume: (volume: number) => void
  setFontSize: (size: number) => void
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void
  setSentenceSpacing: (spacing: number) => void
  setWordSpacing: (spacing: number) => void
  setFontFamily: (family: string) => void
  setHighlightColor: (color: string) => void
  setAutoPlayNext: (auto: boolean) => void
  addBookmark: () => void
  removeBookmark: (id: string) => void
  goToBookmark: (bookmark: Bookmark) => void
  addTextHighlight: (h: Omit<TextHighlight, 'id' | 'timestamp'>) => void
  removeTextHighlight: (id: string) => void
  uploadFile: (file: File) => Promise<void>
  importCSV: (file: File) => Promise<number>
}

const BookContext = createContext<BookContextType | undefined>(undefined)

export function useBook() {
  const ctx = useContext(BookContext)
  if (!ctx) throw new Error('useBook must be used within BookProvider')
  return ctx
}

function splitIntoPages(text: string, charsPerPage = 900): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const pages: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length > charsPerPage && current.length > 0) {
      pages.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) pages.push(current.trim())
  return pages.filter(p => p.length > 0)
}

function createChaptersFromText(text: string): Chapter[] {
  const chapterSplits = text.split(/(?:^|\n)\s*(?:Chapter|CHAPTER|Ch\.|CH\.)\s*\d+/i)
  if (chapterSplits.length > 1) {
    return chapterSplits.slice(1).map((t, i) => ({
      title: `Chapter ${i + 1}`,
      content: splitIntoPages(t.trim()),
    }))
  }
  const sections = text.split(/\n\s*\n\s*\n/).filter(s => s.trim().length > 100)
  if (sections.length > 1) {
    return sections.map((section, i) => {
      const lines = section.trim().split('\n').filter(l => l.trim())
      const title = lines[0]?.trim() || `Section ${i + 1}`
      const content = lines.slice(1).join('\n').trim() || section.trim()
      return {
        title: title.length > 50 ? title.substring(0, 50) + '...' : title,
        content: splitIntoPages(content),
      }
    })
  }
  const pages = splitIntoPages(text)
  const perChapter = Math.max(3, Math.ceil(pages.length / 10))
  const chapters: Chapter[] = []
  for (let i = 0; i < pages.length; i += perChapter) {
    chapters.push({
      title: `Chapter ${Math.floor(i / perChapter) + 1}`,
      content: pages.slice(i, i + perChapter),
    })
  }
  return chapters
}

async function parseEPUB(file: File): Promise<Book> {
  const zip = new JSZip()
  const zipContent = await zip.loadAsync(file)

  let opfFile = null
  let opfContent = ''
  let opfBasePath = ''

  const containerFile = zipContent.file('META-INF/container.xml')
  if (containerFile) {
    const containerXml = await containerFile.async('text')
    const match = containerXml.match(/full-path="([^"]+)"/)
    if (match) {
      const opfPath = match[1]
      const slashIdx = opfPath.lastIndexOf('/')
      opfBasePath = slashIdx >= 0 ? opfPath.substring(0, slashIdx + 1) : ''
      opfFile = zipContent.file(opfPath)
    }
  }

  if (!opfFile) {
    const opfFiles = Object.keys(zipContent.files).filter(n => n.endsWith('.opf'))
    if (opfFiles.length > 0) {
      const opfPath = opfFiles[0]
      const slashIdx = opfPath.lastIndexOf('/')
      opfBasePath = slashIdx >= 0 ? opfPath.substring(0, slashIdx + 1) : ''
      opfFile = zipContent.file(opfPath)
    }
  }

  if (opfFile) opfContent = await opfFile.async('text')

  let title = file.name.replace(/\.[^/.]+$/, '')
  let author = 'Unknown Author'
  if (opfContent) {
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
    const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)
    if (titleMatch) title = titleMatch[1].trim()
    if (authorMatch) author = authorMatch[1].trim()
  }

  const spineItems: string[] = []
  if (opfContent) {
    const spineMatch = opfContent.match(/<spine[^>]*>(.*?)<\/spine>/is)
    if (spineMatch) {
      const itemrefs = spineMatch[1].match(/<itemref[^>]*idref="([^"]+)"/g)
      if (itemrefs) {
        for (const ref of itemrefs) {
          const idMatch = ref.match(/idref="([^"]+)"/)
          if (idMatch) {
            const manifestMatch = opfContent.match(
              new RegExp(`<item[^>]*id="${idMatch[1]}"[^>]*href="([^"]+)"`, 'i')
            )
            if (manifestMatch) spineItems.push(manifestMatch[1])
          }
        }
      }
    }
  }

  if (spineItems.length === 0) {
    Object.keys(zipContent.files).forEach(f => {
      if (f.match(/\.(x?html?)$/i) && !f.includes('toc') && !f.includes('nav'))
        spineItems.push(f)
    })
    spineItems.sort()
  }

  const chapters: Chapter[] = []
  let chapterIndex = 1
  for (const filename of spineItems) {
    const f = zipContent.file(opfBasePath + filename) || zipContent.file(filename)
    if (!f) continue
    const content = await f.async('text')
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    doc.querySelectorAll('script, style').forEach(el => el.remove())
    let textContent = doc.body?.textContent || doc.documentElement?.textContent || ''
    textContent = textContent.replace(/\s+/g, ' ').trim()
    if (textContent.length > 100) {
      let chapterTitle = `Chapter ${chapterIndex}`
      const headings = doc.querySelectorAll('h1, h2, h3')
      if (headings.length > 0) chapterTitle = headings[0].textContent?.trim() || chapterTitle
      chapters.push({ title: chapterTitle, content: splitIntoPages(textContent) })
      chapterIndex++
    }
  }

  if (chapters.length === 0) throw new Error('No readable content found in EPUB')
  return { title, author, chapters }
}

function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSVToBooks(text: string): LocalBook[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim())

  const col = (name: string) => headers.indexOf(name)
  const isGoodreadsExport = headers.includes('book id') || headers.includes('exclusive shelf')
  const isNewTemplate = headers.includes('cover_url') || headers.includes('isbn')
  const isCustom = headers.includes('name') && headers.includes('nickname')

  const books: LocalBook[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVRow(lines[i])
    if (vals.length < 2) continue

    let title = '', author = '', isbn = '', coverUrl = '', shelf = '', rating = 0, pages = 0

    if (isGoodreadsExport) {
      title = vals[col('title')] || ''
      author = vals[col('author')] || ''
      isbn = (vals[col('isbn13')] || vals[col('isbn')] || '').replace(/[="]/g, '')
      shelf = vals[col('exclusive shelf')] || vals[col('bookshelves')] || ''
      rating = parseInt(vals[col('my rating')] || '0') || 0
      pages = parseInt(vals[col('number of pages')] || '0') || 0
    } else if (isNewTemplate) {
      title = vals[col('title')] || ''
      author = vals[col('author')] || ''
      isbn = vals[col('isbn')] || ''
      coverUrl = vals[col('cover_url')] || ''
      shelf = vals[col('shelf')] || ''
      rating = parseInt(vals[col('my_rating')] || vals[col('rating')] || '0') || 0
      pages = parseInt(vals[col('pages')] || '0') || 0
    } else if (isCustom) {
      title = vals[col('name')] || ''
      author = vals[col('nickname')] || ''
    } else {
      title = vals[0] || ''
      author = vals[1] || ''
    }

    if (!title) continue
    if (!coverUrl && isbn) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
    }

    books.push({
      id: `csv-${i}-${Date.now()}`,
      title,
      author,
      isbn: isbn || undefined,
      coverUrl: coverUrl || undefined,
      shelf: shelf || 'read',
      rating,
      lastRead: new Date().toISOString(),
      progress: 0,
      pages,
    })
  }
  return books
}

export function BookProvider({ children }: { children: ReactNode }) {
  const [book, setBookState] = useState<Book | null>(null)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1)
  const [readWordIndices, setReadWordIndices] = useState<number[]>([])
  const [playbackSpeed, setPlaybackSpeed] = useState(1.2)
  const [volume, setVolume] = useState(0.8)
  const [fontSize, setFontSize] = useState(18)
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [sentenceSpacing, setSentenceSpacing] = useState(1.6)
  const [wordSpacing, setWordSpacing] = useState(0)
  const [fontFamily, setFontFamily] = useState('Georgia, serif')
  const [highlightColor, setHighlightColor] = useState('#A8B5C7')
  const [autoPlayNext, setAutoPlayNext] = useState(true)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [textHighlights, setTextHighlights] = useState<TextHighlight[]>([])
  const [localBooks, setLocalBooks] = useState<LocalBook[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('booklit-library')
      if (stored) setLocalBooks(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      const saveable = localBooks.filter(b => b.bookData)
      localStorage.setItem('booklit-library', JSON.stringify(saveable))
    } catch { /* quota */ }
  }, [localBooks])

  const currentChapter = book?.chapters[currentChapterIndex] ?? null
  const totalPages = currentChapter?.content.length ?? 0

  const setBook = useCallback((newBook: Book) => {
    setBookState(newBook)
    setCurrentChapterIndex(0)
    setCurrentPage(1)
    setIsPlaying(false)
    speechSynthesis.cancel()
    setHighlightedWordIndex(-1)
    setReadWordIndices([])
    setBookmarks([])

    const entry: LocalBook = {
      id: `book-${Date.now()}`,
      title: newBook.title,
      author: newBook.author,
      bookData: newBook,
      lastRead: new Date().toISOString(),
      progress: 0,
      pages: newBook.chapters.reduce((sum, ch) => sum + ch.content.length, 0),
    }
    setLocalBooks(prev => {
      if (prev.some(b => b.title === entry.title && b.author === entry.author)) return prev
      return [entry, ...prev]
    })
  }, [])

  const setCurrentChapter = useCallback((index: number) => {
    if (!book || index < 0 || index >= book.chapters.length) return
    setCurrentChapterIndex(index)
    setCurrentPage(1)
    setIsPlaying(false)
    speechSynthesis.cancel()
    setHighlightedWordIndex(-1)
    setReadWordIndices([])
  }, [book])

  const goToNextPage = useCallback(() => {
    if (currentChapter && currentPage < currentChapter.content.length) {
      setCurrentPage(p => p + 1)
      setHighlightedWordIndex(-1)
      setReadWordIndices([])
    } else if (book && currentChapterIndex < book.chapters.length - 1) {
      setCurrentChapter(currentChapterIndex + 1)
    }
  }, [currentChapter, currentPage, book, currentChapterIndex, setCurrentChapter])

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(p => p - 1)
      setHighlightedWordIndex(-1)
      setReadWordIndices([])
    } else if (currentChapterIndex > 0 && book) {
      const prevChapter = book.chapters[currentChapterIndex - 1]
      setCurrentChapterIndex(currentChapterIndex - 1)
      setCurrentPage(prevChapter.content.length)
      setHighlightedWordIndex(-1)
      setReadWordIndices([])
    }
  }, [currentPage, currentChapterIndex, book])

  const goToNextChapter = useCallback(() => {
    if (book && currentChapterIndex < book.chapters.length - 1) {
      setCurrentChapter(currentChapterIndex + 1)
    }
  }, [book, currentChapterIndex, setCurrentChapter])

  const goToPreviousChapter = useCallback(() => {
    if (currentChapterIndex > 0) setCurrentChapter(currentChapterIndex - 1)
  }, [currentChapterIndex, setCurrentChapter])

  const stopPlayback = useCallback(() => {
    speechSynthesis.cancel()
    setIsPlaying(false)
    setHighlightedWordIndex(-1)
  }, [])

  const speakText = useCallback((text: string) => {
    speechSynthesis.cancel()
    setReadWordIndices([])
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = playbackSpeed
    utterance.volume = volume
    if (selectedVoice) {
      utterance.voice = selectedVoice
    } else {
      const voices = speechSynthesis.getVoices()
      const preferred = voices.find(v => v.lang.includes('en-GB')) || voices.find(v => v.lang.startsWith('en'))
      if (preferred) utterance.voice = preferred
    }

    let currentWordIndex = 0
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        if (currentWordIndex > 0) {
          setReadWordIndices(prev =>
            prev.includes(currentWordIndex - 1) ? prev : [...prev, currentWordIndex - 1]
          )
        }
        setHighlightedWordIndex(currentWordIndex)
        currentWordIndex++
      }
    }

    utterance.onend = () => {
      setHighlightedWordIndex(-1)
      setIsPlaying(false)
      if (autoPlayNext) {
        setTimeout(() => {
          if (currentChapter && currentPage < currentChapter.content.length) {
            setCurrentPage(p => p + 1)
            setTimeout(() => {
              const next = currentChapter.content[currentPage]
              if (next) { setIsPlaying(true); speakText(next) }
            }, 500)
          }
        }, 1000)
      }
    }

    utterance.onerror = () => {
      setIsPlaying(false)
      setHighlightedWordIndex(-1)
    }

    speechSynthesis.speak(utterance)
  }, [playbackSpeed, volume, selectedVoice, autoPlayNext, currentChapter, currentPage])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      speechSynthesis.cancel()
      setIsPlaying(false)
      setHighlightedWordIndex(-1)
    } else if (currentChapter && currentPage <= currentChapter.content.length) {
      setIsPlaying(true)
      speakText(currentChapter.content[currentPage - 1])
    }
  }, [isPlaying, currentChapter, currentPage, speakText])

  const addBookmark = useCallback(() => {
    if (!currentChapter || currentPage > currentChapter.content.length) return
    const pageContent = currentChapter.content[currentPage - 1]
    const preview = pageContent.substring(0, 100) + (pageContent.length > 100 ? '...' : '')
    setBookmarks(prev => [...prev, {
      id: Date.now().toString(),
      chapterIndex: currentChapterIndex,
      pageIndex: currentPage - 1,
      text: preview,
      timestamp: new Date().toISOString(),
    }])
  }, [currentChapter, currentPage, currentChapterIndex])

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }, [])

  const goToBookmark = useCallback((bookmark: Bookmark) => {
    setCurrentChapterIndex(bookmark.chapterIndex)
    setCurrentPage(bookmark.pageIndex + 1)
    setHighlightedWordIndex(-1)
    setReadWordIndices([])
  }, [])

  const addTextHighlight = useCallback((h: Omit<TextHighlight, 'id' | 'timestamp'>) => {
    setTextHighlights(prev => [...prev, { ...h, id: Date.now().toString(), timestamp: new Date().toISOString() }])
  }, [])

  const removeTextHighlight = useCallback((id: string) => {
    setTextHighlights(prev => prev.filter(h => h.id !== id))
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext === 'csv') {
      const count = await importCSV(file)
      if (count === 0) throw new Error('No books found in CSV')
      return
    }
    let bookData: Book
    if (ext === 'epub') {
      bookData = await parseEPUB(file)
    } else if (ext === 'txt' || ext === 'md') {
      const text = await file.text()
      bookData = {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Author',
        chapters: createChaptersFromText(text),
      }
    } else {
      throw new Error(`Unsupported format: ${ext}. Use EPUB, TXT, MD, or CSV.`)
    }
    if (!bookData.chapters.length) throw new Error('No readable content found')
    setBook(bookData)
  }, [setBook])

  const importCSV = useCallback(async (file: File): Promise<number> => {
    const text = await file.text()
    const newBooks = parseCSVToBooks(text)
    if (newBooks.length === 0) return 0
    setLocalBooks(prev => {
      const existing = new Set(prev.map(b => b.title.toLowerCase()))
      const fresh = newBooks.filter(b => !existing.has(b.title.toLowerCase()))
      return [...prev, ...fresh]
    })
    return newBooks.length
  }, [])

  useEffect(() => {
    setHighlightedWordIndex(-1)
    setReadWordIndices([])
  }, [currentPage, currentChapterIndex])

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices()
      if (voices.length > 0 && !selectedVoice) {
        const preferred = voices.find(v =>
          v.lang.includes('en-GB') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('daniel'))
        ) || voices.find(v => v.lang.includes('en-GB')) || voices.find(v => v.lang.startsWith('en'))
        setSelectedVoice(preferred || voices[0])
      }
    }
    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices
    return () => { speechSynthesis.onvoiceschanged = null }
  }, [selectedVoice])

  return (
    <BookContext.Provider value={{
      book, currentChapterIndex, currentChapter, currentPage, totalPages,
      isPlaying, highlightedWordIndex, readWordIndices,
      playbackSpeed, volume, fontSize, selectedVoice,
      sentenceSpacing, wordSpacing, fontFamily, highlightColor, autoPlayNext,
      bookmarks, textHighlights, localBooks,
      setBook, setCurrentChapter, setCurrentPage,
      goToNextPage, goToPreviousPage, goToNextChapter, goToPreviousChapter,
      togglePlayback, stopPlayback,
      setPlaybackSpeed, setVolume, setFontSize, setSelectedVoice,
      setSentenceSpacing, setWordSpacing, setFontFamily, setHighlightColor, setAutoPlayNext,
      addBookmark, removeBookmark, goToBookmark,
      addTextHighlight, removeTextHighlight, uploadFile, importCSV,
    }}>
      {children}
    </BookContext.Provider>
  )
}
