"""Parallax characters: one shared humanoid rig, two skins (Ayanda, glass advisor), clips baked as actions.

Run headless:  blender --background --python assets/blender/build_characters.py -- <out_dir> [--preview]
Authored for Blender 4.x. Everything is built from primitives with rigid skin weights, so the result is reproducible.
Ayanda is a fictional demo founder; the models are stylised, not photoreal, and not a real person's likeness.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.getcwd(), 'web', 'public', 'models')
PREVIEW = '--preview' in argv
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgba, rough=0.5, metal=0.0, alpha=1.0, transmission=0.0, emit=None, emit_strength=0.0, ior=1.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgba
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Alpha'].default_value = alpha
    for k in ('Transmission Weight', 'Transmission'):
        if k in b.inputs:
            b.inputs[k].default_value = transmission
            break
    if emit is not None:
        for k in ('Emission Color', 'Emission'):
            if k in b.inputs:
                b.inputs[k].default_value = emit
                break
        if 'Emission Strength' in b.inputs:
            b.inputs['Emission Strength'].default_value = emit_strength
    if 'IOR' in b.inputs:
        b.inputs['IOR'].default_value = ior
    if alpha < 1.0:
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            m.blend_method = 'BLEND'
    return m


# ------------------------------------------------------------------ rig
BONES = [
    # name, head, tail, parent
    ('root', (0, 0, 0), (0, 0, 0.1), None),
    ('hips', (0, 0, 0.95), (0, 0, 1.05), 'root'),
    ('spine', (0, 0, 1.05), (0, 0, 1.3), 'hips'),
    ('chest', (0, 0, 1.3), (0, 0, 1.55), 'spine'),
    ('neck', (0, 0, 1.55), (0, 0, 1.68), 'chest'),
    ('head', (0, 0, 1.68), (0, 0, 1.98), 'neck'),
    ('jaw', (0, -0.1, 1.76), (0, -0.2, 1.76), 'head'),
]
for side, x in (('R', -0.28), ('L', 0.28)):
    BONES += [
        (f'upper.{side}', (x, 0, 1.5), (x, 0, 1.2), 'chest'),
        (f'fore.{side}', (x, 0, 1.2), (x, 0, 0.92), f'upper.{side}'),
        (f'hand.{side}', (x, 0, 0.92), (x, 0, 0.78), f'fore.{side}'),
    ]
for side, x in (('R', -0.12), ('L', 0.12)):
    BONES += [
        (f'thigh.{side}', (x, 0, 0.95), (x, 0, 0.5), 'hips'),
        (f'shin.{side}', (x, 0, 0.5), (x, 0, 0.08), f'thigh.{side}'),
        (f'foot.{side}', (x, 0, 0.08), (x, -0.2, 0.04), f'shin.{side}'),
    ]


def build_rig():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = 'Rig'
    amt = arm.data
    amt.name = 'RigData'
    for b in list(amt.edit_bones):
        amt.edit_bones.remove(b)
    for name, head, tail, parent in BONES:
        eb = amt.edit_bones.new(name)
        eb.head = head
        eb.tail = tail
        if parent:
            eb.parent = amt.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


# ------------------------------------------------------------------ parts
PARTS = []


def part(obj, bone, mat):
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    obj.select_set(False)
    PARTS.append(obj)
    return obj


def sphere(loc, r, scale=(1, 1, 1), seg=18):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=max(8, seg // 2))
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return o


def cyl(loc, r, depth, scale=(1, 1, 1), seg=14):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=seg)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return o


def box(loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return o


def torus(loc, major, minor, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=major, minor_radius=minor, major_segments=32, minor_segments=10, rotation=rot)
    return bpy.context.object


def build_skin(kind):
    """kind: 'ayanda' or 'advisor'. Returns the joined skinned mesh."""
    PARTS.clear()
    if kind == 'ayanda':
        skin = material('Skin', (0.36, 0.2, 0.14, 1), rough=0.55)
        top = material('Top', (0.62, 0.52, 0.88, 1), rough=0.6)
        apron = material('Apron', (0.98, 0.95, 0.88, 1), rough=0.7)
        trousers = material('Trousers', (0.76, 0.7, 0.6, 1), rough=0.7)
        shoes = material('Shoes', (0.97, 0.97, 0.98, 1), rough=0.4)
        hair = material('Hair', (0.08, 0.05, 0.04, 1), rough=0.8)
        gold = material('Gold', (0.9, 0.72, 0.28, 1), rough=0.25, metal=1.0)
        dark = material('Dark', (0.05, 0.03, 0.03, 1), rough=0.5)
        lip = material('Lip', (0.45, 0.16, 0.18, 1), rough=0.5)
    else:
        skin = material('GlassSkin', (0.88, 0.83, 1.0, 1), rough=0.1, alpha=0.82, transmission=0.25, emit=(0.78, 0.7, 1.0, 1), emit_strength=0.35)
        top = material('GlassTop', (0.72, 0.64, 1.0, 1), rough=0.1, alpha=0.78, transmission=0.25, emit=(0.7, 0.6, 1.0, 1), emit_strength=0.4)
        apron = trousers = shoes = top
        hair = material('GlassHair', (0.78, 0.7, 1.0, 1), rough=0.1, alpha=0.85, transmission=0.2, emit=(0.8, 0.7, 1.0, 1), emit_strength=0.5)
        gold = material('GlowGold', (1.0, 0.85, 0.5, 1), rough=0.2, metal=1.0, emit=(1.0, 0.85, 0.5, 1), emit_strength=0.8)
        dark = material('GlassEye', (0.35, 0.28, 0.6, 1), rough=0.3)
        lip = dark

    # torso and pelvis
    part(sphere((0, 0, 1.3), 0.3, (1.0, 0.68, 1.25)), 'chest', top)
    part(sphere((0, 0, 1.08), 0.27, (1.0, 0.7, 0.9)), 'spine', top)
    part(sphere((0, 0, 0.99), 0.26, (1.05, 0.7, 0.7)), 'hips', trousers)
    if kind == 'ayanda':
        part(box((0, -0.17, 1.12), (0.4, 0.04, 0.5)), 'spine', apron)
    # neck and head
    part(cyl((0, 0, 1.62), 0.07, 0.14), 'neck', skin)
    part(sphere((0, 0, 1.84), 0.21, (0.92, 1.0, 1.08), 24), 'head', skin)
    white = material('EyeWhite', (0.98, 0.97, 0.95, 1), rough=0.3)
    for ex in (-0.07, 0.07):
        part(sphere((ex, -0.18, 1.865), 0.034, (1, 0.5, 1.1), 14), 'head', white)
        part(sphere((ex, -0.2, 1.865), 0.019, (1, 0.5, 1.1), 10), 'head', dark)
    part(sphere((0, -0.2, 1.775), 0.038, (1.5, 0.45, 0.45), 12), 'jaw', lip)
    # hair
    part(sphere((0, 0.075, 1.915), 0.235, (0.95, 1.0, 0.95), 22), 'head', hair)
    part(sphere((0, 0.12, 2.1), 0.11, (1, 1, 1), 14), 'head', hair)
    if kind == 'ayanda':
        for i, x in enumerate((-0.14, -0.07, 0.0, 0.07, 0.14)):
            part(cyl((x, 0.17, 1.78 - 0.02 * abs(i - 2)), 0.018, 0.3, seg=8), 'head', hair)
        for x in (-0.21, 0.21):
            part(sphere((x, 0, 1.76), 0.025, (1, 1, 1), 10), 'head', gold)
    else:
        part(torus((0, 0.12, 1.98), 0.3, 0.012, (math.radians(90), 0, 0)), 'head', gold)
    # arms
    for side, x in (('R', -0.28), ('L', 0.28)):
        part(cyl((x, 0, 1.35), 0.065, 0.3), f'upper.{side}', top)
        part(cyl((x, 0, 1.06), 0.052, 0.28), f'fore.{side}', skin)
        part(sphere((x, 0, 0.86), 0.062, (1, 0.9, 1.2), 12), f'hand.{side}', skin)
    # legs
    for side, x in (('R', -0.12), ('L', 0.12)):
        part(cyl((x, 0, 0.73), 0.092, 0.45), f'thigh.{side}', trousers)
        part(cyl((x, 0, 0.29), 0.07, 0.42), f'shin.{side}', trousers)
        part(box((x, -0.07, 0.045), (0.11, 0.26, 0.09)), f'foot.{side}', shoes)

    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = f'{kind}_body'
    return mesh


# ------------------------------------------------------------------ clips
def clip(arm, name, frames, keys, loop=True):
    """keys: {frame: {bone: (rx, ry, rz) degrees}}; bones not listed at a frame hold their last pose."""
    ad = arm.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    ad.action = action
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    names = {b for f in keys.values() for b in f}
    for f in sorted(keys):
        for pb in arm.pose.bones:
            if pb.name in keys[f]:
                r = keys[f][pb.name]
                pb.rotation_euler = tuple(math.radians(v) for v in r)
            elif pb.name in names:
                pass
            else:
                continue
            pb.keyframe_insert('rotation_euler', frame=f)
    action.frame_range = (0, frames)
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.name = name
    ad.action = None
    return action


def make_clips(arm):
    Z = (0, 0, 0)
    clip(arm, 'idle', 48, {
        0: {'chest': (0, 0, 0), 'head': (0, 0, 0), 'upper.R': (0, 0, 4), 'upper.L': (0, 0, -4)},
        24: {'chest': (2, 0, 0), 'head': (-1.5, 0, 1), 'upper.R': (0, 0, 5), 'upper.L': (0, 0, -5)},
        48: {'chest': (0, 0, 0), 'head': (0, 0, 0), 'upper.R': (0, 0, 4), 'upper.L': (0, 0, -4)},
    })
    clip(arm, 'listen', 36, {
        0: {'head': (0, 0, 0), 'neck': Z},
        18: {'head': (4, 7, 0), 'neck': (2, 0, 3)},
        36: {'head': (0, 0, 0), 'neck': Z},
    })
    clip(arm, 'speak', 24, {
        0: {'jaw': (0, 0, 0), 'head': (0, 0, 0), 'fore.R': (0, 0, 0)},
        6: {'jaw': (22, 0, 0), 'head': (-3, 0, 0), 'fore.R': (-25, 0, 0)},
        12: {'jaw': (4, 0, 0), 'head': (2, 0, 0), 'fore.R': (-10, 0, 0)},
        18: {'jaw': (20, 0, 0), 'head': (-2, 0, 0), 'fore.R': (-30, 0, 0)},
        24: {'jaw': (0, 0, 0), 'head': (0, 0, 0), 'fore.R': (0, 0, 0)},
    })
    clip(arm, 'point', 30, {
        0: {'upper.R': (0, 0, 4), 'fore.R': Z, 'head': Z},
        12: {'upper.R': (-80, 0, 0), 'fore.R': (-6, 0, 0), 'head': (0, -10, 0)},
        30: {'upper.R': (-80, 0, 0), 'fore.R': (-6, 0, 0), 'head': (0, -10, 0)},
    })
    clip(arm, 'walk', 24, {
        0: {'thigh.R': (-28, 0, 0), 'thigh.L': (28, 0, 0), 'shin.R': (4, 0, 0), 'shin.L': (30, 0, 0), 'upper.R': (22, 0, 4), 'upper.L': (-22, 0, -4), 'hips': (0, 0, 3)},
        12: {'thigh.R': (28, 0, 0), 'thigh.L': (-28, 0, 0), 'shin.R': (30, 0, 0), 'shin.L': (4, 0, 0), 'upper.R': (-22, 0, 4), 'upper.L': (22, 0, -4), 'hips': (0, 0, -3)},
        24: {'thigh.R': (-28, 0, 0), 'thigh.L': (28, 0, 0), 'shin.R': (4, 0, 0), 'shin.L': (30, 0, 0), 'upper.R': (22, 0, 4), 'upper.L': (-22, 0, -4), 'hips': (0, 0, 3)},
    })
    clip(arm, 'acknowledge', 24, {
        0: {'head': Z, 'neck': Z},
        8: {'head': (16, 0, 0), 'neck': (6, 0, 0)},
        16: {'head': (0, 0, 0), 'neck': Z},
        24: {'head': Z, 'neck': Z},
    })
    clip(arm, 'hold', 30, {
        0: {'upper.R': (0, 0, 4), 'upper.L': (0, 0, -4), 'fore.R': Z, 'fore.L': Z},
        14: {'upper.R': (-40, 0, 14), 'upper.L': (-40, 0, -14), 'fore.R': (-50, 0, 0), 'fore.L': (-50, 0, 0)},
        30: {'upper.R': (-40, 0, 14), 'upper.L': (-40, 0, -14), 'fore.R': (-50, 0, 0), 'fore.L': (-50, 0, 0)},
    })


def export(arm, mesh, name):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    mesh.select_set(True)
    path = os.path.join(OUT, f'{name}.glb')
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_animations=True, export_skins=True, export_materials='EXPORT', export_yup=True)
    for extra in ({'export_animation_mode': 'ACTIONS', 'export_nla_strips': True}, {'export_nla_strips': True}, {}):
        try:
            bpy.ops.export_scene.gltf(**kw, **extra)
            break
        except TypeError:
            continue
    return path


def render_preview(arm, kind, action_names):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x, scene.render.resolution_y = 360, 520
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.world = bpy.data.worlds.new('w')
    scene.world.color = (0.93, 0.9, 1.0)
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector((1.3, -4.6, 1.2))
    direction = Vector((0, 0, 1.0)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    ad = arm.animation_data
    for nm in action_names:
        act = bpy.data.actions[nm]
        ad.action = act
        scene.frame_set(int(act.frame_range[1] * 0.5))
        scene.render.filepath = os.path.join(OUT, 'preview', f'{kind}_{nm}.png')
        bpy.ops.render.render(write_still=True)
    ad.action = None


for kind in ('ayanda', 'advisor'):
    reset()
    rig = build_rig()
    body = build_skin(kind)
    body.parent = rig
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    make_clips(rig)
    path = export(rig, body, kind)
    print(f'WROTE {path}')
    if PREVIEW:
        os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
        render_preview(rig, kind, ['idle', 'point', 'walk', 'speak', 'hold'])
print('DONE')
