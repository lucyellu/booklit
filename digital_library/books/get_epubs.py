#!/usr/bin/env python3
"""
Patrick Collison Bookshelf — EPUB Downloader
=============================================
Tries 3 strategies in order for each book:

  1. Project Gutenberg   — search by title/author, download EPUB if found
  2. Standard Ebooks     — check slug-based URL pattern, download if found
  3. Open Library        — check if a borrowable/readable EPUB exists,
                           save a .url shortcut to the borrow page if so
                           (OL lending requires a free account + browser)

Usage (Windows):
    pip install requests beautifulsoup4
    python get_epubs.py

Output folders (created automatically next to this script):
    epubs/gutenberg/      — downloaded .epub files
    epubs/standard_ebooks/— downloaded .epub files
    epubs/open_library/   — .url shortcut files (browser borrow links)
    epubs_report.csv      — full status report for every book

Estimated runtime: 30-60 min for 763 books (polite rate limiting).
Re-running is safe — already-downloaded files are skipped.
"""

import csv
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus, urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit(
        "Missing dependencies. Please run:\n"
        "    pip install requests beautifulsoup4\n"
        "then try again."
    )

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR   = Path(__file__).parent
INPUT_CSV    = SCRIPT_DIR / "patrick_collison_bookshelf.csv"
OUT_DIR      = SCRIPT_DIR / "epubs"
GUT_DIR      = OUT_DIR / "gutenberg"
SE_DIR       = OUT_DIR / "standard_ebooks"
OL_DIR       = OUT_DIR / "open_library"
REPORT_CSV   = SCRIPT_DIR / "epubs_report.csv"

for d in [GUT_DIR, SE_DIR, OL_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "bookshelf-epub-fetcher/1.0 "
        "(personal research; contact: see script comments)"
    )
})
TIMEOUT = 15

def get(url, **kwargs):
    try:
        r = SESSION.get(url, timeout=TIMEOUT, **kwargs)
        r.raise_for_status()
        return r
    except requests.RequestException:
        return None

def delay(seconds=0.5):
    time.sleep(seconds)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_filename(title: str, ext: str = ".epub") -> str:
    """Turn a book title into a safe Windows filename."""
    name = re.sub(r'[<>:"/\\|?*]', '', title)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:120] + ext


def normalise(text: str) -> str:
    """Lowercase, strip punctuation — for fuzzy matching."""
    return re.sub(r'[^a-z0-9 ]', '', text.lower()).strip()


def titles_match(a: str, b: str) -> bool:
    na, nb = normalise(a), normalise(b)
    return na == nb or na in nb or nb in na


# ---------------------------------------------------------------------------
# Strategy 1 — Project Gutenberg
# ---------------------------------------------------------------------------
GUTENBERG_SEARCH = "https://gutendex.com/books/?search={query}"
# gutendex is the canonical free JSON API for Gutenberg — no key needed

def try_gutenberg(title: str, author: str) -> tuple[str, str]:
    """
    Returns (status, detail_or_filepath).
    status: 'downloaded' | 'not_found' | 'no_epub'
    """
    dest = GUT_DIR / safe_filename(title)
    if dest.exists():
        return "already_have", str(dest)

    query = f"{title} {author}".strip()
    url   = GUTENBERG_SEARCH.format(query=quote_plus(query))
    r     = get(url)
    delay(0.4)
    if not r:
        return "error", "gutendex request failed"

    results = r.json().get("results", [])

    # Find best match
    match = None
    for book in results:
        gut_title = book.get("title", "")
        gut_authors = " ".join(
            a.get("name", "") for a in book.get("authors", [])
        )
        if titles_match(title, gut_title):
            match = book
            break
        # looser: first word of title matches
        if normalise(title).split()[0] in normalise(gut_title):
            if author and any(
                normalise(author.split()[-1]) in normalise(a.get("name",""))
                for a in book.get("authors", [])
            ):
                match = book
                break

    if not match:
        return "not_found", ""

    formats = match.get("formats", {})
    epub_url = (
        formats.get("application/epub+zip")
        or formats.get("application/epub")
        or next((v for k, v in formats.items() if "epub" in k), None)
    )
    if not epub_url:
        return "no_epub", f"https://www.gutenberg.org/ebooks/{match['id']}"

    r2 = get(epub_url, stream=True)
    delay(0.6)
    if not r2:
        return "error", "epub download failed"

    with open(dest, "wb") as f:
        for chunk in r2.iter_content(8192):
            f.write(chunk)

    return "downloaded", str(dest)


# ---------------------------------------------------------------------------
# Strategy 2 — Standard Ebooks
# ---------------------------------------------------------------------------
# Standard Ebooks uses predictable URL slugs:
#   https://standardebooks.org/ebooks/author-name/book-title
# We try several slug variants and also search their catalogue JSON.

SE_CATALOGUE_URL = "https://standardebooks.org/opds/all"
_SE_CATALOGUE    = None  # loaded once

def load_se_catalogue() -> list:
    global _SE_CATALOGUE
    if _SE_CATALOGUE is not None:
        return _SE_CATALOGUE

    print("  [Standard Ebooks] Loading catalogue (one-time)...", flush=True)
    r = get(SE_CATALOGUE_URL)
    delay(1)
    if not r:
        _SE_CATALOGUE = []
        return _SE_CATALOGUE

    # OPDS Atom feed — parse with BeautifulSoup xml
    soup = BeautifulSoup(r.content, "xml")
    entries = []
    for entry in soup.find_all("entry"):
        t = entry.find("title")
        author_el = entry.find("author")
        epub_link = entry.find("link", type="application/epub+zip")
        se_id = entry.find("id")
        entries.append({
            "title":  t.text    if t    else "",
            "author": author_el.find("name").text if author_el and author_el.find("name") else "",
            "epub":   epub_link["href"] if epub_link else "",
            "id":     se_id.text if se_id else "",
        })
    _SE_CATALOGUE = entries
    print(f"  [Standard Ebooks] Catalogue loaded: {len(entries)} titles", flush=True)
    return _SE_CATALOGUE


def try_standard_ebooks(title: str, author: str) -> tuple[str, str]:
    dest = SE_DIR / safe_filename(title)
    if dest.exists():
        return "already_have", str(dest)

    catalogue = load_se_catalogue()
    if not catalogue:
        return "error", "catalogue unavailable"

    match = None
    for entry in catalogue:
        if titles_match(title, entry["title"]):
            # if we have an author, confirm it loosely
            if author:
                auth_last = normalise(author.split()[-1]) if author else ""
                if auth_last and auth_last not in normalise(entry["author"]):
                    continue
            match = entry
            break

    if not match:
        return "not_found", ""

    epub_url = match.get("epub", "")
    if not epub_url:
        return "no_epub", match.get("id", "")

    # Standard Ebooks epub URLs are relative to their domain
    if epub_url.startswith("/"):
        epub_url = "https://standardebooks.org" + epub_url

    r = get(epub_url, stream=True)
    delay(0.6)
    if not r:
        return "error", "epub download failed"

    with open(dest, "wb") as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)

    return "downloaded", str(dest)


# ---------------------------------------------------------------------------
# Strategy 3 — Open Library borrowing
# ---------------------------------------------------------------------------
# OL lending API: https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&jscmd=data&format=json
# We check if the edition has an "ebook_access" field of "borrowable" or "public"
# For public domain items, we can get a direct read URL.
# We save a .url shortcut file (Windows internet shortcut format) to the borrow page.

OL_BORROW_BASE = "https://openlibrary.org"

def try_open_library(title: str, isbn: str) -> tuple[str, str]:
    """
    Returns (status, url_or_path)
    status: 'shortcut_saved' | 'public_domain_url' | 'borrowable_url' 
            | 'not_available' | 'not_found' | 'error'
    """
    shortcut_dest = OL_DIR / safe_filename(title, ext=".url")
    if shortcut_dest.exists():
        return "already_have", str(shortcut_dest)

    # Try ISBN lookup first
    book_data = {}
    if isbn and isbn.isdigit():
        r = get(
            f"https://openlibrary.org/api/books"
            f"?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        )
        delay(0.4)
        if r:
            book_data = r.json().get(f"ISBN:{isbn}", {})

    # Fallback: title search
    if not book_data:
        r = get(
            f"https://openlibrary.org/search.json"
            f"?title={quote_plus(title)}&limit=3"
        )
        delay(0.4)
        if not r:
            return "error", ""
        docs = r.json().get("docs", [])
        # Find a doc that has ebook access
        for doc in docs:
            if titles_match(title, doc.get("title", "")):
                ebook_access = doc.get("ebook_access", "")
                ol_key = doc.get("key", "")
                if ebook_access in ("borrowable", "public") and ol_key:
                    borrow_url = f"{OL_BORROW_BASE}{ol_key}"
                    _save_url_shortcut(shortcut_dest, borrow_url)
                    return "shortcut_saved", str(shortcut_dest)
                elif ebook_access == "printdisabled":
                    return "not_available", "print-disabled only"
        return "not_found", ""

    # Check ebook access from books API data
    ebook_access = book_data.get("ebook_access", "")
    ol_key = book_data.get("key", "")  # e.g. /books/OL123M

    # Look for read/borrow URL in links
    links = book_data.get("links", [])
    read_url = ""
    for link in links:
        if "read" in link.get("title", "").lower() or "borrow" in link.get("title", "").lower():
            read_url = link.get("url", "")
            break

    # Check works for ebook
    if not read_url and ol_key:
        read_url = f"{OL_BORROW_BASE}{ol_key}"

    # Also check if there's a direct ebook URL via the edition
    ebooks = book_data.get("ebooks", [])
    if ebooks:
        preview = ebooks[0].get("preview_url", "")
        availability = ebooks[0].get("availability", "")
        if availability in ("full", "borrow") and preview:
            read_url = preview

    if read_url:
        _save_url_shortcut(shortcut_dest, read_url)
        label = "public_domain" if ebook_access == "public" else "borrowable"
        return "shortcut_saved", f"{label}: {read_url}"

    return "not_available", ebook_access or "no ebook"


def _save_url_shortcut(path: Path, url: str):
    """Write a Windows .url internet shortcut file."""
    path.write_text(
        f"[InternetShortcut]\nURL={url}\n",
        encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

REPORT_FIELDS = [
    "title", "author", "isbn", "shelf",
    "gutenberg_status", "gutenberg_detail",
    "standard_ebooks_status", "standard_ebooks_detail",
    "open_library_status", "open_library_detail",
    "final_status",   # best outcome across all 3
    "file_or_url",
]

STATUS_RANK = {
    "downloaded":    0,
    "already_have":  0,
    "shortcut_saved":1,
    "no_epub":       2,
    "not_available": 3,
    "not_found":     4,
    "error":         5,
    "":              6,
}

def best_status(statuses: list[tuple[str,str]]) -> tuple[str,str]:
    ranked = sorted(statuses, key=lambda x: STATUS_RANK.get(x[0], 6))
    return ranked[0]


def main():
    if not INPUT_CSV.exists():
        sys.exit(f"Cannot find input CSV: {INPUT_CSV}")

    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    total = len(rows)
    print(f"{'='*60}")
    print(f"Patrick Collison Bookshelf — EPUB Downloader")
    print(f"{'='*60}")
    print(f"Books to process : {total}")
    print(f"Output directory : {OUT_DIR}")
    print(f"{'='*60}\n")

    report = []
    counts = {"downloaded": 0, "shortcut_saved": 0,
              "already_have": 0, "not_found": 0, "error": 0}

    for i, row in enumerate(rows, 1):
        title  = row.get("title", "").strip()
        author = row.get("author", "").strip()
        isbn   = row.get("isbn",   "").strip()
        shelf  = row.get("shelf",  "").strip()

        if not title:
            continue

        print(f"[{i:>3}/{total}] {title[:55]:<55}", end=" ", flush=True)

        # ── Strategy 1: Project Gutenberg ────────────────────────────────
        g_status, g_detail = try_gutenberg(title, author)

        # ── Strategy 2: Standard Ebooks ──────────────────────────────────
        se_status, se_detail = try_standard_ebooks(title, author)

        # ── Strategy 3: Open Library (only if not already downloaded) ────
        already_got = g_status in ("downloaded","already_have") or \
                      se_status in ("downloaded","already_have")
        if already_got:
            ol_status, ol_detail = "skipped", ""
        else:
            ol_status, ol_detail = try_open_library(title, isbn)

        # ── Summarise ────────────────────────────────────────────────────
        final_status, file_or_url = best_status([
            (g_status,  g_detail),
            (se_status, se_detail),
            (ol_status, ol_detail),
        ])

        # Print outcome
        icons = {
            "downloaded":    "✓ EPUB saved",
            "already_have":  "✓ already have",
            "shortcut_saved":"⊙ borrow link",
            "no_epub":       "– no epub",
            "not_available": "– not available",
            "not_found":     "· not found",
            "skipped":       "",
            "error":         "! error",
        }
        g_icon  = "G" if g_status  in ("downloaded","already_have") else "·"
        se_icon = "S" if se_status in ("downloaded","already_have") else "·"
        ol_icon = "O" if ol_status == "shortcut_saved"              else "·"
        print(f"[{g_icon}{se_icon}{ol_icon}] {icons.get(final_status, final_status)}")

        counts[final_status if final_status in counts else
               ("downloaded" if final_status=="already_have" else "not_found")] += 1

        report.append({
            "title":                   title,
            "author":                  author,
            "isbn":                    isbn,
            "shelf":                   shelf,
            "gutenberg_status":        g_status,
            "gutenberg_detail":        g_detail,
            "standard_ebooks_status":  se_status,
            "standard_ebooks_detail":  se_detail,
            "open_library_status":     ol_status,
            "open_library_detail":     ol_detail,
            "final_status":            final_status,
            "file_or_url":             file_or_url,
        })

    # ── Write report ─────────────────────────────────────────────────────
    with open(REPORT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=REPORT_FIELDS)
        writer.writeheader()
        writer.writerows(report)

    # ── Summary ──────────────────────────────────────────────────────────
    downloaded    = sum(1 for r in report if r["final_status"] in ("downloaded","already_have"))
    shortcuts     = sum(1 for r in report if r["final_status"] == "shortcut_saved")
    not_available = sum(1 for r in report if r["final_status"] in ("not_found","not_available","no_epub"))

    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"  ✓ EPUB files downloaded  : {downloaded}")
    print(f"  ⊙ Borrow shortcuts saved : {shortcuts}")
    print(f"  · Not available          : {not_available}")
    print(f"\n  Gutenberg   : {sum(1 for r in report if r['gutenberg_status'] in ('downloaded','already_have'))} found")
    print(f"  Std Ebooks  : {sum(1 for r in report if r['standard_ebooks_status'] in ('downloaded','already_have'))} found")
    print(f"  Open Library: {sum(1 for r in report if r['open_library_status'] == 'shortcut_saved')} borrowable")
    print(f"\n  Full report : {REPORT_CSV}")
    print(f"  EPUB folder : {OUT_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
