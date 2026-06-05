"""
Extract embedded images from GLB files (pure Python, no Blender needed).
Then read UV coordinates via Blender to draw UV layouts with PIL.

Usage: python extract_textures.py
"""
import struct, json, os
from PIL import Image, ImageDraw
import io

OUT = r"C:\Users\lucyl\Desktop\cards\assets\textures"
os.makedirs(OUT, exist_ok=True)

MODELS_DIR = r"C:\Users\lucyl\Desktop\cards\assets\models"

def extract_glb_images(glb_path, prefix):
    """Parse GLB binary format and extract all embedded images."""
    with open(glb_path, 'rb') as f:
        data = f.read()

    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, "Not a GLB file"

    # JSON chunk
    json_len, json_type = struct.unpack_from('<II', data, 12)
    assert json_type == 0x4E4F534A, "Expected JSON chunk"
    gltf = json.loads(data[20:20+json_len])

    # Binary chunk
    bin_offset = 20 + json_len
    bin_len, bin_type = struct.unpack_from('<II', data, bin_offset)
    bin_data = data[bin_offset+8 : bin_offset+8+bin_len]

    images_info = []
    for i, img in enumerate(gltf.get('images', [])):
        name = img.get('name', f'image_{i}')
        bv_idx = img.get('bufferView')
        mime = img.get('mimeType', 'image/png')
        ext = 'jpg' if 'jpeg' in mime or 'jpg' in mime else 'png'

        if bv_idx is not None:
            bv = gltf['bufferViews'][bv_idx]
            offset = bv.get('byteOffset', 0)
            length = bv['byteLength']
            img_bytes = bin_data[offset:offset+length]

            out_path = os.path.join(OUT, f"{prefix}_{name.replace('/', '_')}.{ext}")
            with open(out_path, 'wb') as f:
                f.write(img_bytes)

            pil_img = Image.open(io.BytesIO(img_bytes))
            print(f"  [{i}] {name}: {pil_img.size} {pil_img.mode} -> {out_path}")
            images_info.append({
                'name': name, 'size': pil_img.size, 'path': out_path, 'ext': ext
            })

    # Also dump texture/material mapping
    print(f"  Materials:")
    for mat in gltf.get('materials', []):
        pbr = mat.get('pbrMetallicRoughness', {})
        base_tex = pbr.get('baseColorTexture', {})
        normal_tex = mat.get('normalTexture', {})
        rough_tex = pbr.get('metallicRoughnessTexture', {})
        print(f"    {mat['name']}: base={base_tex.get('index','—')} normal={normal_tex.get('index','—')} roughness={rough_tex.get('index','—')}")

    return gltf, bin_data, images_info


print("=== Extracting embedded textures from GLB files ===\n")

for model in ['hardcover_01', 'hardcover_02', 'hardcover_03', 'softcover_01']:
    path = os.path.join(MODELS_DIR, f"{model}.glb")
    print(f"\n--- {model} ---")
    gltf, bin_data, images = extract_glb_images(path, model)

print("\nDone — textures saved to assets/textures/")
