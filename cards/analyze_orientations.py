"""
Analyze actual geometry orientation of book models in Three.js/GLTF space.
Reports bounding box, centroid, and face normals for the largest faces.
"""
import bpy, math, json

def analyze_model(name, path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    print(f"\n{'='*60}")
    print(f"MODEL: {name}")
    print(f"  Mesh count: {len(meshes)}")

    for obj in meshes:
        mesh = obj.data
        verts = [obj.matrix_world @ v.co for v in mesh.vertices]

        xs = [v.x for v in verts]; ys = [v.y for v in verts]; zs = [v.z for v in verts]
        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
        zmin, zmax = min(zs), max(zs)

        cx = (xmin+xmax)/2; cy = (ymin+ymax)/2; cz = (zmin+zmax)/2
        dx = xmax-xmin; dy = ymax-ymin; dz = zmax-zmin

        print(f"\n  Mesh: {obj.name}")
        print(f"    Bounding box: X[{xmin:.3f} to {xmax:.3f}] dx={dx:.3f}")
        print(f"                  Y[{ymin:.3f} to {ymax:.3f}] dy={dy:.3f}")
        print(f"                  Z[{zmin:.3f} to {zmax:.3f}] dz={dz:.3f}")
        print(f"    Centroid: ({cx:.3f}, {cy:.3f}, {cz:.3f})")
        print(f"    Origin (obj.location): ({obj.location.x:.3f}, {obj.location.y:.3f}, {obj.location.z:.3f})")

        # Find the 5 largest faces and their normals (in world space)
        face_data = []
        for poly in mesh.polygons:
            # compute area
            vcs = [obj.matrix_world @ mesh.vertices[i].co for i in poly.vertices]
            # approximate area via cross product of diagonals
            if len(vcs) >= 3:
                e1 = vcs[1] - vcs[0]
                e2 = vcs[-1] - vcs[0]
                area = e1.cross(e2).length / 2
                # world normal
                n = obj.matrix_world.to_3x3() @ poly.normal
                n.normalize()
                face_data.append((area, n.x, n.y, n.z))

        face_data.sort(reverse=True)
        print(f"\n    Top 8 faces by area (normal direction):")
        seen_normals = []
        shown = 0
        for area, nx, ny, nz in face_data:
            # deduplicate very similar normals
            dup = False
            for sn in seen_normals:
                if abs(sn[0]-nx) < 0.1 and abs(sn[1]-ny) < 0.1 and abs(sn[2]-nz) < 0.1:
                    dup = True; break
            if not dup:
                seen_normals.append((nx, ny, nz))
                # determine dominant axis
                maxn = max(abs(nx), abs(ny), abs(nz))
                if abs(nx) == maxn: axis = f"+X" if nx > 0 else "-X"
                elif abs(ny) == maxn: axis = f"+Y" if ny > 0 else "-Y"
                else: axis = f"+Z" if nz > 0 else "-Z"
                print(f"      area={area:.4f}  normal=({nx:+.2f}, {ny:+.2f}, {nz:+.2f})  dominant: {axis}")
                shown += 1
                if shown >= 8: break

        # Materials
        mats = [s.material.name if s.material else None for s in obj.material_slots]
        print(f"\n    Materials: {mats}")

MODELS = {
    "softcover_01": r"C:\Users\lucyl\Desktop\cards\assets\models\softcover_01.glb",
    "hardcover_01": r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_01.glb",
    "hardcover_02": r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_02.glb",
    "hardcover_03": r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_03.glb",
}

for name, path in MODELS.items():
    analyze_model(name, path)
