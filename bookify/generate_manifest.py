"""
generate_manifest.py
Run once after get_epubs.py to map local EPUB files to book titles.
Usage: python generate_manifest.py
"""
import json, re
from pathlib import Path

def norm(t):
    return re.sub(r'[^a-z0-9 ]', '', t.lower()).strip()

manifest = {'gutenberg': [], 'standard_ebooks': [], 'open_library': []}

for key in ['gutenberg', 'standard_ebooks']:
    folder = Path(f'epubs/{key}')
    if not folder.exists():
        print(f"  Skipping {folder} (not found)")
        continue
    for f in sorted(folder.glob('*.epub')):
        title = f.stem
        manifest[key].append({'filename': f.name, 'title': title, 'path': f'epubs/{key}/{f.name}'})
    print(f"  {key}: {len(manifest[key])} EPUBs found")

ol_folder = Path('epubs/open_library')
if ol_folder.exists():
    for f in sorted(ol_folder.glob('*.url')):
        title = f.stem
        url = ''
        try:
            for line in f.read_text(encoding='utf-8').splitlines():
                if line.startswith('URL='):
                    url = line[4:].strip()
        except Exception:
            pass
        manifest['open_library'].append({'filename': f.name, 'title': title, 'url': url})
    print(f"  open_library: {len(manifest['open_library'])} borrow links found")

out = Path('epubs/manifest.json')
out.parent.mkdir(exist_ok=True)
with open(out, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

total = sum(len(v) for v in manifest.values())
print(f"\nWritten to {out}")
print(f"Total entries: {total}")
