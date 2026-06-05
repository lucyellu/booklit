"""Draw UV layout from JSON data using PIL."""
import json
from PIL import Image, ImageDraw

with open(r"C:\Users\lucyl\Desktop\cards\assets\textures\hardcover_uvs.json") as f:
    data = json.load(f)

SIZE = 1024
img = Image.new('RGB', (SIZE, SIZE), (30, 20, 10))
draw = ImageDraw.Draw(img)

for poly in data['polygons']:
    pts = [(u * SIZE, (1 - v) * SIZE) for u, v in poly]
    if len(pts) >= 3:
        draw.polygon(pts, outline=(255, 200, 80), fill=(60, 40, 20))

img.save(r"C:\Users\lucyl\Desktop\cards\assets\textures\hardcover_uv_layout.png")
print("Saved UV layout")

# Also analyze the existing BaseColor texture - sample colors in grid
base = Image.open(r"C:\Users\lucyl\Desktop\cards\assets\textures\hardcover_01_Book_set_02_BaseColor.png")
base_small = base.resize((512, 512))
base_small.save(r"C:\Users\lucyl\Desktop\cards\assets\textures\hardcover_01_BaseColor_preview.png")
print(f"BaseColor preview saved: {base.size}")

# Sample some key pixels to understand layout
w, h = base.size
samples = {}
for y_pct in [0.1, 0.3, 0.5, 0.7, 0.9]:
    for x_pct in [0.05, 0.15, 0.25, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]:
        x, y = int(x_pct * w), int(y_pct * h)
        r, g, b = base.getpixel((x, y))
        samples[f"{x_pct:.2f},{y_pct:.2f}"] = f"#{r:02x}{g:02x}{b:02x}"

print("\nBaseColor pixel samples (x%, y%):")
for k, v in samples.items():
    print(f"  {k}: {v}")
