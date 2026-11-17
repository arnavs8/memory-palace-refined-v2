"""Run in a separate background Blender process, never in the user's open scene."""
import bpy
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
output = root / 'ue5-prototype' / 'AssetSources'
output.mkdir(exist_ok=True)
models = ['wooden_bookshelf_worn', 'mantel_clock_01', 'potted_plant_01',
          'chess_set', 'antique_ceramic_vase_01', 'book_encyclopedia_set_01',
          'ornate_mirror_01', 'vintage_grandfather_clock_01',
          'wooden_table_02', 'ArmChair_01', 'Sofa_01', 'CoffeeTable_01',
          'ClassicConsole_01', 'Chandelier_01']
for name in models:
    target = output / (name + '.fbx')
    if target.exists():
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root / 'public' / 'assets' / 'models' / name / 'model.gltf'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise RuntimeError('No mesh in ' + name)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    bpy.context.object.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.export_scene.fbx(filepath=str(target), use_selection=True,
                             object_types={'MESH'}, add_leaf_bones=False,
                             axis_forward='-Y', axis_up='Z', path_mode='COPY',
                             embed_textures=True)
    print('Prepared ' + name, flush=True)
(output / 'sources.json').write_text(json.dumps([
    {'asset': name, 'license': 'CC0-1.0', 'source': 'https://polyhaven.com/a/' + name}
    for name in models], indent=2))
