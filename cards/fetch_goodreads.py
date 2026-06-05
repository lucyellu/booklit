#!/usr/bin/env python3
"""
fetch_goodreads.py
Process a Goodreads library CSV export, enrich with cover images, save to data/.

Usage:
    python fetch_goodreads.py <goodreads_export.csv> [--no-covers]

    --no-covers   Skip fetching cover images (faster, covers load lazily in the viewer)

How to get your Goodreads export CSV:
    1. Go to https://www.goodreads.com
    2. My Books → Import and Export → Export Library
    3. Wait for the email / page refresh, then download the CSV
    4. Run: python fetch_goodreads.py goodreads_library_export.csv

Output:
    data/goodreads_{YYYYMMDD_HHMMSS}.csv
    Columns: title, author, year, isbn, rating, my_rating, pages, cover_url, goodreads_url, shelf

Load the resulting CSV into ptable_002.html with the "Choose CSV File" button.
"""

import sys
import csv
import os
import re
import time
import json
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# ---- Config ----
OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json?q={query}&limit=1&fields=cover_i,isbn'
OPEN_LIBRARY_COVER  = 'https://covers.openlibrary.org/b/id/{id}-M.jpg'
COVER_REQUEST_DELAY = 0.25   # seconds between Open Library requests
MAX_COVERS          = 500    # safety cap

CSV_FIELDS = [
    'title', 'author', 'year', 'isbn',
    'rating', 'my_rating', 'pages',
    'cover_url', 'goodreads_url', 'shelf',
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; bookshelf-viewer/1.0)',
    'Accept': 'application/json',
}


# ---- CSV parsing ----

def parse_csv_line(line: str) -> list[str]:
    """Handle quoted fields with embedded commas/newlines."""
    result, cur, in_q = [], '', False
    for ch in line:
        if ch == '"':
            in_q = not in_q
        elif ch == ',' and not in_q:
            result.append(cur)
            cur = ''
        else:
            cur += ch
    result.append(cur)
    return result


def detect_format(headers: list[str]) -> str:
    """Return 'goodreads_export', 'bookshelf', or 'custom'."""
    h = [x.lower().strip() for x in headers]
    if 'book id' in h or 'my rating' in h:
        return 'goodreads_export'
    if 'title' in h and 'author' in h and 'cover_url' in h:
        return 'bookshelf'
    # Custom format: Name, Nickname, extended_name, Year, ...
    return 'custom'


def load_csv(path: str) -> list[dict]:
    """Auto-detect format and parse any supported CSV into book dicts."""
    with open(path, newline='', encoding='utf-8-sig') as f:
        raw = f.read()

    lines = raw.strip().split('\n')
    if not lines:
        return []
    headers = parse_csv_line(lines[0])
    fmt = detect_format(headers)

    if fmt == 'goodreads_export':
        return load_goodreads_export_text(raw)
    elif fmt == 'bookshelf':
        return load_bookshelf_csv_text(raw)
    else:
        return load_custom_csv_text(raw)


def load_custom_csv_text(raw: str) -> list[dict]:
    """books_1.csv format: Name, Nickname, extended_name, Year, Month, Day, Link to Profile, ..."""
    lines = raw.strip().split('\n')
    books = []
    for line in lines[1:]:
        if not line.strip():
            continue
        c = parse_csv_line(line)
        title  = c[0].strip() if len(c) > 0 else ''
        author = c[1].strip() if len(c) > 1 else ''
        if not title or title == 'nan':
            continue
        try:
            year = str(int(c[3])) if len(c) > 3 and c[3].strip().isdigit() else ''
        except Exception:
            year = ''
        gr_url = c[6].strip() if len(c) > 6 else ''
        books.append({
            'title':         title,
            'author':        author if author and author != 'nan' else 'Unknown',
            'year':          year,
            'isbn':          '',
            'rating':        '',
            'my_rating':     '',
            'pages':         '',
            'cover_url':     '',
            'goodreads_url': gr_url,
            'shelf':         'read',
        })
    return books


def load_bookshelf_csv_text(raw: str) -> list[dict]:
    """fetch_goodreads.py output: title,author,year,isbn,rating,my_rating,pages,cover_url,goodreads_url,shelf"""
    reader = csv.DictReader(raw.splitlines())
    books = []
    for row in reader:
        title = row.get('title', '').strip()
        if not title:
            continue
        books.append({
            'title':         title,
            'author':        row.get('author', 'Unknown').strip(),
            'year':          row.get('year', '').strip(),
            'isbn':          row.get('isbn', '').strip(),
            'rating':        row.get('rating', '').strip(),
            'my_rating':     row.get('my_rating', '').strip(),
            'pages':         row.get('pages', '').strip(),
            'cover_url':     upgrade_cover_url(row.get('cover_url', '').strip()),
            'goodreads_url': row.get('goodreads_url', '').strip(),
            'shelf':         row.get('shelf', 'read').strip(),
        })
    return books


def load_goodreads_export(path: str) -> list[dict]:
    """Convenience wrapper — reads file then delegates."""
    with open(path, newline='', encoding='utf-8-sig') as f:
        return load_goodreads_export_text(f.read())


def load_goodreads_export_text(raw: str) -> list[dict]:
    """
    Parse official Goodreads library export CSV.
    Columns: Book Id, Title, Author, ISBN, ISBN13, My Rating,
    Average Rating, Number of Pages, Year Published, Original Publication Year,
    Bookshelves, Exclusive Shelf, ...
    """
    reader = csv.DictReader(raw.splitlines())
    books = []
    for row in reader:
        def g(key, alt=''):
            return (row.get(key) or row.get(alt) or '').strip().strip('="')

        title = g('Title')
        if not title:
            continue

        isbn = re.sub(r'\D', '', g('ISBN13') or g('ISBN'))

        year_str = g('Original Publication Year') or g('Year Published')
        try:
            year = str(int(year_str))
        except (ValueError, TypeError):
            year = ''

        goodreads_id = g('Book Id')
        books.append({
            'title':         title,
            'author':        g('Author') or 'Unknown',
            'year':          year,
            'isbn':          isbn,
            'rating':        g('Average Rating'),
            'my_rating':     g('My Rating'),
            'pages':         g('Number of Pages'),
                'cover_url':     '',
                'goodreads_url': f'https://www.goodreads.com/book/show/{goodreads_id}' if goodreads_id else '',
                'shelf':         g('Exclusive Shelf') or 'read',
            })
    return books


# ---- Cover enrichment ----

def upgrade_cover_url(url: str) -> str:
    """Upgrade Goodreads thumbnail URLs (._SX50_.jpg, ._SY75_.jpg, etc.) to full size."""
    if url and ('i.gr-assets.com' in url or 'compressed.photo.goodreads.com' in url):
        url = re.sub(r'\._S[XY]\d+_\.jpg', '.jpg', url)
    return url


def fetch_cover_url(title: str, author: str, isbn: str = '') -> str | None:
    """Try to find a cover image URL from Open Library."""
    # Strategy 1: direct ISBN lookup (fast)
    if isbn and len(isbn) >= 10:
        url = f'https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false'
        req = Request(url, headers=HEADERS, method='HEAD')
        try:
            with urlopen(req, timeout=8) as r:
                if r.status == 200:
                    return f'https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg'
        except Exception:
            pass

    # Strategy 2: search by title + author
    query = re.sub(r'[^\w\s]', ' ', f'{title} {author}').strip()
    query = re.sub(r'\s+', '+', query)
    url   = OPEN_LIBRARY_SEARCH.format(query=query)
    req   = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8', errors='replace'))
        if data.get('docs'):
            doc = data['docs'][0]
            if doc.get('cover_i'):
                return OPEN_LIBRARY_COVER.format(id=doc['cover_i'])
    except Exception:
        pass

    return None


def enrich_covers(books: list[dict], verbose: bool = True) -> None:
    """Fetch and fill cover_url in-place for books that don't have one."""
    to_fetch = [b for b in books if not b['cover_url']]
    n = min(len(to_fetch), MAX_COVERS)
    if n == 0:
        return

    if verbose:
        print(f'\nFetching covers from Open Library for {n} books…')

    for i, book in enumerate(to_fetch[:n]):
        if verbose:
            pct = int((i + 1) / n * 100)
            bar = '█' * (pct // 5) + '░' * (20 - pct // 5)
            print(f'\r  [{bar}] {pct:3d}%  {book["title"][:40]:<40}', end='', flush=True)

        url = fetch_cover_url(book['title'], book['author'], book['isbn'])
        if url:
            book['cover_url'] = url

        time.sleep(COVER_REQUEST_DELAY)

    if verbose:
        found = sum(1 for b in to_fetch[:n] if b['cover_url'])
        print(f'\r  Done. {found}/{n} covers found.{" " * 50}')


# ---- Main ----

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_path  = sys.argv[1]
    fetch_covers = '--no-covers' not in sys.argv

    # Validate input file
    if not os.path.isfile(input_path):
        print(f'Error: file not found: {input_path!r}')
        print()
        print('If you meant to use a Goodreads URL, note that Goodreads no longer\n'
              'provides a public RSS API. Please export your library instead:\n'
              '  goodreads.com → My Books → Import and Export → Export Library')
        sys.exit(1)

    print(f'Reading: {input_path}')
    books = load_csv(input_path)

    if not books:
        print('No books found.')
        print('Supported formats:')
        print('  • Official Goodreads export  (Book Id, Title, Author, …)')
        print('  • fetch_goodreads.py output  (title, author, year, cover_url, …)')
        print('  • books_1.csv custom format  (Name, Nickname, Year, …)')
        sys.exit(1)

    print(f'Loaded {len(books)} books.')

    # Show shelf breakdown
    shelves: dict[str, int] = {}
    for b in books:
        shelves[b['shelf']] = shelves.get(b['shelf'], 0) + 1
    for shelf, count in sorted(shelves.items(), key=lambda x: -x[1]):
        print(f'  {shelf}: {count}')

    if fetch_covers:
        enrich_covers(books, verbose=True)
    else:
        print('Skipping cover fetch (--no-covers).')

    # Save output
    os.makedirs('data', exist_ok=True)
    stamp    = datetime.now().strftime('%Y%m%d_%H%M%S')
    stem     = Path(input_path).stem[:30]          # use source filename in output name
    out_path = f'data/goodreads_{stem}_{stamp}.csv'

    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(books)

    covered = sum(1 for b in books if b['cover_url'])
    print(f'\nSaved {len(books)} books -> {out_path}')
    print(f'Cover images: {covered}/{len(books)}')
    print()
    print('Open ptable_002.html and use "Choose CSV File" to load this file.')


if __name__ == '__main__':
    main()
