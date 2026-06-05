"""
Extract UV layouts + embedded textures from hardcover/softcover GLBs.
Run with: blender --background --python extract_uvs.py
"""
import bpy, sys, os, json

OUT = r"C:\Users\lucyl\Desktop\cards\assets\textures"
os.makedirs(OUT, exist_ok=True)

MODELS = {
    "hardcover_01": r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_01.glb",
    "hardcover_02": r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_02.glb",
    "hardcover_03": r"C:\Users\lucyl\Desktop\cards\assets\models\hardcover_03.glb",
    "softcover_01": r"C:\Users\lucyl\Desktop\cards\assets\models\softcover_01.glb",
}

info = {}

for name, path in MODELS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    print(f"\n=== {name} ===  meshes: {len(meshes)}")
    info[name] = {"meshes": [], "images": []}

    for obj in meshes:
        mesh = obj.data
        uvs = [uv.name for uv in mesh.uv_layers]
        mats = [s.material.name if s.material else None for s in obj.material_slots]
        print(f"  mesh: {obj.name}  uvs: {uvs}  materials: {mats}")
        info[name]["meshes"].append({"name": obj.name, "uvs": uvs, "materials": mats})

        # Export UV layout using UV editor
        if mesh.uv_layers:
            # Select this object
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj

            # Switch to edit mode, select all
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.object.mode_set(mode='OBJECT')

            # Export UV layout
            uv_out = os.path.join(OUT, f"{name}_uv.png")
            bpy.ops.uv.export_layout(
                filepath=uv_out,
                export_all=True,
                modified=False,
                mode='PNG',
                size=(1024, 1024),
                opacity=0.25,
                check_existing=False
            )
            print(f"  UV layout -> {uv_out}")

    # Export all embedded images
    for img in bpy.data.images:
        if img.name in ('Render Result', 'Viewer Node'):
            continue
        img_out = os.path.join(OUT, f"{name}_{img.name.replace('/', '_').replace(' ', '_')}.png")
        img.filepath_raw = img_out
        img.file_format = 'PNG'
        try:
            img.save()
            print(f"  image: {img.name} -> {img_out}")
            info[name]["images"].append({"name": img.name, "path": img_out,
                                          "size": list(img.size)})
        except Exception as e:
            print(f"  image FAILED: {img.name} — {e}")

with open(os.path.join(OUT, "model_info.json"), "w") as f:
    json.dump(info, f, indent=2)
print("\nDone. Info written to model_info.json")
