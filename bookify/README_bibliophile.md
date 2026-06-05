# Bibliophile — Patrick's Library

Spotify-for-books combining a 3D bookshelf browser with an EPUB reader.

## Quick Start

```bash
# 1. Put all files in one folder:
#    bibliophile.html
#    patrick_collison_bookshelf.csv
#    epubs/              ← from get_epubs.py (optional)
#    epubs/manifest.json ← from generate_manifest.py (optional)

# 2. Start a local server (required for CSV auto-load + EPUB reading):
python -m http.server 8080

# 3. Open in browser:
#    http://localhost:8080/bibliophile.html

# 4. On your phone (same wifi):
#    http://YOUR-LOCAL-IP:8080/bibliophile.html
```

## Features

### Views
- **3D Mode** (desktop default) — Three.js scene with SHELF / SPHERE / HELIX / GRID layouts
- **Flat Mode** (mobile default) — responsive grid like Spotify's album browser
- Toggle with the 3D / Flat buttons top-right, or press **V**

### Card Modes (3D only)
- Cover · Spine · Art Card · 3D Book — buttons in floating toolbar
- Spine width scales with page count

### Book Interaction
- **Click** any book → detail panel slides in (metadata, description, subjects, OL embed)
- **Hover** → quick action buttons: Read · Info · Buy · Patrick's tweets
- **Bottom player bar** — tracks current book, chapter nav, progress

### EPUB Reading
Priority order per book:
1. Local file from `epubs/gutenberg/` or `epubs/standard_ebooks/`
2. Open Library iframe embed (public domain books)
3. Borrow link / buy fallback

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `V` | Toggle 3D / Flat |
| `F` | Focus camera on selection |
| `Esc` | Close reader → close detail → clear selection |
| `←` `→` | Prev / Next chapter (in reader) |

## Generating the EPUB Manifest

After running `get_epubs.py`:

```bash
python generate_manifest.py
```

This scans `epubs/gutenberg/`, `epubs/standard_ebooks/`, and `epubs/open_library/`
and writes `epubs/manifest.json` so the app can match books to their local files.

```python
# generate_manifest.py (minimal version — run once)
import json, os, re
from pathlib import Path

def norm(t):
    return re.sub(r'[^a-z0-9 ]','',t.lower()).strip()

manifest = {'gutenberg': [], 'standard_ebooks': [], 'open_library': []}
for key in ['gutenberg','standard_ebooks']:
    folder = Path(f'epubs/{key}')
    if folder.exists():
        for f in folder.glob('*.epub'):
            title = f.stem
            manifest[key].append({'filename': f.name, 'title': title, 'path': str(f)})

ol_folder = Path('epubs/open_library')
if ol_folder.exists():
    for f in ol_folder.glob('*.url'):
        title = f.stem
        url = ''
        try:
            for line in f.read_text().splitlines():
                if line.startswith('URL='):
                    url = line[4:]
        except: pass
        manifest['open_library'].append({'filename': f.name, 'title': title, 'url': url})

with open('epubs/manifest.json','w') as f:
    json.dump(manifest, f, indent=2)
print(f"Manifest written: {sum(len(v) for v in manifest.values())} entries")
```

## File Structure

```
bibliophile.html                 ← main app
patrick_collison_bookshelf.csv   ← book data
get_epubs.py                     ← download free EPUBs
enrich_bookshelf.py              ← fetch Open Library metadata
generate_manifest.py             ← scan epubs → manifest.json
epubs/
  manifest.json                  ← generated, maps titles → files
  gutenberg/                     ← .epub files
  standard_ebooks/               ← .epub files
  open_library/                  ← .url shortcuts (borrow links)
```
