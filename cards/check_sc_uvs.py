"""Get UV layout for each material of the softcover."""
import bpy, json

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(
    filepath=r"C:\Users\lucyl\Desktop\cards\assets\models\softcover_01.glb"
)

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
mesh = obj.data
mat_names = [s.material.name if s.material else '?' for s in obj.material_slots]
uv_layer = mesh.uv_layers[0].data

from collections import defaultdict

mat_uvs = defaultdict(list)

for poly in mesh.polygons:
    mat = mat_names[poly.material_index]
    # world normal
    n = obj.matrix_world.to_3x3() @ poly.normal
    n.normalize()
    dom = max([('X',abs(n.x)), ('Y',abs(n.y)), ('Z',abs(n.z))], key=lambda x:x[1])
    axis = ('+' if (n.x if dom[0]=='X' else n.y if dom[0]=='Y' else n.z) > 0 else '-') + dom[0]
    uvs = [list(uv_layer[li].uv) for li in poly.loop_indices]
    mat_uvs[mat].append({'normal': axis, 'uvs': uvs})

# For each material, find UV bounds per dominant normal direction
print("=== Softcover UV layout per material/face direction ===\n")
for mat, polys in mat_uvs.items():
    print(f"Material: {mat}  ({len(polys)} polys)")
    by_normal = defaultdict(list)
    for p in polys:
        by_normal[p['normal']].extend(p['uvs'])
    for normal, uvs in sorted(by_normal.items()):
        us = [u[0] for u in uvs]; vs = [u[1] for u in uvs]
        print(f"  Normal {normal}: U[{min(us):.3f}-{max(us):.3f}] V[{min(vs):.3f}-{max(vs):.3f}]  ({len(uvs)//len(polys[0]['uvs'])+1} polys)")
    print()

# For the 'front' material (faces +Z), find UV bounds
print("\n=== Cover material UV for the -X face (front cover exterior) ===")
cover_x_polys = [p for p in mat_uvs['cover'] if p['normal'] == '-X']
if cover_x_polys:
    all_uvs = [uv for p in cover_x_polys for uv in p['uvs']]
    us = [u[0] for u in all_uvs]; vs = [u[1] for u in all_uvs]
    print(f"  UV bounds: U[{min(us):.3f}-{max(us):.3f}] V[{min(vs):.3f}-{max(vs):.3f}]")
    print(f"  Poly count: {len(cover_x_polys)}")
