"""
Analyze UV islands precisely and extract the linen/fabric texture from hardcover_03.
"""
import json
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

# ── Analyze UV islands ──────────────────────────────────────────────────────
with open(r"C:\Users\lucyl\Desktop\cards\assets\textures\hardcover_uvs.json") as f:
    data = json.load(f)

SIZE = 4096  # full texture size
polys = data['polygons']

# Find bounding boxes of UV regions by polygon area
# Large polygons = cover faces; small = edges

def poly_area(pts):
    n = len(pts)
    area = 0
    for i in range(n):
        j = (i+1) % n
        area += pts[i][0] * pts[j][1]
        area -= pts[j][0] * pts[i][1]
    return abs(area) / 2

def poly_bounds(pts):
    us = [p[0] for p in pts]
    vs = [p[1] for p in pts]
    return min(us), min(vs), max(us), max(vs)

# Sort polys by area
sized = [(poly_area(p), p) for p in polys]
sized.sort(reverse=True)

print("Top 20 largest UV polygons:")
for area, pts in sized[:20]:
    u0, v0, u1, v1 = poly_bounds(pts)
    cx = (u0+u1)/2; cy = (v0+v1)/2
    print(f"  area={area:.4f}  U:[{u0:.3f}-{u1:.3f}] V:[{v0:.3f}-{v1:.3f}]  center=({cx:.3f},{cy:.3f})")

# Identify main cover islands by looking at large polygons in clusters
print("\nAll poly centers grouped into clusters (large polys only):")
large = [(poly_area(p), p) for p in polys if poly_area(p) > 0.005]
print(f"  {len(large)} large polygons")

# Draw UV layout with color coding by polygon size
img = Image.new('RGB', (SIZE, SIZE), (30, 20, 10))
draw = ImageDraw.Draw(img)

for area, poly in sized:
    pts = [(u * SIZE, (1 - v) * SIZE) for u, v in poly]
    if area > 0.03:
        fill = (80, 50, 20)
        outline = (255, 160, 20)
    elif area > 0.005:
        fill = (20, 50, 80)
        outline = (80, 200, 255)
    else:
        fill = (40, 40, 40)
        outline = (100, 100, 100)
    if len(pts) >= 3:
        draw.polygon(pts, fill=fill, outline=outline)

# Overlay text labels
from PIL import ImageFont
for area, poly in sized[:6]:
    u0, v0, u1, v1 = poly_bounds(poly)
    cx = int((u0+u1)/2 * SIZE)
    cy = int((1-(v0+v1)/2) * SIZE)
    label = f"A={area:.3f}\nU[{u0:.2f}-{u1:.2f}]\nV[{v0:.2f}-{v1:.2f}]"
    draw.text((cx-60, cy-30), label, fill=(255,255,100))

img_small = img.resize((1024,1024))
img_small.save(r"C:\Users\lucyl\Desktop\cards\assets\textures\uv_islands_annotated.png")
print("\nSaved annotated UV layout")

# ── Extract & clean linen texture from hardcover_03 ─────────────────────────
print("\n=== Extracting fabric texture from hardcover_03 ===")
base = Image.open(r"C:\Users\lucyl\Desktop\cards\assets\textures\hardcover_03_Book_set_02_BaseColor.png")
base_arr = np.array(base)

# The BaseColor texture has the fabric/linen pattern but also printed text
# We'll find and extract just the fabric region (large cover area)
# Based on looking at the texture, the fabric is mainly in the cover areas
# Sample a few regions to find clean fabric

# Save a labeled version showing where we'll sample for clean fabric
print(f"hardcover_03 BaseColor size: {base.size}")

# The fabric texture should be in the large cover areas (same UV layout)
# From the UV analysis, cover face is roughly:
# Looking at the UV map: the bottom-left quadrant has the cover
# UV island for front cover: ~U[0.0-0.33] V[0.0-0.5] → pixel X[0-1350] Y[2048-4096]

# Sample fabric texture - crop a clean region from the cover areas
# Try several regions and check contrast/fabric pattern
regions_to_check = {
    "front_cover_full": (0, 2048, 1350, 4096),
    "back_cover_region": (1365, 2048, 2730, 4096),
    "mid_cover": (400, 2400, 1000, 3600),
}

for name, (x0, y0, x1, y1) in regions_to_check.items():
    region = base.crop((x0, y0, x1, y1))
    region_small = region.resize((512, min(512, int(512*(y1-y0)/(x1-x0)))))
    region_small.save(f"C:/Users/lucyl/Desktop/cards/assets/textures/hc03_region_{name}.png")
    arr = np.array(region)
    print(f"  {name}: mean={arr.mean():.1f} std={arr.std():.1f}")

print("\nDone - check hc03_region_*.png files to find clean fabric area")
