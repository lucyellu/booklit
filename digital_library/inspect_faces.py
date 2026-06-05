"""Crop exact UV island regions from hc01 BaseColor to verify cover face positions,
then extract clean fabric from hc03."""
from PIL import Image, ImageFilter, ImageChops
import numpy as np

OUT = "C:/Users/lucyl/Desktop/cards/assets/textures/"
SIZE = 4096

# UV islands from analysis (U_min, U_max, V_min, V_max)
# V in UV space (0=bottom, 1=top), so Pixel_Y = (1-V)*SIZE
ISLANDS = {
    "face1": (0.339, 0.670, 0.244, 0.475),   # main face top
    "face2": (0.339, 0.670, 0.005, 0.235),   # main face bottom
    "strip_right": (0.669, 0.995, 0.964, 0.981),  # right edge strip
    "strip_center": (0.328, 0.663, 0.966, 0.979),  # center strip (spine?)
    "strip_left": (0.003, 0.232, 0.964, 0.980),    # left edge strip
    "side1": (0.014, 0.242, 0.389, 0.406),  # small side panel
}

base01 = Image.open(OUT + "hardcover_01_Book_set_02_BaseColor.png")
base03 = Image.open(OUT + "hardcover_03_Book_set_02_BaseColor.png")

def crop_island(img, u0, u1, v0, v1, name):
    x0 = int(u0 * SIZE); x1 = int(u1 * SIZE)
    y0 = int((1-v1) * SIZE); y1 = int((1-v0) * SIZE)
    crop = img.crop((x0, y0, x1, y1))
    scale = min(512/(x1-x0), 512/(y1-y0), 1.0)
    preview = crop.resize((int((x1-x0)*scale), int((y1-y0)*scale)), Image.LANCZOS)
    path = OUT + f"crop_{name}.png"
    preview.save(path)
    print(f"  {name}: pixels ({x0},{y0})-({x1},{y1}) size {x1-x0}x{y1-y0}px")
    return crop

print("=== hc01 UV island crops ===")
for name, (u0, u1, v0, v1) in ISLANDS.items():
    crop_island(base01, u0, u1, v0, v1, f"hc01_{name}")

# ── Extract fabric texture from hc03 ─────────────────────────────────────────
print("\n=== hc03 fabric extraction ===")
# Crop the main cover face from hc03 - this has the fabric texture with printed text
face1 = crop_island(base03, 0.339, 0.670, 0.244, 0.475, "hc03_face1_raw")
face2 = crop_island(base03, 0.339, 0.670, 0.005, 0.235, "hc03_face2_raw")

# For inpainting: detect text by finding high-contrast dark pixels on a lighter fabric bg
# The fabric is a relatively uniform texture; text appears as very dark spots
face1_arr = np.array(face1).astype(float)
face2_arr = np.array(face2).astype(float)

def remove_text_simple(arr, name):
    """Remove dark text by detecting pixels much darker than local neighborhood."""
    from PIL import ImageFilter
    img = Image.fromarray(arr.astype(np.uint8))

    # Blur to get local average (the "fabric" level)
    blurred = img.filter(ImageFilter.GaussianBlur(radius=15))
    blurred_arr = np.array(blurred).astype(float)

    # Text pixels are significantly darker than local average
    diff = blurred_arr - arr  # positive where pixel is darker than local avg
    text_mask = diff.max(axis=2) > 40  # dark relative to neighborhood

    # Replace text pixels with blurred (fabric) version
    result = arr.copy()
    result[text_mask] = blurred_arr[text_mask]

    # One more gentle blur pass to smooth the replacements
    result_img = Image.fromarray(result.astype(np.uint8))
    result_img = result_img.filter(ImageFilter.GaussianBlur(radius=2))
    result_arr = np.array(result_img).astype(float)
    result_arr[~text_mask] = arr[~text_mask]  # preserve clean fabric

    out_img = Image.fromarray(result_arr.astype(np.uint8))
    out_img.save(OUT + f"hc03_fabric_{name}_cleaned.png")
    print(f"  Cleaned {name}: text pixels replaced = {text_mask.sum()}")
    return out_img

print("\nCleaning text from hc03 faces:")
clean1 = remove_text_simple(face1_arr, "face1")
clean2 = remove_text_simple(face2_arr, "face2")

# Also save the full BaseColor of hc03 at smaller size for inspection
base03.resize((1024, 1024)).save(OUT + "hc03_BaseColor_1024.png")
print("\nSaved hc03_BaseColor_1024.png for inspection")
