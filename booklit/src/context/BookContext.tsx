import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
  type ReactNode,
} from 'react'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useProfiles } from './ProfileContext'
import { bookKey, type ShelfOverride } from '../lib/profiles'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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

/**
 * How a book entered the library. Note this is *not* whose library it is —
 * that's `profileId`. Your own profile holds books from all four sources.
 */
export type BookSource = 'curated' | 'local' | 'goodreads' | 'upload' | 'saved'

export interface LocalBook {
  id: string
  title: string
  author: string
  coverUrl?: string
  isbn?: string
  shelf?: string
  rating?: number
  /** Ingest path this book came from. Older persisted entries may lack it. */
  source?: BookSource
  /** Whose shelf this book sits on. Absent on entries persisted before profiles. */
  profileId?: string
  bookData?: Book
  /** External link from a CSV (e.g. OpenLibrary / Amazon) — used as a reading fallback. */
  epubLink?: string
  /** File format for local-library books: 'epub' | 'pdf' | 'txt' | 'md'. */
  format?: string
  /** Direct fetch URL for a local-library file (served by the backend at /files/…). */
  srcUrl?: string
  lastRead: string
  progress: number
  pages: number

  /* ---- Bibliographic detail, from the curated CSV. All optional: local-folder
     and Goodreads books carry almost none of it, and the detail panel hides any
     field that's missing rather than showing an empty row. ---- */
  subtitle?: string
  year?: number
  publisher?: string
  language?: string
  edition?: string
  /** Estimated word count — drives the reading-time estimate. */
  wordCount?: number
  notes?: string
  goodreadsUrl?: string
  buyLink?: string
  /** Prebuilt search URL for the owner's notes about this book. */
  notesSearchUrl?: string
  /** Art for the 3D card modes. */
  coverArtSpine?: string
  coverArtBack?: string
  mesh3d?: string
  /** Epoch ms the file appeared in the local books folder. Local books only. */
  addedAt?: number
}

/** Where a readable EPUB for a book can be fetched from. */
type EpubSource =
  | { type: 'file'; path: string }   // a bundled .epub we can fetch + parse in-app
  | { type: 'external'; url: string } // a catalog/preview page we can only open in a new tab

interface EpubManifest {
  gutenberg?: { title: string; path: string }[]
  standard_ebooks?: { title: string; path: string }[]
  open_library?: { title: string; url: string }[]
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
  /** id of a shelf book whose EPUB is currently being fetched/parsed (null when idle). */
  bookLoadingId: string | null
  /** human-readable error from the last failed openBook(), or null. */
  bookError: string | null

  setBook: (book: Book) => void
  /** Open a library book — fetches & parses its EPUB on demand if not already loaded. */
  openBook: (lb: LocalBook) => Promise<boolean>
  clearBookError: () => void
  /** True if this book can actually be opened in-app (local file, loaded, or bundled EPUB). */
  isReadable: (lb: LocalBook) => boolean
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
  /** Pull a public Goodreads library by user id (via the local backend). Returns # added. */
  importGoodreads: (userId: string) => Promise<number>
  /** Re-pull one profile's Goodreads shelf, ignoring the snapshot cache. */
  syncProfile: (profileId: string, goodreadsUserId: string) => Promise<number>
  /** Profile currently being fetched, or null. */
  syncingProfileId: string | null
  /** Load the local books folder (L:\Media\Text\Books) via the backend. Returns # added. */
  importLocalLibrary: (refresh?: boolean) => Promise<number>

  /* ---- Shelf editing. Goodreads has no write API, so these are Booklit's own
     and are layered over the imported snapshot rather than pushed upstream. ---- */
  /** Copy a book off the shelf you're browsing into your own library. */
  saveToMyLibrary: (lb: LocalBook) => void
  setBookShelf: (lb: LocalBook, shelf: string) => void
  setBookRating: (lb: LocalBook, rating: number) => void
  removeFromMyLibrary: (lb: LocalBook) => void
  /** True when the open profile is yours, so edits apply. Guests are read-only. */
  canEdit: boolean
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

async function parsePDF(file: File, fallbackTitle: string, fallbackAuthor: string): Promise<Book> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const parts: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const line = tc.items.map(it => ('str' in it ? it.str : '')).join(' ')
    if (line.trim()) parts.push(line)
  }
  const text = parts.join('\n\n').trim()
  if (!text) throw new Error('No selectable text — this looks like a scanned PDF.')
  return {
    title: fallbackTitle,
    author: fallbackAuthor || 'Unknown Author',
    chapters: createChaptersFromText(text),
  }
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

function normaliseTitle(t: string): string {
  return (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Resolve a readable EPUB source for a book, preferring bundled files. */
function findEpubForBook(book: LocalBook, manifest: EpubManifest | null): EpubSource | null {
  if (manifest) {
    const nt = normaliseTitle(book.title)
    const files = [...(manifest.gutenberg || []), ...(manifest.standard_ebooks || [])]
    for (const entry of files) {
      if (normaliseTitle(entry.title) === nt) {
        // Manifest paths are relative ("./books/..."); serve them from the web root.
        return { type: 'file', path: entry.path.replace(/^\.?\//, '/') }
      }
    }
    const ol = manifest.open_library || []
    for (const entry of ol) {
      if (normaliseTitle(entry.title) === nt) return { type: 'external', url: entry.url }
    }
  }
  if (book.epubLink) return { type: 'external', url: book.epubLink }
  return null
}

/** Cache identity for a profile's shelf: who it is *and* what it reads from. */
function profileCacheKey(p: { id: string; goodreadsUserId?: string; bundledCsv?: string } | null): string {
  if (!p) return ''
  return `${p.id}::${p.goodreadsUserId ?? p.bundledCsv ?? 'none'}`
}

/** Backend `/api/local-books` rows → library entries. Always the owner's. */
function mapLocalFolderBooks(rows: unknown): LocalBook[] {
  return ((rows as Record<string, string | number>[]) || []).map(b => ({
    id: String(b.id),
    title: String(b.title),
    author: String(b.author || ''),
    format: String(b.format),
    coverUrl: b.format === 'epub' ? `/api/cover?id=${b.id}` : undefined,
    srcUrl: `/files/${String(b.relpath || '').split('/').map(encodeURIComponent).join('/')}`,
    shelf: 'local',
    source: 'local' as const,
    profileId: 'owner',
    // When the file appeared in the books folder — what "date added" sorts on.
    // The backend reads it from the filesystem.
    addedAt: typeof b.addedAt === 'number' && b.addedAt > 0 ? b.addedAt : undefined,
    lastRead: new Date().toISOString(),
    progress: 0,
    pages: 0,
  })).filter(b => b.title)
}

/** Backend `/api/goodreads` rows → library entries for one profile. */
function mapGoodreadsBooks(rows: unknown, userId: string, profileId: string): LocalBook[] {
  return ((rows as Record<string, string>[]) || []).map((b, i) => ({
    // Positional, but scoped by profile — two people's shelves can't collide.
    id: `gr-${userId}-${i}`,
    title: b.title,
    author: b.author || '',
    isbn: b.isbn || undefined,
    coverUrl: b.cover_url || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg` : undefined),
    shelf: b.shelf || 'read',
    rating: parseInt(b.my_rating || '0') || 0,
    year: parseInt(b.year || '0') || undefined,
    source: 'goodreads' as const,
    profileId,
    goodreadsUrl: b.goodreads_url || undefined,
    epubLink: b.epub_link || undefined,
    addedAt: b.date_added ? Date.parse(b.date_added) || undefined : undefined,
    lastRead: new Date().toISOString(),
    progress: 0,
    pages: parseInt(b.pages || '0') || 0,
  })).filter(b => b.title)
}

/** Books pulled into your library off someone else's shelf. */
function savedBooksFrom(
  overrides: Record<string, ShelfOverride>,
  profileId: string,
): LocalBook[] {
  const out: LocalBook[] = []
  for (const [key, ov] of Object.entries(overrides)) {
    if (!ov.saved || ov.removed) continue
    out.push({
      id: `saved-${key}`,
      title: ov.saved.title,
      author: ov.saved.author || '',
      coverUrl: ov.saved.coverUrl,
      isbn: ov.saved.isbn,
      shelf: ov.shelf || 'to-read',
      rating: ov.rating ?? 0,
      source: 'saved',
      profileId,
      notes: ov.notes,
      lastRead: new Date(ov.updatedAt).toISOString(),
      addedAt: ov.updatedAt,
      progress: 0,
      pages: 0,
    })
  }
  return out
}

function parseCSVToBooks(text: string, profileId = 'owner'): LocalBook[] {
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

    const epubLink = vals[col('epub_link')] || vals[col('epublink')] || ''

    // Columns the detail panel needs. `col()` returns -1 for a missing header
    // and vals[-1] is undefined, so absent columns fall through to undefined
    // rather than becoming empty strings the panel would render as blank rows.
    const str = (name: string) => {
      const v = (vals[col(name)] || '').trim()
      return v || undefined
    }
    const num = (name: string) => {
      const v = parseInt((vals[col(name)] || '').replace(/[^\d]/g, ''), 10)
      return Number.isFinite(v) && v > 0 ? v : undefined
    }

    books.push({
      id: `csv-${i}-${Date.now()}`,
      title,
      author,
      isbn: isbn || undefined,
      coverUrl: coverUrl || undefined,
      shelf: shelf || 'read',
      rating,
      source: 'curated',
      profileId,
      epubLink: epubLink || undefined,
      lastRead: new Date().toISOString(),
      progress: 0,
      pages,

      subtitle: str('subtitle'),
      year: num('year'),
      publisher: str('publisher'),
      language: str('language'),
      edition: str('edition'),
      wordCount: num('word_count'),
      notes: str('notes'),
      goodreadsUrl: str('goodreads_url'),
      buyLink: str('buy_link'),
      notesSearchUrl: str('notes_search_url'),
      coverArtSpine: str('cover_art_spine'),
      coverArtBack: str('cover_art_back'),
      mesh3d: str('3d_mesh'),
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
  const [bookLoadingId, setBookLoadingId] = useState<string | null>(null)
  const [bookError, setBookError] = useState<string | null>(null)
  const manifestRef = useRef<EpubManifest | null>(null)

  const {
    activeProfile, activeProfileId, overrides, ready: profilesReady,
    markSynced, setOverride,
  } = useProfiles()
  const isOwnerProfile = activeProfile?.kind === 'owner'

  /* Shelf books, keyed by whose shelf they are. Keeping them in separate
     buckets rather than one array is the whole fix: two people's Goodreads
     imports can no longer dedupe into each other.

     The key carries the shelf's *source* as well as the profile id, because
     "owner" is a stable id across accounts — without it, signing into a second
     account would show the first account's books until a refetch, and
     re-pointing your profile at a different Goodreads user would show the old
     one. Either way the entry simply misses and reloads. */
  const [booksByProfile, setBooksByProfile] = useState<Record<string, LocalBook[]>>({})
  const cacheKey = profileCacheKey(activeProfile)
  /* Local folder + hand-uploaded books. These are yours by definition, so they
     ride with the owner profile rather than any particular shelf. */
  const [ownerExtras, setOwnerExtras] = useState<LocalBook[]>([])
  /* id → parsed content, filled in on demand by openBook. Held apart from the
     book lists so re-syncing a shelf doesn't throw away what's been parsed. */
  const [parsed, setParsed] = useState<Record<string, Book>>({})
  const [syncingProfileId, setSyncingProfileId] = useState<string | null>(null)

  // The EPUB manifest is shelf-independent — it just says which titles have a
  // readable file bundled — so it loads once, for everybody.
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/books/patrick/epubs/manifest.json')
        if (r.ok) manifestRef.current = await r.json()
      } catch { /* no manifest — bundled reading just won't resolve */ }
    })()
  }, [])

  // Hand-uploaded books, restored from the last session.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('booklit-library')
      if (!stored) return
      const books: LocalBook[] = JSON.parse(stored)
      setOwnerExtras(prev => {
        const have = new Set(prev.map(b => b.id))
        return [...prev, ...books.filter(b => !have.has(b.id))]
      })
    } catch { /* ignore */ }
  }, [])

  // Local books folder (L:\Media\Text\Books) via the backend, if it's running.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/local-books')
        if (!r.ok) return
        const data = await r.json()
        const items = mapLocalFolderBooks(data.books)
        if (!cancelled && items.length > 0) {
          setOwnerExtras(prev => {
            const ids = new Set(prev.map(b => b.id))
            return [...prev, ...items.filter(b => !ids.has(b.id))]
          })
        }
      } catch { /* backend down — local library just won't appear */ }
    })()
    return () => { cancelled = true }
  }, [])

  /**
   * Load whichever shelf is being looked at, once. Switching back to a profile
   * already in the cache is instant; the backend caches the Goodreads snapshot
   * behind that, so even a cold switch is one request.
   */
  useEffect(() => {
    if (!profilesReady || !activeProfile || !cacheKey) return
    if (booksByProfile[cacheKey]) return                // already loaded

    let cancelled = false
    const profile = activeProfile
    const key = cacheKey
    setSyncingProfileId(profile.id)
    ;(async () => {
      try {
        let books: LocalBook[] = []
        if (profile.bundledCsv) {
          const r = await fetch(profile.bundledCsv)
          if (r.ok) books = parseCSVToBooks(await r.text(), profile.id)
        } else if (profile.goodreadsUserId) {
          const r = await fetch(`/api/goodreads?userid=${encodeURIComponent(profile.goodreadsUserId)}`)
          if (r.ok) {
            const data = await r.json()
            if (!data.error) books = mapGoodreadsBooks(data.books, profile.goodreadsUserId, profile.id)
          }
        }
        if (cancelled) return
        // Cache even an empty result, so a profile with no shelf connected
        // doesn't re-request on every switch.
        setBooksByProfile(prev => ({ ...prev, [key]: books }))
        if (books.length > 0) markSynced(profile.id)
      } catch {
        if (!cancelled) setBooksByProfile(prev => ({ ...prev, [key]: [] }))
      } finally {
        if (!cancelled) setSyncingProfileId(null)
      }
    })()
    return () => { cancelled = true }
  }, [activeProfile, cacheKey, profilesReady, booksByProfile, markSynced])

  useEffect(() => {
    try {
      // Only persist manually-uploaded books. Shelf / Goodreads / local-library
      // books are re-fetched from their source on startup, and caching their
      // parsed full text would blow the localStorage quota.
      const saveable = ownerExtras
        .filter(b => b.id.startsWith('book-'))
        .map(b => (parsed[b.id] ? { ...b, bookData: parsed[b.id] } : b))
        .filter(b => b.bookData)
      localStorage.setItem('booklit-library', JSON.stringify(saveable))
    } catch { /* quota */ }
  }, [ownerExtras, parsed])

  /**
   * What the UI sees: one profile's books, never a blend of several.
   *
   * Your own library is the shelf you connected plus everything that's yours by
   * nature — local files, uploads, and anything saved off someone else's shelf.
   * A guest profile is just their shelf, read-only.
   */
  const localBooks = useMemo<LocalBook[]>(() => {
    const shelf = booksByProfile[cacheKey] ?? []
    if (!isOwnerProfile) {
      return shelf.map(b => (parsed[b.id] ? { ...b, bookData: parsed[b.id] } : b))
    }

    const saved = savedBooksFrom(overrides, activeProfileId)
    const seen = new Set<string>()
    const out: LocalBook[] = []
    for (const b of [...shelf, ...ownerExtras, ...saved]) {
      const ov = overrides[bookKey(b.title, b.author)]
      if (ov?.removed) continue
      // A saved book that's since turned up on the real shelf is the same book.
      const k = bookKey(b.title, b.author)
      if (b.source === 'saved' && seen.has(k)) continue
      seen.add(k)
      out.push({
        ...b,
        ...(parsed[b.id] ? { bookData: parsed[b.id] } : null),
        ...(ov?.shelf ? { shelf: ov.shelf } : null),
        ...(ov?.rating !== undefined ? { rating: ov.rating } : null),
        ...(ov?.notes ? { notes: ov.notes } : null),
      })
    }
    return out
  }, [booksByProfile, cacheKey, activeProfileId, isOwnerProfile, ownerExtras, overrides, parsed])

  const currentChapter = book?.chapters[currentChapterIndex] ?? null
  const totalPages = currentChapter?.content.length ?? 0

  // Make a parsed book the active reading target (no library mutation).
  const activateBook = useCallback((newBook: Book) => {
    setBookState(newBook)
    setCurrentChapterIndex(0)
    setCurrentPage(1)
    setIsPlaying(false)
    speechSynthesis.cancel()
    setHighlightedWordIndex(-1)
    setReadWordIndices([])
    setBookmarks([])
  }, [])

  const setBook = useCallback((newBook: Book) => {
    activateBook(newBook)

    const id = `book-${Date.now()}`
    const entry: LocalBook = {
      id,
      title: newBook.title,
      author: newBook.author,
      source: 'upload',
      profileId: 'owner',
      bookData: newBook,
      lastRead: new Date().toISOString(),
      progress: 0,
      pages: newBook.chapters.reduce((sum, ch) => sum + ch.content.length, 0),
    }
    setParsed(prev => ({ ...prev, [id]: newBook }))
    setOwnerExtras(prev => {
      if (prev.some(b => b.title === entry.title && b.author === entry.author)) return prev
      return [entry, ...prev]
    })
  }, [activateBook])

  // Open a library book. If its content isn't loaded yet, resolve a readable EPUB
  // (bundled file or CSV link) and parse it on demand, then cache it on the entry.
  const openBook = useCallback(async (lb: LocalBook): Promise<boolean> => {
    setBookError(null)

    if (lb.bookData) { activateBook(lb.bookData); return true }

    // Local-library files (epub / pdf / txt / md) streamed from the backend.
    if (lb.srcUrl) {
      setBookLoadingId(lb.id)
      try {
        const resp = await fetch(lb.srcUrl)
        if (!resp.ok) throw new Error(`fetch failed (${resp.status})`)
        const blob = await resp.blob()
        const fmt = (lb.format || 'epub').toLowerCase()
        let data: Book
        if (fmt === 'pdf') {
          data = await parsePDF(new File([blob], `${lb.title}.pdf`), lb.title, lb.author)
        } else if (fmt === 'txt' || fmt === 'md') {
          data = {
            title: lb.title,
            author: lb.author || 'Unknown Author',
            chapters: createChaptersFromText(await blob.text()),
          }
        } else {
          data = await parseEPUB(new File([blob], `${lb.title}.epub`))
          if (lb.author && data.author === 'Unknown Author') data.author = lb.author
        }
        setParsed(prev => ({ ...prev, [lb.id]: data }))
        activateBook(data)
        return true
      } catch (err) {
        console.error('openBook (local) failed:', err)
        setBookError(`Couldn't open "${lb.title}": ${(err as Error).message}`)
        return false
      } finally {
        setBookLoadingId(null)
      }
    }

    const source = findEpubForBook(lb, manifestRef.current)
    if (!source) {
      setBookError(`No readable copy of "${lb.title}" is available yet.`)
      return false
    }
    if (source.type === 'external') {
      // Catalog/preview pages can't be parsed in-app — open them in a new tab.
      window.open(source.url, '_blank', 'noopener')
      setBookError(`"${lb.title}" isn't bundled for in-app reading — opened its catalog page instead.`)
      return false
    }

    setBookLoadingId(lb.id)
    try {
      const resp = await fetch(encodeURI(source.path))
      if (!resp.ok) throw new Error(`fetch failed (${resp.status})`)
      const blob = await resp.blob()
      const file = new File([blob], `${lb.title}.epub`, { type: 'application/epub+zip' })
      const data = await parseEPUB(file)
      // Preserve the shelf metadata's title/author when the EPUB lacks them.
      if (lb.author && data.author === 'Unknown Author') data.author = lb.author
      setParsed(prev => ({ ...prev, [lb.id]: data }))
      activateBook(data)
      return true
    } catch (err) {
      console.error('openBook failed:', err)
      setBookError(`Couldn't open "${lb.title}". The file may be missing or unreadable.`)
      return false
    } finally {
      setBookLoadingId(null)
    }
  }, [activateBook])

  const clearBookError = useCallback(() => setBookError(null), [])

  const isReadable = useCallback((lb: LocalBook): boolean => {
    if (lb.srcUrl || lb.bookData) return true            // local file or already parsed
    const src = findEpubForBook(lb, manifestRef.current)
    return src?.type === 'file'                            // bundled EPUB we can parse
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

  // A CSV you drop in is your own shelf data, so it lands in your library.
  const importCSV = useCallback(async (file: File): Promise<number> => {
    const text = await file.text()
    const newBooks = parseCSVToBooks(text, 'owner')
    if (newBooks.length === 0) return 0
    setOwnerExtras(prev => {
      const existing = new Set(prev.map(b => normaliseTitle(b.title)))
      const fresh = newBooks.filter(b => !existing.has(normaliseTitle(b.title)))
      return [...prev, ...fresh]
    })
    return newBooks.length
  }, [])

  /**
   * Re-pull a profile's Goodreads shelf, bypassing the backend snapshot cache.
   * Replaces that profile's books outright rather than merging — a book you
   * removed on Goodreads should disappear here too. Your own edits survive
   * because they live in the override layer, not in these entries.
   */
  const syncProfile = useCallback(async (
    profileId: string,
    goodreadsUserId: string,
  ): Promise<number> => {
    setSyncingProfileId(profileId)
    try {
      const resp = await fetch(
        `/api/goodreads?userid=${encodeURIComponent(goodreadsUserId)}&refresh=1`)
      if (!resp.ok) throw new Error(`Backend error (${resp.status}). Is the Booklit server running?`)
      const data = await resp.json()
      if (data.error) throw new Error(data.error)

      const books = mapGoodreadsBooks(data.books, goodreadsUserId, profileId)
      setBooksByProfile(prev => ({
        ...prev,
        [profileCacheKey({ id: profileId, goodreadsUserId })]: books,
      }))
      if (books.length > 0) markSynced(profileId)
      return books.length
    } finally {
      setSyncingProfileId(null)
    }
  }, [markSynced])

  /** Back-compat wrapper: pull a shelf into whichever profile is open. */
  const importGoodreads = useCallback(
    (userId: string) => syncProfile(activeProfileId, userId),
    [syncProfile, activeProfileId],
  )

  const importLocalLibrary = useCallback(async (refresh = false): Promise<number> => {
    const resp = await fetch(`/api/local-books${refresh ? '?refresh=1' : ''}`)
    if (!resp.ok) throw new Error(`Backend error (${resp.status}). Is the Booklit server running?`)
    const data = await resp.json()
    if (data.error) throw new Error(data.error)

    const books = mapLocalFolderBooks(data.books)
    if (books.length === 0) return 0
    setOwnerExtras(prev => {
      const existingIds = new Set(prev.map(b => b.id))
      return [...prev, ...books.filter(b => !existingIds.has(b.id))]
    })
    return books.length
  }, [])

  /** Pull a book off whatever shelf you're browsing into your own library. */
  const saveToMyLibrary = useCallback((lb: LocalBook) => {
    setOverride(bookKey(lb.title, lb.author), {
      saved: {
        title: lb.title,
        author: lb.author || undefined,
        coverUrl: lb.coverUrl,
        isbn: lb.isbn,
        from: lb.profileId,
      },
      shelf: 'to-read',
      removed: false,
    })
  }, [setOverride])

  /** Move a book to a different shelf in your library. Local — Goodreads is read-only. */
  const setBookShelf = useCallback((lb: LocalBook, shelf: string) => {
    setOverride(bookKey(lb.title, lb.author), { shelf })
  }, [setOverride])

  const setBookRating = useCallback((lb: LocalBook, rating: number) => {
    setOverride(bookKey(lb.title, lb.author), { rating })
  }, [setOverride])

  const removeFromMyLibrary = useCallback((lb: LocalBook) => {
    setOverride(bookKey(lb.title, lb.author), { removed: true })
  }, [setOverride])

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
      bookLoadingId, bookError,
      setBook, openBook, clearBookError, isReadable, setCurrentChapter, setCurrentPage,
      goToNextPage, goToPreviousPage, goToNextChapter, goToPreviousChapter,
      togglePlayback, stopPlayback,
      setPlaybackSpeed, setVolume, setFontSize, setSelectedVoice,
      setSentenceSpacing, setWordSpacing, setFontFamily, setHighlightColor, setAutoPlayNext,
      addBookmark, removeBookmark, goToBookmark,
      addTextHighlight, removeTextHighlight, uploadFile, importCSV, importGoodreads, importLocalLibrary,
      syncProfile, syncingProfileId,
      saveToMyLibrary, setBookShelf, setBookRating, removeFromMyLibrary,
      canEdit: isOwnerProfile,
    }}>
      {children}
    </BookContext.Provider>
  )
}
