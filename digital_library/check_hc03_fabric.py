"""Check where the fabric texture actually lives in hc03 and how it differs from hc01."""
from PIL import Image
import numpy as np

OUT = "C:/Users/lucyl/Desktop/cards/assets/textures/"

# Load both textures - they should be identical since same material
# But let's check difference
base01 = np.array(Image.open(OUT + "hardcover_01_Book_set_02_BaseColor.png"))
base03 = np.array(Image.open(OUT + "hardcover_03_Book_set_02_BaseColor.png"))

diff = np.abs(base01.astype(int) - base03.astype(int))
print(f"hc01 vs hc03 BaseColor diff: max={diff.max()} mean={diff.mean():.3f}")
if diff.max() == 0:
    print("  -> IDENTICAL textures")
else:
    print(f"  -> Different! Max diff pixel: {np.unravel_index(diff.sum(axis=2).argmax(), diff.shape[:2])}")

# Check UV mapping for hc03 specifically (may differ from hc01)
# Load hc03 normal texture
norm03 = Image.open(OUT + "hardcover_03_Book_set_02_Normal.png")
norm03_small = norm03.resize((512, 512))
norm03_small.save(OUT + "hc03_normal_preview.png")
print(f"\nhc03 normal map: {norm03.size} - saved preview")

# Crop specific non-cover regions of hc03 to find fabric
base03_img = Image.open(OUT + "hardcover_03_Book_set_02_BaseColor.png")
SIZE = 4096

regions = {
    "top_half": (0, 0, 4096, 2000),
    "left_third": (0, 2000, 1350, 4096),
    "right_third": (2750, 2000, 4096, 4096),
    "between_faces": (1350, 3000, 2750, 3133),  # gap between face1 and face2
    "above_faces": (1350, 0, 2750, 2150),
}

for name, (x0, y0, x1, y1) in regions.items():
    region = base03_img.crop((x0, y0, x1, y1))
    # Scale to max 400px
    scale = min(400/(x1-x0), 400/(y1-y0))
    w, h = max(1, int((x1-x0)*scale)), max(1, int((y1-y0)*scale))
    region.resize((w, h)).save(OUT + f"hc03_region2_{name}.png")
    arr = np.array(region)
    print(f"  {name} ({x1-x0}x{y1-y0}px): mean={arr.mean():.0f} std={arr.std():.1f}")
