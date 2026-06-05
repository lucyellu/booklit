"""Check which material is on which faces of the softcover model."""
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(
    filepath=r"C:\Users\lucyl\Desktop\cards\assets\models\softcover_01.glb"
)

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
mesh = obj.data

# Map material index -> name
mat_names = [s.material.name if s.material else '?' for s in obj.material_slots]
print("Materials:", mat_names)

# Group polygons by material, compute total area and average normal per material
from collections import defaultdict
import mathutils

mat_stats = defaultdict(lambda: {'area': 0, 'normals': []})

for poly in mesh.polygons:
    mat_name = mat_names[poly.material_index] if poly.material_index < len(mat_names) else '?'
    n = obj.matrix_world.to_3x3() @ poly.normal
    n.normalize()
    # per-polygon area
    verts = [obj.matrix_world @ mesh.vertices[i].co for i in poly.vertices]
    if len(verts) >= 3:
        e1 = verts[1] - verts[0]; e2 = verts[-1] - verts[0]
        area = e1.cross(e2).length / 2
        mat_stats[mat_name]['area'] += area
        mat_stats[mat_name]['normals'].append((n.x, n.y, n.z))

print("\nMaterial face stats:")
for mat, stats in mat_stats.items():
    normals = stats['normals']
    # average normal
    avg = [sum(n[i] for n in normals)/len(normals) for i in range(3)]
    # most common dominant axis
    from collections import Counter
    dominants = []
    for nx,ny,nz in normals:
        m = max(abs(nx), abs(ny), abs(nz))
        if abs(nx) == m: dominants.append('+X' if nx>0 else '-X')
        elif abs(ny) == m: dominants.append('+Y' if ny>0 else '-Y')
        else: dominants.append('+Z' if nz>0 else '-Z')
    dom_count = Counter(dominants).most_common(3)
    print(f"\n  {mat}: total_area={stats['area']:.4f}  poly_count={len(normals)}")
    print(f"    avg_normal: ({avg[0]:+.2f}, {avg[1]:+.2f}, {avg[2]:+.2f})")
    print(f"    dominant axes: {dom_count}")

# Also check: what does the bounding box look like if we try different rotations?
import math
print("\n\nBounding box under candidate rotations:")
verts_orig = [obj.matrix_world @ v.co for v in mesh.vertices]

def rotated_bbox(verts, rx, ry, rz):
    import mathutils
    mat = mathutils.Matrix.Rotation(rx, 4, 'X') @ \
          mathutils.Matrix.Rotation(ry, 4, 'Y') @ \
          mathutils.Matrix.Rotation(rz, 4, 'Z')
    rv = [mat @ v for v in verts]
    xs = [v.x for v in rv]; ys = [v.y for v in rv]; zs = [v.z for v in rv]
    return max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)

PI = math.pi
for rx, ry, rz, label in [
    (0, 0, 0, "original"),
    (-PI/2, 0, 0, "rx=-90"),
    (PI/2, 0, 0, "rx=+90"),
    (-PI/2, 0, PI/2, "rx=-90 rz=+90"),
    (-PI/2, 0, -PI/2, "rx=-90 rz=-90"),
    (PI/2, 0, PI/2, "rx=+90 rz=+90"),
    (0, 0, PI/2, "rz=+90"),
]:
    dx, dy, dz = rotated_bbox(verts_orig, rx, ry, rz)
    print(f"  {label:25s}  W={dx:.3f}  H={dy:.3f}  D={dz:.3f}  (want tall H, thin D)")
