#!/usr/bin/env python3
"""
server.py  -  Local development server for the 3D Bookshelf.

Run:  python server.py
Open: http://localhost:8765

Features vs opening ptable_002.html directly:
  - Covers cached to disk in data/covers/ - instant on repeat loads
  - Background cover fetching (non-blocking) - books appear immediately
  - Serves everything from project root so relative paths just work
  - Goodreads RSS fetch attempt via /api/goodreads?userid=...
"""

import http.server
import socketserver
import threading
import json
import os
import re
import hashlib
import tempfile
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from datetime import datetime

PORT     = 8766
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CDIR     = os.path.join(BASE_DIR, 'data', 'covers')
WORKERS  = 10
HDRS     = {'User-Agent': 'bookshelf-viewer/1.0', 'Accept': '*/*'}


def _upgrade_image_url(url: str) -> str:
    """Strip Amazon/Goodreads CDN size suffixes to get full-resolution image.

    Goodreads CSV cover_url values often look like:
      https://i.gr-assets.com/.../12345._SY75_.jpg
      https://i.gr-assets.com/.../12345._SX50_SY75_.jpg
    Removing the ._SX50_SY75_ suffix (anything matching ._SOMETHING_) before
    the extension returns the original full-size image from the same CDN.
    """
    if not url:
        return url
    return re.sub(r'\._[A-Z0-9_,]+_(?=\.(?:jpg|jpeg|png))', '', url, flags=re.IGNORECASE)

sys.path.insert(0, BASE_DIR)
from fetch_goodreads import load_csv


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE_DIR, **kw)

    def do_GET(self):
        if self.path in ('', '/'):
            self.path = '/index.html'
        elif self.path == '/api/models':
            self._handle_models()
            return
        elif self.path.startswith('/api/goodreads'):
            self._handle_goodreads()
            return
        super().do_GET()

    def _handle_models(self):
        models_dir = os.path.join(BASE_DIR, 'assets', 'models')
        files = sorted(f for f in os.listdir(models_dir) if f.endswith('.glb'))
        self._json(files)

    def do_POST(self):
        if self.path == '/api/process':
            self._handle_process()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _handle_process(self):
        try:
            n    = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(n).decode('utf-8', errors='replace')
            if not body.strip():
                return self._json({'error': 'Empty request body'}, 400)

            books = _books_from_csv_text(body)
            if not books:
                return self._json({'error': 'No books found - check CSV format'}, 400)

            # Upgrade any small Goodreads CDN thumbnails to full-res
            for b in books:
                if b.get('cover_url'):
                    b['cover_url'] = _upgrade_image_url(b['cover_url'])

            # Fill covers that are already on disk (instant)
            _fill_cached_covers(books)
            cached_count = sum(1 for b in books if b.get('cover_url'))
            uncached     = [b for b in books if not b.get('cover_url')]

            print(f'  Parsed {len(books)} books ({cached_count} covers cached, '
                  f'{len(uncached)} to fetch in background)', flush=True)

            # Return immediately so the browser isn't blocked
            self._json(books)

            # Background: fetch + cache remaining covers (next load they'll be instant)
            if uncached:
                threading.Thread(target=_fill_covers, args=(books,), daemon=True).start()

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._json({'error': str(e)}, 500)

    def _handle_goodreads(self):
        """Try to fetch books from Goodreads public RSS feed."""
        qs  = parse_qs(urlparse(self.path).query)
        raw = qs.get('userid', [''])[0].strip()
        if not raw:
            return self._json({'error': 'userid parameter required'}, 400)

        # Extract numeric ID from URL or plain number
        m = re.search(r'\b(\d{4,12})\b', raw)
        if not m:
            return self._json({'error': 'Could not extract a numeric user ID from the input'}, 400)

        userid = m.group(1)

        # Try the RSS endpoint
        rss_url = f'https://www.goodreads.com/review/list_rss/{userid}?shelf=%23ALL%23&per_page=200'
        try:
            req = Request(rss_url, headers={**HDRS, 'Accept': 'application/rss+xml, application/xml, text/xml'})
            with urlopen(req, timeout=20) as r:
                data = r.read()
                ct   = r.headers.get('Content-Type', '')

            # Goodreads redirects to sign-in HTML when auth is required
            if b'<!DOCTYPE' in data[:200] or b'<html' in data[:200].lower() or 'html' in ct:
                return self._json({
                    'error': (
                        'Goodreads requires sign-in to access this feed. '
                        'To export your books: goodreads.com -> My Books -> '
                        'Import and Export -> Export Library, then upload the CSV here.'
                    )
                }, 403)

            books = _parse_goodreads_rss(data)
            if not books:
                return self._json({'error': 'No books found in feed (shelf may be empty or private)'}, 404)

            # Save to data/
            os.makedirs('data', exist_ok=True)
            stamp    = datetime.now().strftime('%Y%m%d_%H%M%S')
            out_path = os.path.join(BASE_DIR, 'data', f'goodreads_{userid}_{stamp}.csv')
            import csv
            with open(out_path, 'w', newline='', encoding='utf-8') as f:
                from fetch_goodreads import CSV_FIELDS
                writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
                writer.writeheader()
                writer.writerows(books)

            # Fill cached covers, background-fetch the rest
            _fill_cached_covers(books)
            uncached = [b for b in books if not b.get('cover_url')]
            if uncached:
                threading.Thread(target=_fill_covers, args=(books,), daemon=True).start()

            print(f'  Goodreads: {len(books)} books for user {userid} -> {out_path}', flush=True)
            return self._json({'books': books, 'saved': os.path.basename(out_path)})

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._json({'error': str(e)}, 500)

    # ---- helpers ----
    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        status = args[1] if len(args) > 1 else '?'
        path   = args[0].split()[1] if args else '?'
        if not path.startswith('/data/covers'):    # suppress cover spam
            print(f'  {status}  {path}', flush=True)


# ---------------------------------------------------------------------------
# CSV -> book list
# ---------------------------------------------------------------------------

def _books_from_csv_text(csv_text: str) -> list[dict]:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv',
                                     delete=False, encoding='utf-8') as f:
        f.write(csv_text)
        tmp = f.name
    try:
        return load_csv(tmp)
    finally:
        os.unlink(tmp)


# ---------------------------------------------------------------------------
# Goodreads RSS parser
# ---------------------------------------------------------------------------

def _parse_goodreads_rss(xml_bytes: bytes) -> list[dict]:
    """Parse Goodreads RSS feed into book dicts."""
    root = ET.fromstring(xml_bytes)
    ns   = {'gr': 'http://www.goodreads.com/gr/'}
    books = []
    for item in root.iter('item'):
        def t(tag, default=''):
            el = item.find(tag)
            return (el.text or '').strip() if el is not None else default

        title     = t('title')
        author    = t('author_name') or t('{http://www.goodreads.com/gr/}author_name')
        isbn      = re.sub(r'\D', '', t('isbn') or t('{http://www.goodreads.com/gr/}isbn'))
        isbn13    = re.sub(r'\D', '', t('isbn13') or t('{http://www.goodreads.com/gr/}isbn13'))
        cover_url = t('book_image_url') or t('image_url') or t('{http://www.goodreads.com/gr/}image_url')
        book_link = t('link')
        rating    = t('average_rating') or t('{http://www.goodreads.com/gr/}average_rating')
        my_rating = t('user_rating') or t('{http://www.goodreads.com/gr/}user_rating')
        pages     = t('num_pages') or t('{http://www.goodreads.com/gr/}num_pages')
        year      = t('book_published') or t('{http://www.goodreads.com/gr/}book_published')
        shelf     = t('user_shelves') or t('{http://www.goodreads.com/gr/}user_shelves') or 'read'

        if not title:
            continue

        books.append({
            'title':         title,
            'author':        author or 'Unknown',
            'year':          year,
            'isbn':          isbn13 or isbn,
            'rating':        rating,
            'my_rating':     my_rating,
            'pages':         pages,
            'cover_url':     _upgrade_image_url(cover_url),
            'goodreads_url': book_link,
            'shelf':         shelf,
        })
    return books


# ---------------------------------------------------------------------------
# Cover fetching + disk cache
# ---------------------------------------------------------------------------

def _cache_path(book: dict) -> tuple[str, str]:
    """(absolute_path, url_path_for_client)"""
    isbn = book.get('isbn', '').strip()
    if isbn and len(isbn) >= 10:
        name = f'isbn_{isbn}_L.jpg'
    else:
        key  = hashlib.md5(
            f"{book.get('title','')}|{book.get('author','')}".lower().encode()
        ).hexdigest()[:14]
        name = f'book_{key}_L.jpg'
    return os.path.join(CDIR, name), f'/data/covers/{name}'


def _fill_cached_covers(books: list[dict]):
    """Fill cover_url from disk cache only — no network requests."""
    for book in books:
        if book.get('cover_url'):
            continue
        abs_path, url_path = _cache_path(book)
        if os.path.exists(abs_path) and os.path.getsize(abs_path) > 500:
            book['cover_url'] = url_path


def _fetch_one(book: dict) -> str | None:
    """Fetch, cache and return the local URL path for a cover. None = not found."""
    abs_path, url_path = _cache_path(book)

    # Already cached on disk
    if os.path.exists(abs_path) and os.path.getsize(abs_path) > 500:
        return url_path

    isbn    = book.get('isbn', '').strip()
    img_url = None

    # 1. Direct ISBN lookup (fastest)
    if isbn and len(isbn) >= 10:
        test = f'https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false'
        try:
            with urlopen(Request(test, headers=HDRS, method='HEAD'), timeout=5) as r:
                if r.status == 200:
                    img_url = f'https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg'
        except Exception:
            pass

    # 2. Search API fallback
    if not img_url:
        title  = book.get('title', '')
        author = book.get('author', '')
        # Skip elements/spacers
        if not title or title == '-':
            return None
        q = re.sub(r'[^\w\s]', ' ', f'{title} {author}').strip()
        q = re.sub(r'\s+', '+', q)
        try:
            req = Request(
                f'https://openlibrary.org/search.json?q={q}&limit=1&fields=cover_i',
                headers={**HDRS, 'Accept': 'application/json'}
            )
            with urlopen(req, timeout=9) as r:
                data = json.loads(r.read())
            if data.get('docs') and data['docs'][0].get('cover_i'):
                img_url = f"https://covers.openlibrary.org/b/id/{data['docs'][0]['cover_i']}-L.jpg"
        except Exception:
            pass

    if not img_url:
        return None

    # 3. Download and cache
    try:
        with urlopen(Request(img_url, headers=HDRS), timeout=12) as r:
            data = r.read()
        if len(data) > 500:
            os.makedirs(CDIR, exist_ok=True)
            with open(abs_path, 'wb') as f:
                f.write(data)
            return url_path
    except Exception:
        pass

    return None


def _fill_covers(books: list[dict]):
    """Parallel cover fetch for all books; mutates cover_url in place."""
    need = [b for b in books if not b.get('cover_url') and b.get('title')]
    if not need:
        return
    print(f'  Background: fetching {len(need)} covers...', flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        fut_to_book = {ex.submit(_fetch_one, b): b for b in need}
        done = 0
        for fut in as_completed(fut_to_book):
            done += 1
            b = fut_to_book[fut]
            try:
                result = fut.result()
                if result:
                    b['cover_url'] = result
            except Exception:
                pass
            if done % 20 == 0 or done == len(need):
                found = sum(1 for b in need if b.get('cover_url'))
                print(f'  Background covers: {done}/{len(need)} done, {found} found', flush=True)

    found = sum(1 for b in need if b.get('cover_url'))
    print(f'  Background complete: {found}/{len(need)} covers cached to disk', flush=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    os.makedirs(CDIR, exist_ok=True)
    os.chdir(BASE_DIR)

    cached = len([f for f in os.listdir(CDIR) if f.endswith('.jpg')]) if os.path.isdir(CDIR) else 0
    print(f'3D Bookshelf  ->  http://localhost:{PORT}')
    print(f'Cover cache   ->  data/covers/  ({cached} cached)')
    print(f'Ctrl+C to stop\n')

    with socketserver.TCPServer(('', PORT), Handler) as srv:
        srv.serve_forever()
