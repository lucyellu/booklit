"""
Read UV coordinates from hardcover GLB and dump to JSON.
Draw UV layout image with PIL (no GPU needed).
Run: blender --background --python read_uvs.py
"""
import bpy, json, os
from collections import defaultdict

OUT = r"C:\Users\lucyl\Desktop\cards\assets\textures"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_01.glb")

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
mesh = obj.data
uv_layer = mesh.uv_layers[0].data

# Collect all UV polygons (each polygon has its loop UVs)
polys = []
for poly in mesh.polygons:
    uvs = []
    for li in poly.loop_indices:
        uv = uv_layer[li].uv
        uvs.append([uv.x, uv.y])
    polys.append(uvs)

# Find bounding regions to identify UV islands
# Compute min/max per polygon center to find clusters
import math

def poly_center(uvs):
    cx = sum(u[0] for u in uvs) / len(uvs)
    cy = sum(u[1] for u in uvs) / len(uvs)
    return cx, cy

centers = [poly_center(p) for p in polys]
all_u = [c[0] for c in centers]
all_v = [c[1] for c in centers]

print(f"UV center range: U=[{min(all_u):.3f}, {max(all_u):.3f}] V=[{min(all_v):.3f}, {max(all_v):.3f}]")
print(f"Total polygons: {len(polys)}")

# Dump UV data as JSON for PIL drawing
uv_data = {"polygons": polys, "poly_count": len(polys)}
json_path = os.path.join(OUT, "hardcover_uvs.json")
with open(json_path, 'w') as f:
    json.dump(uv_data, f)
print(f"UV data -> {json_path}")

# Also cluster polygons by U center to find major UV islands
# Sort by U coordinate to see if there are clear clusters
u_vals = sorted(all_u)
print("\nU distribution (first 20 poly centers):", [f"{u:.2f}" for u in u_vals[:20]])
print("U distribution (last 20 poly centers):", [f"{u:.2f}" for u in u_vals[-20:]])

# Group by rough U buckets
buckets = defaultdict(int)
for u in all_u:
    bucket = round(u * 10) / 10  # 0.1 resolution
    buckets[bucket] += 1
print("\nU center histogram:")
for k in sorted(buckets):
    print(f"  U~{k:.1f}: {buckets[k]} polys")
