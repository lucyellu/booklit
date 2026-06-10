// Minimal, dependency-free backend for Booklit.
//
//   GET /api/goodreads?userid=<id>  → pull a public Goodreads library (RSS).
//   GET /api/local-books            → catalog of a local books folder.
//   GET /files/<relpath>            → stream a file from that folder for reading.
//
// Run:  node server/goodreads-server.mjs   (listens on :8765, proxied by Vite)

import http from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'

const PORT = process.env.GOODREADS_PORT ? Number(process.env.GOODREADS_PORT) : 8765
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')
const MAX_PAGES = 20          // ~20 books/page on RSS → up to ~400 books
const UA = 'Mozilla/5.0 (compatible; booklit/1.0)'

// Local books folder (override with BOOKS_DIR env var).
const BOOKS_DIR = path.resolve(process.env.BOOKS_DIR || 'L:\\Media\\Text\\Books')
// Formats the in-app text+audio reader can open.
const READABLE_EXT = new Set(['.epub', '.pdf', '.txt', '.md'])
const MIME = {
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}
let localCatalog = null   // cached [{id,title,author,format,relpath,size}]

const CSV_FIELDS = [
  'title', 'author', 'year', 'isbn', 'rating', 'my_rating',
  'pages', 'cover_url', 'goodreads_url', 'shelf', 'epub_link',
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

function parseFeed(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || []
  return items.map(block => {
    const isbn = tag(block, 'isbn').replace(/\D/g, '')
    const bookId = tag(block, 'book_id')
    let cover = upgradeCover(tag(block, 'book_large_image_url') || tag(block, 'book_medium_image_url') || tag(block, 'book_image_url'))
    if (!cover && isbn) cover = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
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
      shelf: tag(block, 'user_shelves') || 'read',
      epub_link: isbn ? `https://openlibrary.org/isbn/${isbn}` : '',
    }
  }).filter(b => b.title)
}

async function fetchGoodreads(userId) {
  const all = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=ALL&page=${page}&per_page=100`
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
    const books = parseFeed(xml)
    if (books.length === 0) break
    all.push(...books)
    if (books.length < 20) break  // last page
  }
  return all
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
    if (!author) author = name.slice(0, dash).trim()
    title = name.slice(dash + 3).trim()
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
        try { size = (await fs.stat(full)).size } catch { /* ignore */ }
        const { title, author } = parseBookFilename(e.name)
        out.push({
          id: `local-${id++}`,
          title,
          author,
          format: ext.slice(1),
          relpath: path.relative(BOOKS_DIR, full).split(path.sep).join('/'),
          size,
        })
      }
    }
  }
  await walk(BOOKS_DIR)
  out.sort((a, b) => a.title.localeCompare(b.title))
  return out
}

// Resolve a /files/<relpath> request to a safe absolute path inside BOOKS_DIR.
function resolveLocalFile(relpath) {
  let decoded
  try { decoded = decodeURIComponent(relpath) } catch { return null }  // malformed %xx
  const abs = path.resolve(BOOKS_DIR, decoded)
  const root = BOOKS_DIR.endsWith(path.sep) ? BOOKS_DIR : BOOKS_DIR + path.sep
  if (abs !== BOOKS_DIR && !abs.startsWith(root)) return null   // path traversal guard
  return abs
}

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

  try {
    const books = await fetchGoodreads(userId)
    if (books.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No books found. The profile may be private or empty.' }))
      return
    }
    let saved = ''
    try {
      await fs.mkdir(DATA_DIR, { recursive: true })
      saved = `goodreads_${userId}.csv`
      await fs.writeFile(path.join(DATA_DIR, saved), toCSV(books), 'utf8')
    } catch (e) {
      console.error('Could not persist CSV:', e.message)
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ books, saved, count: books.length }))
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e.message || 'Failed to fetch Goodreads library.' }))
  }
})

// Never let a single malformed request bring the whole backend down.
process.on('uncaughtException', err => console.error('uncaught:', err?.message || err))

server.listen(PORT, () => {
  console.log(`Booklit backend listening on http://localhost:${PORT}`)
  console.log(`  • /api/goodreads?userid=…   Goodreads import`)
  console.log(`  • /api/local-books          catalog of ${BOOKS_DIR}`)
  console.log(`  • /files/<relpath>          stream a local book`)
})
