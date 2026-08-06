// Minimal, dependency-free backend for Booklit.
//
//   GET /api/goodreads?userid=<id>  → pull a public Goodreads library (RSS).
//   GET /api/local-books            → catalog of a local books folder.
//   GET /files/<relpath>            → stream a file from that folder for reading.
//
// Run:  node server/goodreads-server.mjs   (listens on :8765, proxied by Vite)
//
// Goodreads has no usable API — developer keys stopped being issued in Dec 2020
// and the legacy ones now 403 — so the only way in is the public RSS feed, and
// the only way out is a CSV you import by hand on their site. Everything here
// is therefore read-only: Booklit owns shelf edits, not Goodreads.

import http from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { execFile } from 'node:child_process'
import JSZip from 'jszip'

const PORT = process.env.GOODREADS_PORT ? Number(process.env.GOODREADS_PORT) : 8765
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')
const PER_PAGE = 100          // Goodreads honours per_page up to 100
const MAX_PAGES = 20          // → up to 2000 books per shelf
const CACHE_TTL_MS = 12 * 60 * 60 * 1000   // how long a shelf snapshot stays fresh
const UA = 'Mozilla/5.0 (compatible; booklit/1.0)'

// Local books folder (override with BOOKS_DIR env var).
const BOOKS_DIR = path.resolve(process.env.BOOKS_DIR || 'L:\\Media\\Text\\Books')
/* 3D book models, served read-only for the Models view. They live in the sibling
   `cards/` project and are ~7 MB each, so they are deliberately not copied into
   booklit/public — that would put them in a public repo and in every build.
   Override with MODELS_DIR. */
const MODELS_DIR = path.resolve(
  process.env.MODELS_DIR || path.join(__dirname, '..', '..', 'cards', 'assets', 'models'),
)
// Formats the in-app text+audio reader can open.
const READABLE_EXT = new Set(['.epub', '.pdf', '.txt', '.md'])
const MIME = {
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
}
let localCatalog = null   // cached [{id,title,author,format,relpath,size}]
const coverCache = new Map()  // id → { buffer, mime }  (extracted EPUB covers)

// ---- online cover search, for books with no embedded/catalog cover at all ----
//
// Local-folder books have only a filename-guessed title/author — no ISBN, so
// the ISBN→OpenLibrary URL trick used elsewhere can't apply to them. This
// searches by title/author instead: OpenLibrary's search index first, then
// Gutendex (Project Gutenberg) for older public-domain titles OpenLibrary's
// cover index tends to miss. Results (including "not found") are cached to
// disk so a personal library of hundreds of books only ever gets searched once.
const COVER_SEARCH_CACHE_FILE = path.join(DATA_DIR, 'cover-search-cache.json')
let coverSearchCache = null                  // key → coverUrl | null
const coverSearchInFlight = new Map()        // key → in-progress Promise<string|null>

// OpenLibrary's title search is closer to exact-match than fuzzy, and local
// filenames often carry noise `parseBookFilename` doesn't fully strip — a
// subtitle tacked on after " - ", or a "(Publisher, Year)" tail where the
// year isn't the *whole* parenthetical (parseBookFilename only strips a bare
// "(Year)"). Only the original and the fully-cleaned title are searched
// (not every intermediate step) — a full library scan means every extra
// variant is thousands of extra requests to a free public API.
function titleSearchVariants(title) {
  let cur = title
  for (let i = 0; i < 4; i++) {
    const noParen = cur.replace(/\s*\([^)]*\d{4}[^)]*\)\s*$/, '').trim()
    const dash = noParen.lastIndexOf(' - ')
    const noDash = dash > 0 ? noParen.slice(0, dash).trim() : noParen
    // "Title by Author Name" — common for scanned public-domain filenames
    // that parseBookFilename's author-detection heuristics don't catch.
    const next = noDash.replace(/\s+by\s+[A-Z][a-zA-Z.'-]*(?:\s+[A-Z][a-zA-Z.'-]*){0,3}\s*$/, '').trim()
      || noDash
    if (next === cur) break
    cur = next
  }
  return cur === title ? [title] : [title, cur]
}

function coverSearchKey(title, author) {
  const t = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const a = (author || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return a ? `${t}|${a}` : t
}

async function loadCoverSearchCache() {
  if (coverSearchCache) return coverSearchCache
  coverSearchCache = new Map()
  try {
    const raw = JSON.parse(await fs.readFile(COVER_SEARCH_CACHE_FILE, 'utf8'))
    for (const [k, v] of Object.entries(raw)) coverSearchCache.set(k, v)
  } catch { /* no cache on disk yet */ }
  return coverSearchCache
}

async function persistCoverSearchCache() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(COVER_SEARCH_CACHE_FILE, JSON.stringify(Object.fromEntries(coverSearchCache)), 'utf8')
  } catch (e) {
    console.error('Could not persist cover search cache:', e.message)
  }
}

// A slow or hanging external call must never hold a request open for long:
// browsers cap concurrent connections per origin (~6 on HTTP/1.1), so a
// handful of uncached books each waiting tens of seconds on openlibrary.org
// is enough to starve every other request the app makes — which is exactly
// what made the whole UI stutter the first time this hit a real library.
async function fetchWithTimeout(url, opts, ms = 2500) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Caps how many external lookups run at once during an "Update library"
// scan, so a library of thousands of books doesn't fire off thousands of
// simultaneous outbound sockets. Only the explicit scan ever drives this —
// nothing triggers a search as a side effect of just viewing the library.
// Kept modest: a first pass at 10 sustained for a few minutes over ~1200
// books got this machine's IP rate-limited by OpenLibrary badly enough that
// even unrelated, unthrottled requests to it started timing out outright.
const OUTBOUND_CONCURRENCY = 3
let outboundActive = 0
const outboundQueue = []
// If a source starts answering 429, every in-flight and queued call backs
// off together rather than continuing to hammer it — a scan should slow
// down and keep going, not get the IP blocked.
const backoffUntil = { openlibrary: 0, gutendex: 0 }

function withOutboundSlot(fn) {
  return new Promise((resolve) => {
    const run = () => {
      outboundActive++
      fn().then(resolve).finally(() => {
        outboundActive--
        outboundQueue.shift()?.()
      })
    }
    if (outboundActive < OUTBOUND_CONCURRENCY) run()
    else outboundQueue.push(run)
  })
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Returns a cover URL, `null` for a confirmed no-match, or `undefined` for
// "couldn't tell" (timeout, network error, rate limit) — that three-way
// split matters because only a confirmed no-match is safe to cache. Caching
// an error as a permanent miss is exactly what happened during the first
// full-library scan: OpenLibrary rate-limited this connection partway
// through, and every lookup after that point got cached as "no cover"
// even though it was never actually checked.
async function queryOpenLibrary(title, author) {
  const params = new URLSearchParams({ title, fields: 'cover_i', limit: '1' })
  if (author) params.set('author', author)
  return withOutboundSlot(async () => {
    const wait = backoffUntil.openlibrary - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      const r = await fetchWithTimeout(`https://openlibrary.org/search.json?${params}`, { headers: { 'User-Agent': UA } })
      if (r.status === 429) { backoffUntil.openlibrary = Date.now() + 30000; return undefined }
      if (!r.ok) return undefined
      const data = await r.json()
      const coverId = data?.docs?.[0]?.cover_i
      return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
    } catch { return undefined }
  })
}

async function queryGutendex(title, author) {
  const q = [title, author].filter(Boolean).join(' ')
  return withOutboundSlot(async () => {
    const wait = backoffUntil.gutendex - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      const r = await fetchWithTimeout(`https://gutendex.com/books?search=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA } })
      if (r.status === 429) { backoffUntil.gutendex = Date.now() + 30000; return undefined }
      if (!r.ok) return undefined
      const data = await r.json()
      return data?.results?.[0]?.formats?.['image/jpeg'] || null
    } catch { return undefined }
  })
}

// Every variant/author combination fires together rather than one after
// another — a sequential chain of awaits is what let a single uncached book
// take tens of seconds to resolve. Returns the found URL (if any) and
// whether every attempt got a definitive answer — `ok: false` means at
// least one query errored or was rate-limited, so the "no match" here isn't
// trustworthy enough to cache.
async function firstMatch(promises) {
  const settled = await Promise.all(promises)
  const url = settled.find(v => typeof v === 'string' && v) ?? null
  const ok = settled.every(v => v !== undefined)
  return { url, ok }
}

// Runs the actual multi-source search and caches the result — but only when
// every query involved gave a definitive answer. Only ever called from the
// explicit "Update library" scan (see /api/scan-covers) — a passing request
// rendering a book card must never trigger this itself. A request handler
// awaiting a chain of external HTTP calls is exactly what starved every
// other request behind it the first time this searched automatically on
// every open (browsers cap concurrent connections per origin, and dozens of
// uncached books each holding one open for tens of seconds froze the app).
function searchCover(title, author, key) {
  let inFlight = coverSearchInFlight.get(key)
  if (inFlight) return inFlight
  inFlight = (async () => {
    const cache = await loadCoverSearchCache()
    const variants = titleSearchVariants(title)
    // OpenLibrary's `author` param filters rather than ranks, and
    // local-folder filenames often mis-parse the author — a wrong one then
    // returns zero hits even though the title alone would have matched, so
    // every variant is tried both with and without it.
    let { url, ok } = await firstMatch(
      variants.flatMap(t => author ? [queryOpenLibrary(t, author), queryOpenLibrary(t, '')] : [queryOpenLibrary(t, '')]),
    )
    if (!url) {
      const gx = await firstMatch(variants.map(t => queryGutendex(t, author)))
      url = gx.url
      ok = ok && gx.ok
    }
    // A confirmed find is always worth caching; a "not found" is only
    // trustworthy — and thus only cached — if nothing along the way errored.
    // An uncached miss just gets retried on the next scan instead of being
    // stuck as a permanent false negative.
    if (url || ok) cache.set(key, url)
    return url
  })()
  coverSearchInFlight.set(key, inFlight)
  inFlight.finally(() => coverSearchInFlight.delete(key))
  return inFlight
}

// Cache-only — never reaches out to the network. Used by /api/cover so an
// ordinary page view can pick up a cover a previous scan already found,
// without ever starting a new search itself.
async function getCachedCover(title, author) {
  const key = coverSearchKey(title, author)
  if (!key) return null
  const cache = await loadCoverSearchCache()
  return cache.has(key) ? cache.get(key) : null
}

const CSV_FIELDS = [
  'title', 'author', 'year', 'isbn', 'rating', 'my_rating',
  'pages', 'cover_url', 'goodreads_url', 'shelf', 'epub_link',
  'date_read', 'date_added',
]

// ---- tiny XML helpers (RSS fields are simple, often CDATA-wrapped) ----

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function upgradeCover(url) {
  // Strip Goodreads thumbnail size suffixes (._SX98_.jpg) for full-size art.
  return url ? url.replace(/\._S[XY]\d+_\.(jpg|png)/i, '.$1') : ''
}

function parseFeed(xml, exclusiveShelf) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || []
  return items.map(block => {
    const isbn = tag(block, 'isbn').replace(/\D/g, '')
    const bookId = tag(block, 'book_id')
    let cover = upgradeCover(tag(block, 'book_large_image_url') || tag(block, 'book_medium_image_url') || tag(block, 'book_image_url'))
    if (!cover && isbn) cover = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
    /* <user_shelves> holds only the *custom* shelves ("favourites",
       "biographies") and is empty for a book sitting on nothing but an
       exclusive shelf. The exclusive shelf is the feed we asked for, so it has
       to come from the caller — reading it off the item is what made every
       to-read book look "read". */
    const custom = tag(block, 'user_shelves')
    return {
      title: tag(block, 'title'),
      author: tag(block, 'author_name') || 'Unknown',
      year: tag(block, 'book_published'),
      isbn,
      rating: tag(block, 'average_rating'),
      my_rating: tag(block, 'user_rating'),
      pages: tag(block, 'num_pages'),
      cover_url: cover,
      goodreads_url: bookId ? `https://www.goodreads.com/book/show/${bookId}` : '',
      shelf: custom ? `${exclusiveShelf}, ${custom}` : exclusiveShelf,
      date_read: tag(block, 'user_read_at'),
      date_added: tag(block, 'user_date_added'),
      epub_link: isbn ? `https://openlibrary.org/isbn/${isbn}` : '',
    }
  }).filter(b => b.title)
}

// The three shelves every Goodreads account has. A book lives on exactly one.
const EXCLUSIVE_SHELVES = ['read', 'currently-reading', 'to-read']

// "Lucy's bookshelf: read" → "Lucy". Gives a profile its display name without
// scraping the profile page.
function nameFromFeed(xml) {
  const t = tag(xml, 'title')
  const m = t.match(/^(.*?)'s bookshelf/i)
  return (m ? m[1] : '').trim()
}

async function fetchShelf(userId, shelf) {
  const books = []
  let displayName = ''
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}&page=${page}&per_page=${PER_PAGE}`
    let xml
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml,text/xml' } })
      if (!r.ok) {
        if (page === 1) throw new Error(`Goodreads returned HTTP ${r.status}. Is the profile public?`)
        break
      }
      xml = await r.text()
    } catch (e) {
      if (page === 1) throw e
      break
    }
    if (!displayName) displayName = nameFromFeed(xml)
    const batch = parseFeed(xml, shelf)
    books.push(...batch)
    if (batch.length < PER_PAGE) break   // short page = last page
  }
  return { books, displayName }
}

async function fetchGoodreads(userId) {
  const all = []
  let displayName = ''
  let firstError = null

  for (const shelf of EXCLUSIVE_SHELVES) {
    try {
      const res = await fetchShelf(userId, shelf)
      if (!displayName) displayName = res.displayName
      all.push(...res.books)
    } catch (e) {
      // One empty or unreadable shelf shouldn't sink the whole import — a
      // profile with nothing on "currently-reading" is completely normal.
      if (!firstError) firstError = e
    }
  }

  if (all.length === 0 && firstError) throw firstError

  /* A book can appear on more than one shelf feed (Goodreads lets a review sit
     on "read" and still be listed elsewhere). Keep the first occurrence, which
     is the earliest shelf in EXCLUSIVE_SHELVES order. */
  const seen = new Set()
  const books = all.filter(b => {
    const k = `${b.title}|${b.author}`.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { books, displayName }
}

function toCSV(books) {
  const esc = v => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [CSV_FIELDS.join(',')]
  for (const b of books) rows.push(CSV_FIELDS.map(f => esc(b[f])).join(','))
  return rows.join('\n')
}

// ---- local books folder ----

// Best-effort parse of messy book filenames into { title, author }.
// Handles: "(Series) Author, First - Title-Publisher (Year)", "[Author]_Title",
// "Author - Title", site-junk prefixes like "[eBookBB.com]", and underscores.
function parseBookFilename(filename) {
  let name = filename.replace(/\.[^.]+$/, '')          // drop extension
  name = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()   // underscores → spaces

  // Pull off leading bracket/paren groups; remember the first that looks like a name.
  let bracketAuthor = ''
  let m
  while ((m = name.match(/^(\(([^)]*)\)|\[([^\]]*)\])\s*/))) {
    const inner = (m[2] ?? m[3] ?? '').trim()
    const isJunk = /\b(com|net|org|www|ebook|series|translation|vol|edition|classics?|library)\b|\d/i.test(inner)
    const looksLikeName = !isJunk && inner.split(' ').length <= 4 && /[A-Za-z]/.test(inner)
    if (!bracketAuthor && looksLikeName) bracketAuthor = inner
    name = name.slice(m[0].length)
  }

  let author = bracketAuthor, title = name
  const dash = name.indexOf(' - ')
  if (dash > 0) {
    const before = name.slice(0, dash).trim()
    const after = name.slice(dash + 3).trim()
    // Usually "Author - Title", but a "Title - Lastname, First" file (no
    // parenthetical author hint, e.g. "Last Chance to See - Adams, Douglas")
    // reads the other way. A comma on one side and not the other is a much
    // stronger author signal than which side of the dash it's on.
    const afterLooksLikeAuthor =
      !author && !before.includes(',') && /^[^,]+,[^,]+$/.test(after) && after.split(/\s+/).length <= 4
    if (afterLooksLikeAuthor) {
      author = after
      title = before
    } else {
      if (!author) author = before
      title = after
    }
  }
  // strip a trailing "-Publisher (Year)" or "(Year)" tail from the title
  title = title
    .replace(/\s*-\s*[^-]*\(\d{4}\)\s*$/, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .trim()
  // "Lastname, First" → "First Lastname"
  if (author.includes(',')) {
    const [last, first] = author.split(',')
    author = `${(first || '').trim()} ${last.trim()}`.trim()
  }
  return { title: title || name, author }
}

async function scanLocalBooks() {
  const out = []
  let id = 0
  async function walk(dir) {
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full)
      } else {
        const ext = path.extname(e.name).toLowerCase()
        if (!READABLE_EXT.has(ext)) continue
        let size = 0
        let addedAt = 0
        try {
          const st = await fs.stat(full)
          size = st.size
          // "Date added" means when the file landed in the folder, so prefer
          // birthtime. Some filesystems report 0 or a bogus epoch for it, in
          // which case mtime is the closest honest answer.
          addedAt = st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs
        } catch { /* ignore */ }
        const { title, author } = parseBookFilename(e.name)
        out.push({
          id: `local-${id++}`,
          title,
          author,
          format: ext.slice(1),
          relpath: path.relative(BOOKS_DIR, full).split(path.sep).join('/'),
          size,
          addedAt,
        })
      }
    }
  }
  await walk(BOOKS_DIR)
  out.sort((a, b) => a.title.localeCompare(b.title))
  return out
}

function detectImageMime(buf) {
  if (buf.length < 4) return 'application/octet-stream'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif'
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'image/webp'
  return 'image/jpeg'
}

// Extract a cover image from an EPUB (best-effort across the common conventions).
async function extractEpubCover(absPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(absPath))

  let opfPath = null
  const container = zip.file('META-INF/container.xml')
  if (container) {
    const m = (await container.async('text')).match(/full-path="([^"]+)"/)
    if (m) opfPath = m[1]
  }
  if (!opfPath) opfPath = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.opf')) || null
  if (!opfPath) return null

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const opf = await zip.file(opfPath).async('text')

  let href = null
  // 1) <meta name="cover" content="ID"> → matching manifest item
  const meta = opf.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/i)
            || opf.match(/<meta[^>]*content="([^"]+)"[^>]*name="cover"/i)
  if (meta) {
    const id = meta[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const item = opf.match(new RegExp(`<item[^>]*id="${id}"[^>]*href="([^"]+)"`, 'i'))
              || opf.match(new RegExp(`<item[^>]*href="([^"]+)"[^>]*id="${id}"`, 'i'))
    if (item) href = item[1]
  }
  // 2) EPUB3 properties="cover-image"
  if (!href) {
    const m = opf.match(/<item[^>]*properties="[^"]*cover-image[^"]*"[^>]*href="([^"]+)"/i)
           || opf.match(/<item[^>]*href="([^"]+)"[^>]*properties="[^"]*cover-image[^"]*"/i)
    if (m) href = m[1]
  }
  // 3) guess by filename
  if (!href) {
    const guess = Object.keys(zip.files).find(f => /cover[^/]*\.(jpe?g|png|gif|webp)$/i.test(f))
    if (guess) href = guess.startsWith(opfDir) ? guess.slice(opfDir.length) : guess
  }
  if (!href) return null

  const decoded = decodeURIComponent(href)
  const file = zip.file(opfDir + decoded) || zip.file(decoded)
  if (!file) return null
  const buffer = await file.async('nodebuffer')
  return { buffer, mime: detectImageMime(buffer) }
}

// This server is otherwise GET-only, so there's no body parser yet.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : null) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// Resolve a request path to a safe absolute path inside `root`.
function resolveUnder(root, relpath) {
  let decoded
  try { decoded = decodeURIComponent(relpath) } catch { return null }  // malformed %xx
  const abs = path.resolve(root, decoded)
  const prefix = root.endsWith(path.sep) ? root : root + path.sep
  if (abs !== root && !abs.startsWith(prefix)) return null   // path traversal guard
  return abs
}

const resolveLocalFile = relpath => resolveUnder(BOOKS_DIR, relpath)

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const u = new URL(req.url, `http://localhost:${PORT}`)

  // --- stream a local book file for reading ---
  if (u.pathname.startsWith('/files/')) {
    const abs = resolveLocalFile(u.pathname.slice('/files/'.length))
    if (!abs) { res.writeHead(403); res.end('forbidden'); return }
    try {
      const stat = await fs.stat(abs)
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
      })
      createReadStream(abs).pipe(res)
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'file not found' }))
    }
    return
  }

  // --- 3D book models for the Models view ---
  if (u.pathname.startsWith('/models/')) {
    const abs = resolveUnder(MODELS_DIR, u.pathname.slice('/models/'.length))
    // This exposes a folder outside the project, so it serves a fixed
    // allow-list of model formats rather than whatever happens to be in there.
    if (!abs || !['.glb', '.gltf'].includes(path.extname(abs).toLowerCase())) {
      res.writeHead(403); res.end('forbidden'); return
    }
    try {
      const stat = await fs.stat(abs)
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        // Immutable art assets; without this, every view switch refetches ~20 MB.
        'Cache-Control': 'public, max-age=86400',
      })
      createReadStream(abs).pipe(res)
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'model not found' }))
    }
    return
  }

  // --- which models exist; the Models view falls back cleanly without them ---
  if (u.pathname === '/api/models') {
    try {
      const models = (await fs.readdir(MODELS_DIR))
        .filter(f => f.toLowerCase().endsWith('.glb'))
        .sort()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ models, dir: MODELS_DIR }))
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ models: [], dir: MODELS_DIR, error: e.message }))
    }
    return
  }

  // --- reveal a local book's file in Windows Explorer ---
  if (u.pathname === '/api/reveal') {
    const id = u.searchParams.get('id') || ''
    try {
      if (!localCatalog) localCatalog = await scanLocalBooks()
      const book = localCatalog.find(b => b.id === id)
      if (!book) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
        return
      }
      const abs = path.resolve(BOOKS_DIR, book.relpath)
      // explorer.exe reports a non-zero exit code even on success, so the
      // callback is only there to stop an unhandled rejection — not checked.
      execFile('explorer.exe', [`/select,${abs}`], () => {})
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: e.message }))
    }
    return
  }

  // --- local books catalog (cached; ?refresh=1 to rescan) ---
  if (u.pathname === '/api/local-books') {
    try {
      if (!localCatalog || u.searchParams.get('refresh')) localCatalog = await scanLocalBooks()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ books: localCatalog, count: localCatalog.length, dir: BOOKS_DIR }))
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'scan failed' }))
    }
    return
  }

  // --- extracted EPUB cover image (memory-cached), or a cached result from a
  //     previous "Update library" scan. Never starts a new search itself —
  //     see searchCover()'s comment for why. ---
  if (u.pathname === '/api/cover') {
    const id = u.searchParams.get('id') || ''
    const refresh = !!u.searchParams.get('refresh')
    try {
      if (!localCatalog) localCatalog = await scanLocalBooks()
      const book = localCatalog.find(b => b.id === id)
      if (!book) { res.writeHead(404); res.end('no cover'); return }

      if (book.format === 'epub') {
        let entry = refresh ? null : coverCache.get(id)
        if (!entry) {
          const abs = path.resolve(BOOKS_DIR, book.relpath)
          entry = await extractEpubCover(abs).catch(() => null)
          if (entry) {
            if (coverCache.size > 800) coverCache.delete(coverCache.keys().next().value)
            coverCache.set(id, entry)
          }
        }
        if (entry) {
          res.writeHead(200, {
            'Content-Type': entry.mime,
            'Content-Length': entry.buffer.length,
            'Cache-Control': 'public, max-age=604800',
          })
          res.end(entry.buffer)
          return
        }
      }

      const found = await getCachedCover(book.title, book.author)
      if (found) {
        res.writeHead(302, { Location: found, 'Cache-Control': 'public, max-age=604800' })
        res.end()
      } else {
        res.writeHead(404); res.end('no cover')
      }
    } catch (e) {
      res.writeHead(404); res.end('cover error: ' + (e.message || ''))
    }
    return
  }

  // --- explicit "Update library" scan: rescans the local folder, then
  //     resolves covers for every local book plus whatever other (curated /
  //     Goodreads / saved) books the client says are still missing one. The
  //     only place a new online search is ever started — see searchCover(). ---
  if (u.pathname === '/api/scan-covers' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const otherBooks = Array.isArray(body?.books) ? body.books : []

      localCatalog = await scanLocalBooks()
      let localFound = 0
      await Promise.all(localCatalog.map(async book => {
        if (book.format === 'epub' && !coverCache.has(book.id)) {
          const abs = path.resolve(BOOKS_DIR, book.relpath)
          const entry = await extractEpubCover(abs).catch(() => null)
          if (entry) {
            if (coverCache.size > 800) coverCache.delete(coverCache.keys().next().value)
            coverCache.set(book.id, entry)
            localFound++
            return
          }
        }
        const key = coverSearchKey(book.title, book.author)
        if (!key) return
        const cache = await loadCoverSearchCache()
        if (cache.has(key)) return
        if (await searchCover(book.title, book.author, key)) localFound++
      }))

      const results = {}
      let otherFound = 0
      await Promise.all(otherBooks.map(async b => {
        const key = coverSearchKey(b.title, b.author)
        if (!key || !b.key) return
        const cache = await loadCoverSearchCache()
        const coverUrl = cache.has(key) ? cache.get(key) : await searchCover(b.title, b.author, key)
        if (coverUrl) otherFound++
        results[b.key] = coverUrl
      }))

      await persistCoverSearchCache()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        localScanned: localCatalog.length, localFound,
        otherScanned: otherBooks.length, otherFound,
        results,
      }))
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'scan failed' }))
    }
    return
  }

  if (u.pathname !== '/api/goodreads') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
    return
  }

  const raw = u.searchParams.get('userid') || ''
  const match = raw.match(/\d{1,12}/)
  if (!match) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Provide a numeric Goodreads user id.' }))
    return
  }
  const userId = match[0]
  const cacheFile = path.join(DATA_DIR, `goodreads_${userId}.json`)
  const wantsFresh = !!u.searchParams.get('refresh')

  // Switching between profiles shouldn't re-scrape three shelves every time, so
  // a snapshot is kept on disk and served until it ages out or is refreshed by
  // hand. Guest profiles in particular are read far more often than they change.
  if (!wantsFresh) {
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'))
      if (cached?.books?.length && Date.now() - (cached.fetchedAt || 0) < CACHE_TTL_MS) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ...cached, cached: true, count: cached.books.length }))
        return
      }
    } catch { /* no cache yet, or unreadable — fall through and fetch */ }
  }

  try {
    const { books, displayName } = await fetchGoodreads(userId)
    if (books.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No books found. The profile may be private or empty.' }))
      return
    }
    const payload = { books, name: displayName, userId, fetchedAt: Date.now() }
    let saved = ''
    try {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(cacheFile, JSON.stringify(payload), 'utf8')
      // The CSV is what you hand to Goodreads' own importer, so it's written
      // alongside the cache rather than generated on demand.
      saved = `goodreads_${userId}.csv`
      await fs.writeFile(path.join(DATA_DIR, saved), toCSV(books), 'utf8')
    } catch (e) {
      console.error('Could not persist snapshot:', e.message)
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ...payload, saved, count: books.length, cached: false }))
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e.message || 'Failed to fetch Goodreads library.' }))
  }
})

// Never let a single malformed request bring the whole backend down.
process.on('uncaughtException', err => console.error('uncaught:', err?.message || err))

// A full-library cover scan can run for minutes on a large collection —
// well past Node's 5-minute default request timeout.
server.requestTimeout = 15 * 60 * 1000
server.headersTimeout = 15 * 60 * 1000 + 1000

server.listen(PORT, () => {
  console.log(`Booklit backend listening on http://localhost:${PORT}`)
  console.log(`  • /api/goodreads?userid=…   Goodreads import`)
  console.log(`  • /api/local-books          catalog of ${BOOKS_DIR}`)
  console.log(`  • /files/<relpath>          stream a local book`)
})
