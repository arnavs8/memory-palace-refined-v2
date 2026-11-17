"""Build a small, reproducible test room inside Unreal Editor. No AI calls."""
import unreal
from pathlib import Path

project = Path(unreal.Paths.project_dir()).resolve()
repo = project.parent
tools = unreal.AssetToolsHelpers.get_asset_tools()
editor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if not levels.new_level('/Game/Maps/StudyRoom'):
    raise RuntimeError('Unable to create StudyRoom map')

def material(name, colour, roughness=0.7, metallic=0.0):
    dest = '/Game/Materials/' + name
    mat = unreal.load_asset(dest)
    if not mat:
        mat = tools.create_asset(name, '/Game/Materials', unreal.Material, unreal.MaterialFactoryNew())
        base = unreal.MaterialEditingLibrary.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector)
        base.set_editor_property('constant', unreal.LinearColor(*colour))
        unreal.MaterialEditingLibrary.connect_material_property(base, '', unreal.MaterialProperty.MP_BASE_COLOR)
        for value, prop in [(roughness, unreal.MaterialProperty.MP_ROUGHNESS), (metallic, unreal.MaterialProperty.MP_METALLIC)]:
            node = unreal.MaterialEditingLibrary.create_material_expression(mat, unreal.MaterialExpressionConstant)
            node.set_editor_property('r', value)
            unreal.MaterialEditingLibrary.connect_material_property(node, '', prop)
        unreal.MaterialEditingLibrary.recompile_material(mat)
    return mat

plaster = material('WarmPlaster', (0.65, 0.59, 0.48, 1))
green = material('LibraryGreen', (0.035, 0.11, 0.075, 1))
wood = material('DarkWalnut', (0.12, 0.055, 0.025, 1), 0.45)
brass = material('Brass', (0.48, 0.29, 0.08, 1), 0.28, 0.75)
ceiling = material('Ceiling', (0.8, 0.77, 0.68, 1))
cube = unreal.load_asset('/Engine/BasicShapes/Cube.Cube')

def box(name, loc, dimensions, mat):
    actor = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*loc))
    actor.set_actor_label(name)
    actor.static_mesh_component.set_static_mesh(cube)
    actor.set_actor_scale3d(unreal.Vector(*(v / 100 for v in dimensions)))
    actor.static_mesh_component.set_material(0, mat)
    return actor

# Textured floor with a deliberately limited 2K texture budget.
floor_mat = material('Parquet', (0.3, 0.2, 0.1, 1), 0.65)
for suffix, prop in [('diff', unreal.MaterialProperty.MP_BASE_COLOR), ('rough', unreal.MaterialProperty.MP_ROUGHNESS)]:
    task = unreal.AssetImportTask()
    task.filename = str(repo / 'public/assets/textures' / ('herringbone_parquet_' + suffix + '.jpg'))
    task.destination_path = '/Game/Materials/Textures'; task.automated = True; task.save = True
    tools.import_asset_tasks([task])
    texture = unreal.load_asset(task.imported_object_paths[0])
    if suffix == 'rough':
        texture.set_editor_property('srgb', False)
    sampler = unreal.MaterialEditingLibrary.create_material_expression(floor_mat, unreal.MaterialExpressionTextureSample)
    sampler.set_editor_property('texture', texture)
    if suffix == 'rough':
        sampler.set_editor_property('sampler_type', unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    uv = unreal.MaterialEditingLibrary.create_material_expression(floor_mat, unreal.MaterialExpressionTextureCoordinate)
    uv.set_editor_property('u_tiling', 5.0); uv.set_editor_property('v_tiling', 4.0)
    unreal.MaterialEditingLibrary.connect_material_expressions(uv, '', sampler, 'Coordinates')
    unreal.MaterialEditingLibrary.connect_material_property(sampler, 'RGB' if suffix == 'diff' else 'R', prop)
unreal.MaterialEditingLibrary.recompile_material(floor_mat)

box('Parquet floor', (0,0,-12), (1220,1020,24), floor_mat)
box('Ceiling', (0,0,330), (1220,1020,20), ceiling)
for x in [-610,610]:
    box('Side wall', (x,0,160), (20,1020,320), plaster)
    box('Green panelling', (x*0.975,0,65), (12,1000,125), green)
    for y in range(-400,500,200):
        box('Panel stile', (x*0.96,y,65), (6,5,125), wood)
    box('Panel rail', (x*0.96,0,130), (8,1000,6), wood)
    box('Skirting', (x*0.96,0,9), (8,1000,18), wood)
    box('Crown moulding', (x*0.96,0,310), (12,1000,14), ceiling)
for x in [-345,345]:
    box('Entrance wall', (x,-510,160), (530,20,320), plaster)
box('Door lintel', (0,-510,290), (160,20,60), wood)
box('Entrance floor', (0,-620,-12), (180,220,24), floor_mat)
box('Window sill wall', (0,510,55), (1220,20,110), green)
box('Window top wall', (0,510,300), (1220,20,60), plaster)
for x in [-595,-200,200,595]:
    box('Window mullion', (x,510,190), (16,24,160), wood)
box('Window sill', (0,490,112), (1200,55,8), wood)
for y in [-350,0,350]:
    box('Ceiling beam', (0,y,312), (1200,18,18), wood)

def import_mesh(name):
    task = unreal.AssetImportTask(); task.filename = str(project / 'AssetSources' / (name + '.fbx'))
    task.destination_path = '/Game/Imported/' + name; task.destination_name = name
    task.automated = True; task.replace_existing = True; task.save = True
    options = unreal.FbxImportUI(); options.import_mesh = True; options.import_as_skeletal = False
    options.import_materials = True; options.import_textures = True
    options.mesh_type_to_import = unreal.FBXImportType.FBXIT_STATIC_MESH
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.generate_lightmap_u_vs = True
    options.static_mesh_import_data.auto_generate_collision = True
    task.options = options; tools.import_asset_tasks([task])
    meshes = [unreal.load_asset(p) for p in task.imported_object_paths if isinstance(unreal.load_asset(p), unreal.StaticMesh)]
    if not meshes:
        raise RuntimeError('Mesh import failed: ' + name)
    return meshes[0]

cache = {}
def prop(name, loc, height, yaw=0, station=None):
    mesh = cache.setdefault(name, None)
    if not mesh:
        mesh = import_mesh(name); cache[name] = mesh
    bounds = mesh.get_bounds(); scale = height / max(bounds.box_extent.z * 2, 0.01)
    actor = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*loc), unreal.Rotator(0,yaw,0))
    actor.set_actor_label(name)
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.set_actor_scale3d(unreal.Vector(scale,scale,scale))
    # Seat the bottom of the mesh on the specified surface.
    actor.set_actor_location(unreal.Vector(loc[0],loc[1],loc[2]-(bounds.origin.z-bounds.box_extent.z)*scale),False,False)
    if station is not None:
        marker = editor.spawn_actor_from_class(unreal.TargetPoint, unreal.Vector(*loc))
        marker.set_actor_label('MemoryStation' + str(station))
        marker.tags = [unreal.Name('MemoryStation' + str(station))]
    return actor

# Natural surfaces and asymmetrical landmarks, not a grid of display pedestals.
prop('wooden_bookshelf_worn',(-520,290,0),230,90,0)
prop('vintage_grandfather_clock_01',(440,350,0),215,180,1)
prop('potted_plant_01',(-430,-360,0),135,0,2)
prop('ClassicConsole_01',(480,-290,0),85,90)
prop('antique_ceramic_vase_01',(480,-290,85),42,0,3)
prop('wooden_table_02',(-340,-80,0),78,90)
prop('chess_set',(-340,-80,78),18,0,4)
prop('CoffeeTable_01',(210,150,0),48)
prop('book_encyclopedia_set_01',(210,150,48),22,0,5)
prop('Sofa_01',(410,100,0),90,90)
prop('ArmChair_01',(-100,310,0),105,180)
prop('ClassicConsole_01',(0,440,0),85)
prop('mantel_clock_01',(0,440,85),40,180,6)
prop('ornate_mirror_01',(-570,-220,130),110,90,7)
prop('Chandelier_01',(0,0,260),60)

sun = editor.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(0,0,700),unreal.Rotator(-35,-70,0))
sun.light_component.set_editor_property('intensity',3.0)
sun.light_component.set_editor_property('atmosphere_sun_light',True)
sun.light_component.set_editor_property('mobility',unreal.ComponentMobility.MOVABLE)
sky = editor.spawn_actor_from_class(unreal.SkyLight,unreal.Vector(0,0,450))
sky.light_component.set_editor_property('intensity',0.8)
sky.light_component.set_editor_property('mobility',unreal.ComponentMobility.MOVABLE)
sky.light_component.set_editor_property('sky_distance_threshold',100.0)
editor.spawn_actor_from_class(unreal.SkyAtmosphere,unreal.Vector(0,0,0))
for x,y in [(-300,100),(300,-100)]:
    lamp=editor.spawn_actor_from_class(unreal.PointLight,unreal.Vector(x,y,260))
    lamp.light_component.set_editor_property('intensity',1200.0)
    lamp.light_component.set_editor_property('attenuation_radius',850.0)
    lamp.light_component.set_editor_property('light_color',unreal.Color(255,220,175,255))
    lamp.light_component.set_editor_property('mobility',unreal.ComponentMobility.MOVABLE)
    lamp.light_component.set_editor_property('cast_shadows',False)
editor.spawn_actor_from_class(unreal.PlayerStart,unreal.Vector(0,-400,92),unreal.Rotator(0,90,0))
unreal.EditorAssetLibrary.save_directory('/Game',only_if_is_dirty=False,recursive=True)
levels.save_current_level()
unreal.log('Memory Palace study room generated with eight memory anchors.')
