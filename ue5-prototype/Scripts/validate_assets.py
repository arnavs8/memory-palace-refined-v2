"""Verify the converted FBX files in a disposable background Blender scene."""
import bpy
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
rows = []
for source in sorted((root / 'AssetSources').glob('*.fbx')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    vertices = sum(len(o.data.vertices) for o in meshes)
    if not vertices or not all(o.dimensions.z > 0 for o in meshes):
        raise RuntimeError('Invalid converted mesh: ' + source.name)
    rows.append({'asset': source.stem, 'meshes': len(meshes), 'vertices': vertices,
                 'materials': sum(len(o.data.materials) for o in meshes)})
if len(rows) != 14:
    raise RuntimeError('Expected fourteen converted assets')
(root / 'Saved').mkdir(exist_ok=True)
(root / 'Saved' / 'asset-validation.json').write_text(json.dumps(rows, indent=2))
print(json.dumps({'fbx_validation': 'PASS', 'assets': len(rows), 'vertices': sum(r['vertices'] for r in rows)}), flush=True)
