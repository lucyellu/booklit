"""Extract clean linen fabric texture from the unused UV space in the BaseColor."""
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

OUT = "C:/Users/lucyl/Desktop/cards/assets/textures/"
SIZE = 4096

base = Image.open(OUT + "hardcover_01_Book_set_02_BaseColor.png")

# The clean linen region is in the lower-right of the texture
# (not mapped to any UV island = unused space, just the raw fabric photo)
# X[2750-4096], Y[3200-4096] - bottom of right third, avoiding the text at top
linen_raw = base.crop((2750, 3200, 4096, 4096))
print(f"Raw linen crop: {linen_raw.size}")

# Check it
arr = np.array(linen_raw)
print(f"  mean={arr.mean():.1f}  std={arr.std():.1f}")

# Save raw crop preview
linen_raw.resize((400, 300)).save(OUT + "linen_raw_preview.png")

# ── Create clean tileable linen texture ─────────────────────────────────────
# There may be some text at very top - let's also check Y 3500-4096 to be safe
linen_clean = base.crop((2750, 3500, 4096, 4096))
linen_clean_arr = np.array(linen_clean)
print(f"\nCleaner crop (Y 3500-4096): mean={linen_clean_arr.mean():.1f}  std={linen_clean_arr.std():.1f}")
linen_clean.resize((400, 200)).save(OUT + "linen_clean_preview.png")

# Make it tileable by mirroring (removes edge seams)
# Crop a square from the cleanest area, then tile-optimize
# Use a 1024x1024 square from the clean area
linen_sq = base.crop((2800, 3600, 3800, 4096))  # 1000x496 clean region
# Scale to 512x256 for now
linen_sm = linen_sq.resize((512, 256), Image.LANCZOS)

# Make tileable: create a 512x512 by flipping and stacking
linen_flipped = linen_sm.transpose(Image.FLIP_TOP_BOTTOM)
import numpy as np
from PIL import Image

# Create seamless tile by blending edges
arr1 = np.array(linen_sm, dtype=float)
arr2 = np.array(linen_flipped, dtype=float)

# Stack vertically for 512x512
stacked = np.vstack([arr1, arr2])
linen_tile = Image.fromarray(stacked.astype(np.uint8))
linen_tile = linen_tile.filter(ImageFilter.GaussianBlur(0.5))

# Enhance contrast slightly to make the weave more visible
linen_tile = ImageEnhance.Contrast(linen_tile).enhance(1.3)

linen_tile.save(OUT + "linen_tile_512.png")
print(f"\nSaved tileable linen: {linen_tile.size}")

# Also make a higher-res version (1024x1024) for better quality
linen_hr_raw = base.crop((2800, 3200, 4096, 4096))  # 1296x896
# Scale to 1024x512
linen_hr = linen_hr_raw.resize((1024, 512), Image.LANCZOS)
linen_hr_flipped = linen_hr.transpose(Image.FLIP_TOP_BOTTOM)
arr_hr1 = np.array(linen_hr, dtype=float)
arr_hr2 = np.array(linen_hr_flipped, dtype=float)
stacked_hr = np.vstack([arr_hr1, arr_hr2])
linen_1024 = Image.fromarray(stacked_hr.astype(np.uint8))
linen_1024 = ImageEnhance.Contrast(linen_1024).enhance(1.3)
linen_1024.save(OUT + "linen_tile_1024.png")
print(f"Saved linen_tile_1024.png: {linen_1024.size}")

# ── Also generate a normal map version from the linen ────────────────────────
# Convert to grayscale height map, then compute normals
gray = np.array(linen_1024.convert('L'), dtype=float) / 255.0

# Simple Sobel-like normal map generation
dx = np.zeros_like(gray)
dy = np.zeros_like(gray)
dx[:, 1:-1] = (gray[:, 2:] - gray[:, :-2]) * 0.5
dy[1:-1, :] = (gray[2:, :] - gray[:-2, :]) * 0.5

strength = 3.0
normal = np.zeros((*gray.shape, 3))
normal[:,:,0] = -dx * strength  # R = X
normal[:,:,1] = -dy * strength  # G = Y
normal[:,:,2] = 1.0              # B = Z

# Normalize
mag = np.sqrt((normal**2).sum(axis=2, keepdims=True))
normal /= mag

# Remap to [0,255]
normal_img = ((normal * 0.5 + 0.5) * 255).astype(np.uint8)
Image.fromarray(normal_img).save(OUT + "linen_normal_1024.png")
print("Saved linen_normal_1024.png")
