"""Parallax courtyard v1: a deterministic Blender build of the master reference courtyard
(design/photoreal-courtyard-v1/01-environment.png in the planning repo).

Run with Blender 5.2 from the repository root:
  blender -b --factory-startup --python-exit-code 1 --python assets/blender/build_courtyard.py -- [--render spawn,bridge] [--samples 48]

Outputs
  assets/derived/courtyard-v1/courtyard.blend          authoring scene (textures referenced from assets/source)
  assets/derived/courtyard-v1/renders/<place>.png      Cycles renders from each place, for comparison with the reference
  web/public/worlds/courtyard-v1/environment.glb       runtime environment, textures re-encoded at 1K JPEG
  web/public/worlds/courtyard-v1/manifest.json         places, interactive objects, colliders, lighting and asset provenance

Blender is Z-up and the glTF export is Y-up, so Blender (x, y, z) becomes runtime (x, z, -y). Runtime anchors follow
PRODUCT-SPEC: spawn (0,0,9), offer (-3,0,6), intake (-3,0,0), bridge (0,0,-3), memo (3,0,-8). The channel down the middle
moved the offer, intake and memo standing spots onto the terraces; manifest.json is the single source for every position.
All dimensions are authoring decisions, not measurements of the generated reference image.
"""

import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
POLY = ROOT / 'assets' / 'source' / 'polyhaven'
DERIVED = ROOT / 'assets' / 'derived' / 'courtyard-v1'
WEB = ROOT / 'web' / 'public' / 'worlds' / 'courtyard-v1'
ASSET_VERSION = 'courtyard-v1.0'
SEED = 20261102
EYE = 1.65
# Golden hour: the Joburg panorama is after sunset, so a warm low sun carries the key light and the sky is the fill.
SUN_STRENGTH = 6.5
SKY_STRENGTH = 0.55


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {'render': [], 'samples': 48}
    for i, a in enumerate(argv):
        if a == '--render' and i + 1 < len(argv):
            out['render'] = [s for s in argv[i + 1].split(',') if s]
        if a == '--samples' and i + 1 < len(argv):
            out['samples'] = int(argv[i + 1])
    return out


def to_runtime(v):
    """Blender (x, y, z) to runtime Y-up (x, z, -y), rounded to the millimetre."""
    return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]


# ---------------------------------------------------------------------------------------------------------- scene setup

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    cols = {}
    for name in ('ENV', 'PROPS', 'PLANTS', 'TEMPLATES', 'CUTTERS'):
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        cols[name] = c
    # Templates and boolean cutters stay evaluated (a hidden collection can leave a boolean or decimate unevaluated);
    # they are kept out of renders per object and never selected for export.
    return cols


# ------------------------------------------------------------------------------------------------------------ materials

def _nodes(mat):
    try:
        mat.use_nodes = True
    except (AttributeError, TypeError):
        pass
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    return nt, bsdf


def _occlusion_group():
    """glTF exports an occlusion map only through a node group named 'glTF Material Output' (Blender glTF manual)."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g:
        return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def _image(path, colour):
    img = bpy.data.images.load(str(path), check_existing=True)
    try:
        img.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    except TypeError:
        pass
    return img


def _socket(sockets, name, kind):
    """Mix nodes carry float, vector and colour sockets under the same names; pick by type."""
    return next(s for s in sockets if s.name == name and s.type == kind)


def derived_diffuse(asset_id, label, gamma, gain, tint=(1.0, 1.0, 1.0), desaturate=0.0):
    """A toned copy of a CC0 colour map, written into assets/derived (the downloaded original stays untouched).
    Works on the stored sRGB values: out = (in ** gamma) * gain * tint, optionally pulled toward grey."""
    src = next((POLY / 'textures' / asset_id).glob('*_diff_*.jpg'))
    folder = DERIVED / 'textures'
    folder.mkdir(parents=True, exist_ok=True)
    dst = folder / f'{asset_id}_{label}_diff_2k.jpg'
    img = bpy.data.images.load(str(src), check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    rgb = np.clip(px[:, :3], 0.0, 1.0) ** gamma * gain
    if desaturate:
        lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        rgb = rgb * (1 - desaturate) + lum[:, None] * desaturate
    px[:, :3] = np.clip(rgb * np.array(tint, dtype=np.float32), 0.0, 1.0)
    out = bpy.data.images.new(dst.stem, w, h)
    out.pixels.foreach_set(px.ravel())
    out.filepath_raw = str(dst)
    out.file_format = 'JPEG'
    try:
        out.save(quality=92)
    except TypeError:
        out.save()
    bpy.data.images.remove(img)
    bpy.data.images.remove(out)
    return dst


def textured(name, asset_id, tint=(1, 1, 1), normal_strength=1.0, diffuse=None):
    """PBR material from a Poly Haven 2K set: colour, OpenGL normal, and the ARM map (AO, roughness, metal).
    Only node patterns the glTF exporter understands are used: a colour tint is a Multiply mix at factor 1
    (exported as baseColorFactor, so each channel must stay at or below 1), and the ARM channels feed the BSDF
    directly through Separate Color."""
    folder = POLY / 'textures' / asset_id
    find = lambda key: next(folder.glob(f'*_{key}_*.jpg'))
    mat = bpy.data.materials.new(name)
    nt, bsdf = _nodes(mat)
    nodes, links = nt.nodes, nt.links
    diff = nodes.new('ShaderNodeTexImage')
    diff.image = _image(diffuse or find('diff'), True)
    if tuple(tint) != (1, 1, 1):
        mix = nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        _socket(mix.inputs, 'Factor', 'VALUE').default_value = 1.0
        links.new(diff.outputs['Color'], _socket(mix.inputs, 'A', 'RGBA'))
        _socket(mix.inputs, 'B', 'RGBA').default_value = (*[min(1.0, c) for c in tint], 1.0)
        links.new(_socket(mix.outputs, 'Result', 'RGBA'), bsdf.inputs['Base Color'])
    else:
        links.new(diff.outputs['Color'], bsdf.inputs['Base Color'])
    arm = nodes.new('ShaderNodeTexImage')
    arm.image = _image(find('arm'), False)
    sep = nodes.new('ShaderNodeSeparateColor')
    links.new(arm.outputs['Color'], sep.inputs['Color'])
    links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    occ = nodes.new('ShaderNodeGroup')
    occ.node_tree = _occlusion_group()
    links.new(sep.outputs['Red'], occ.inputs['Occlusion'])
    nor = nodes.new('ShaderNodeTexImage')
    nor.image = _image(find('nor_gl'), False)
    nmap = nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = normal_strength
    links.new(nor.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def plain(name, colour, metallic=0.0, roughness=0.5, emission=None, strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    _, bsdf = _nodes(mat)
    bsdf.inputs['Base Color'].default_value = (*colour, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
    return mat


def materials():
    # The downloaded concrete averages sRGB 86 and the planks 110; the reference's warm concrete and silver-beige
    # deck sit near 165. Derived colour maps lift them (measured, not guessed: see the build log's texture means).
    light_concrete = derived_diffuse('concrete_floor_worn_001', 'warm', gamma=0.62, gain=1.22, tint=(1.04, 1.0, 0.93))
    silver_deck = derived_diffuse('brown_planks_03', 'silver', gamma=0.62, gain=1.08, tint=(1.0, 0.98, 0.94), desaturate=0.45)
    return {
        # Warm, slightly sun-bleached industrial brick, like the reference's left warehouse.
        'brick': textured('brick', 'red_brick_03', tint=(1.0, 0.93, 0.86)),
        'concrete': textured('concrete', 'concrete_floor_worn_001', diffuse=light_concrete),
        'concrete_smooth': textured('concrete_smooth', 'concrete_floor_worn_001', normal_strength=0.4, diffuse=light_concrete),
        'deck': textured('deck', 'brown_planks_03', diffuse=silver_deck),
        'corten': textured('corten', 'rust_coarse_01', tint=(0.9, 0.8, 0.72)),
        'gravel': textured('gravel', 'gravel_floor_02'),
        'soil': textured('soil', 'forest_ground_04', tint=(0.85, 0.8, 0.75)),
        'steel_dark': plain('steel_dark', (0.12, 0.13, 0.13), metallic=0.65, roughness=0.42),
        'frame': plain('frame', (0.07, 0.08, 0.08), metallic=0.5, roughness=0.5),
        'stainless': plain('stainless', (0.78, 0.79, 0.8), metallic=1.0, roughness=0.26),
        'cable': plain('cable', (0.62, 0.64, 0.66), metallic=1.0, roughness=0.32),
        'sage': plain('sage', (0.27, 0.33, 0.29), roughness=0.55),
        'glass': plain('glass', (0.55, 0.62, 0.62), roughness=0.04, alpha=0.18),
        'glass_dark': plain('glass_dark', (0.035, 0.045, 0.05), metallic=0.4, roughness=0.06),
        'plaster': plain('plaster', (0.86, 0.83, 0.78), roughness=0.85),
        'tile_white': plain('tile_white', (0.9, 0.9, 0.88), roughness=0.25),
        'render': plain('render', (0.74, 0.69, 0.6), roughness=0.8),
        'ceramic': plain('ceramic', (0.93, 0.92, 0.9), roughness=0.2),
        'cardboard': plain('cardboard', (0.55, 0.42, 0.28), roughness=0.85),
        'linen_charcoal': plain('linen_charcoal', (0.09, 0.09, 0.1), roughness=0.75),
        'paper': plain('paper', (0.95, 0.94, 0.9), roughness=0.9),
        'cork': plain('cork', (0.56, 0.42, 0.28), roughness=0.95),
        'oak': plain('oak', (0.55, 0.38, 0.22), roughness=0.55),
        'tablet': plain('tablet', (0.02, 0.02, 0.025), metallic=0.2, roughness=0.15),
        'lamp_shade': plain('lamp_shade', (0.13, 0.17, 0.15), metallic=0.5, roughness=0.45),
        'lamp_glow': plain('lamp_glow', (1.0, 0.85, 0.6), emission=(1.0, 0.8, 0.55), strength=6.0),
        'light_panel': plain('light_panel', (1.0, 0.95, 0.85), emission=(1.0, 0.9, 0.75), strength=4.0),
        'rubber': plain('rubber', (0.03, 0.03, 0.03), roughness=0.8),
    }


# ------------------------------------------------------------------------------------------------------------- geometry

def project_uvs(me, tile, along_y=False):
    """World-space box projection in metres, so a material's scale is the same on every surface it covers."""
    uv = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = (co.y, co.x) if along_y else (co.x, co.y)
            uv.data[li].uv = (u / tile, v / tile)


def box(name, lo, hi, mat, col, tile=2.0, along_y=False):
    """Axis-aligned box from corner lo to corner hi, vertices in world space (object at the origin)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    s = [abs(hi[i] - lo[i]) for i in range(3)]
    for v in bm.verts:
        v.co = Vector((c[0] + v.co.x * s[0], c[1] + v.co.y * s[1], c[2] + v.co.z * s[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    project_uvs(me, tile, along_y)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def box_local(name, size, location, rot_z, mat, col, tile=1.0):
    """Box built around its own centre, for props that are rotated in place."""
    ob = box(name, [-s / 2 for s in size], [s / 2 for s in size], mat, col, tile)
    ob.location = location
    ob.rotation_euler = (0, 0, rot_z)
    return ob


def cylinder(name, a, b, radius, mat, col, segments=12):
    """Cylinder between points a and b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=d.length)
    rot = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = len(p.vertices) == 4
    project_uvs(me, 1.0)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def cone_shade(name, top, radius, height, mat, col):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=20, radius1=radius, radius2=radius * 0.18, depth=height)
    bmesh.ops.translate(bm, vec=Vector(top) - Vector((0, 0, height / 2)), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def bake_modifiers(ob):
    """Apply all modifiers without operator context: evaluate, then swap in the evaluated mesh."""
    deps = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    old = ob.data
    ob.modifiers.clear()
    ob.data = new
    bpy.data.meshes.remove(old)


def wall_with_openings(name, lo, hi, openings, mat, cols, tile):
    """A solid wall box minus opening boxes (exact boolean), then world-space UVs on the result."""
    wall = box(name, lo, hi, mat, cols['ENV'], tile)
    for i, (olo, ohi) in enumerate(openings):
        cutter = box(f'{name}_cut{i}', olo, ohi, mat, cols['CUTTERS'], tile)
        cutter.hide_render = True
        cutter.display_type = 'WIRE'
        mod = wall.modifiers.new(f'cut{i}', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = cutter
    bake_modifiers(wall)
    project_uvs(wall.data, tile)
    return wall


# ---------------------------------------------------------------------------------------------------------- the courtyard
# Plan (Blender metres): courtyard x -6..6, y -12..12, terrace level z = 0. A sunken planted channel runs down the middle
# (x -2.5..2.5, y -6..10, floor z -2.6) with seating steps at the front; the bridge crosses it at y 2..4.

def railing(prefix, a, b, M, col, post_every=1.25, height=1.06):
    a, b = Vector(a), Vector(b)
    run = b - a
    n = max(1, round(run.length / post_every))
    across = Vector((-run.y, run.x, 0)).normalized()
    for i in range(n + 1):
        p = a + run * (i / n)
        half_x = 0.03 if abs(run.x) > abs(run.y) else 0.007
        half_y = 0.007 if abs(run.x) > abs(run.y) else 0.03
        box(f'{prefix}_post{i}', (p.x - half_x, p.y - half_y, 0), (p.x + half_x, p.y + half_y, height - 0.02), M['frame'], col, 1.0)
    cylinder(f'{prefix}_toprail', (a.x, a.y, height), (b.x, b.y, height), 0.0225, M['stainless'], col, 16)
    for k, z in enumerate((0.16, 0.31, 0.46, 0.61, 0.76, 0.91)):
        cylinder(f'{prefix}_cable{k}', (a.x, a.y, z), (b.x, b.y, z), 0.0028, M['cable'], col, 6)
    return across


def build_ground(M, cols, colliders):
    env = cols['ENV']
    slabs = {
        'terrace_left': ((-6, -12.4, -0.3), (-2.5, 12, 0)),
        'terrace_right': ((2.5, -12.4, -0.3), (6, 12, 0)),
        'terrace_front': ((-2.5, -12.4, -0.3), (2.5, -6, 0)),
        'terrace_far': ((-2.5, 10.3, -0.3), (2.5, 12, 0)),
    }
    for name, (lo, hi) in slabs.items():
        box(name, lo, hi, M['concrete'], env, 3.0)
        colliders.append({'id': name, **collider(lo, hi)})
    # Channel: retaining walls, floor beds and a gravel path.
    box('channel_wall_left', (-2.8, -6, -2.9), (-2.5, 10.3, 0), M['concrete_smooth'], env, 2.5)
    box('channel_wall_right', (2.5, -6, -2.9), (2.8, 10.3, 0), M['concrete_smooth'], env, 2.5)
    box('channel_wall_far', (-2.5, 10.0, -2.9), (2.5, 10.3, 0), M['concrete_smooth'], env, 2.5)
    box('channel_bed_left', (-2.5, -3.25, -2.9), (-0.55, 10.0, -2.55), M['soil'], env, 2.0)
    box('channel_bed_right', (0.55, -3.25, -2.9), (2.5, 10.0, -2.55), M['soil'], env, 2.0)
    box('channel_path', (-0.55, -3.25, -2.9), (0.55, 10.0, -2.6), M['gravel'], env, 1.6)
    # Seating steps down into the garden, as in the reference foreground.
    for k in range(1, 6):
        y0, y1 = -6 + 0.55 * (k - 1), -6 + 0.55 * k
        box(f'step{k}', (-2.5, y0, -2.9), (2.5, y1, -0.52 * k), M['concrete_smooth'], env, 2.5)
    # Corten planters in the garden.
    box('planter_corten_a', (-2.2, 5.6, -2.6), (-0.9, 6.4, -1.95), M['corten'], env, 1.2)
    box('planter_corten_b', (0.9, -0.8, -2.6), (2.2, 0.0, -2.05), M['corten'], env, 1.2)
    box('planter_corten_soil_a', (-2.12, 5.68, -1.99), (-0.98, 6.32, -1.97), M['soil'], env, 1.0)
    box('planter_corten_soil_b', (0.98, -0.72, -2.09), (2.12, -0.08, -2.07), M['soil'], env, 1.0)
    # Walking stops at the channel edge and at the top of the steps (the garden is looked at, not walked into, in v1).
    for name, lo, hi in (
        ('rail_channel_left', (-2.6, -6, 0), (-2.4, 10.3, 1.1)),
        ('rail_channel_right', (2.4, -6, 0), (2.6, 10.3, 1.1)),
        ('edge_steps_top', (-2.5, -6.1, 0), (2.5, -5.9, 1.1)),
    ):
        colliders.append({'id': name, **collider(lo, hi)})


def build_bridge(M, cols, colliders):
    env = cols['ENV']
    y0, y1 = 2.0, 4.0
    for k, y in enumerate((2.08, 3.92)):
        box(f'bridge_flange_top{k}', (-2.7, y - 0.075, -0.06), (2.7, y + 0.075, -0.044), M['steel_dark'], env, 1.0)
        box(f'bridge_web{k}', (-2.7, y - 0.006, -0.40), (2.7, y + 0.006, -0.06), M['steel_dark'], env, 1.0)
        box(f'bridge_flange_bottom{k}', (-2.7, y - 0.075, -0.416), (2.7, y + 0.075, -0.40), M['steel_dark'], env, 1.0)
    for k, x in enumerate((-2.0, -1.0, 0.0, 1.0, 2.0)):
        box(f'bridge_crossbeam{k}', (x - 0.03, 2.08, -0.36), (x + 0.03, 3.92, -0.06), M['steel_dark'], env, 1.0)
    # Deck planks run across the bridge so their ends show along the beam, as in the reference.
    width, gap = 0.125, 0.011
    n = int(5.0 / (width + gap))
    start = -(n * (width + gap) - gap) / 2
    for i in range(n):
        x = start + i * (width + gap)
        box(f'bridge_plank{i:02d}', (x, y0 - 0.06, -0.044), (x + width, y1 + 0.06, 0.0), M['deck'], env, 1.1, along_y=True)
    railing('bridge_rail_south', (-2.5, y0, 0), (2.5, y0, 0), M, env)
    railing('bridge_rail_north', (-2.5, y1, 0), (2.5, y1, 0), M, env)
    colliders.append({'id': 'bridge_deck', **collider((-2.5, y0, -0.3), (2.5, y1, 0))})
    colliders.append({'id': 'bridge_rail_south', **collider((-2.5, y0 - 0.05, 0), (2.5, y0 + 0.05, 1.1))})
    colliders.append({'id': 'bridge_rail_north', **collider((-2.5, y1 - 0.05, 0), (2.5, y1 + 0.05, 1.1))})
    # Channel-edge railings either side of the bridge, and the far railing over the city.
    railing('rail_left_front', (-2.5, -6, 0), (-2.5, y0, 0), M, env, 1.6)
    railing('rail_left_far', (-2.5, y1, 0), (-2.5, 10.3, 0), M, env, 1.6)
    railing('rail_right_front', (2.5, -6, 0), (2.5, y0, 0), M, env, 1.6)
    railing('rail_right_far', (2.5, y1, 0), (2.5, 10.3, 0), M, env, 1.6)
    # The far end: a planted brick wall instead of an open rail. The sky panorama was shot from a rooftop, so below
    # its horizon it shows that roof; the wall hides it and leaves the real skyline above, like the reference's planting.
    box('far_planter_wall', (-6.0, 11.3, -0.3), (6.0, 12.4, 1.25), M['brick'], env, 2.0)
    box('far_planter_coping', (-6.0, 11.25, 1.25), (6.0, 11.45, 1.32), M['concrete_smooth'], env, 1.0)
    box('far_planter_soil', (-5.9, 11.5, 1.2), (5.9, 12.3, 1.24), M['soil'], env, 1.5)
    colliders.append({'id': 'far_planter', **collider((-6.0, 11.3, 0), (6.0, 12.4, 1.32))})
    # The bridge gap in the channel-edge colliders: rebuild them as two pieces each.
    for c in list(colliders):
        if c['id'] in ('rail_channel_left', 'rail_channel_right'):
            colliders.remove(c)
    for side, x0, x1 in (('left', -2.6, -2.4), ('right', 2.4, 2.6)):
        colliders.append({'id': f'rail_channel_{side}_front', **collider((x0, -6, 0), (x1, y0, 1.1))})
        colliders.append({'id': f'rail_channel_{side}_far', **collider((x0, y1, 0), (x1, 10.3, 1.1))})


def steel_window(prefix, lo, hi, axis, M, col, cols=4, rows=4, glass='glass_dark', open_leaf=False):
    """Steel-framed multi-pane window filling an opening; axis 'x' means the wall faces +/-X."""
    t = 0.035
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    if axis == 'x':
        mid = (x0 + x1) / 2
        box(f'{prefix}_glass', (mid - 0.006, y0, z0), (mid + 0.006, y1, z1), M[glass], col, 1.0)
        for i in range(cols + 1):
            y = y0 + (y1 - y0) * i / cols
            box(f'{prefix}_mul{i}', (mid - 0.03, y - t / 2, z0), (mid + 0.03, y + t / 2, z1), M['frame'], col, 1.0)
        for j in range(rows + 1):
            z = z0 + (z1 - z0) * j / rows
            box(f'{prefix}_tr{j}', (mid - 0.03, y0, z - t / 2), (mid + 0.03, y1, z + t / 2), M['frame'], col, 1.0)
    else:
        mid = (y0 + y1) / 2
        box(f'{prefix}_glass', (x0, mid - 0.006, z0), (x1, mid + 0.006, z1), M[glass], col, 1.0)
        for i in range(cols + 1):
            x = x0 + (x1 - x0) * i / cols
            box(f'{prefix}_mul{i}', (x - t / 2, mid - 0.03, z0), (x + t / 2, mid + 0.03, z1), M['frame'], col, 1.0)
        for j in range(rows + 1):
            z = z0 + (z1 - z0) * j / rows
            box(f'{prefix}_tr{j}', (x0, mid - 0.03, z - t / 2), (x1, mid + 0.03, z + t / 2), M['frame'], col, 1.0)


def barn_lamp(prefix, base, facing, M, col, lights):
    """Gooseneck wall lamp: arm out from the wall, dark shade, warm bulb. facing = +1 (wall faces +X) or -1."""
    bx, by, bz = base
    tip = (bx + 0.42 * facing, by, bz + 0.18)
    cylinder(f'{prefix}_arm', (bx, by, bz), (bx + 0.42 * facing, by, bz + 0.25), 0.012, M['lamp_shade'], col, 8)
    cone_shade(f'{prefix}_shade', (tip[0], tip[1], tip[2] + 0.1), 0.2, 0.16, M['lamp_shade'], col)
    cylinder(f'{prefix}_bulb', (tip[0], tip[1], tip[2] - 0.05), (tip[0], tip[1], tip[2] - 0.01), 0.06, M['lamp_glow'], col, 12)
    lights.append({'id': prefix, 'type': 'point', 'position': to_runtime((tip[0], tip[1], tip[2] - 0.12)), 'color': '#ffc98a', 'intensity': 3.0, 'distance': 6.0})


KITCHEN_BAYS = (1, 2, 3)  # y -8..4: the open kitchen sits beside the bridge, as in the reference's left side


def build_left_building(M, cols, colliders, lights):
    """Warehouse with the open kitchen: brick facade at x = -6, six 4 m bays, kitchen behind bays 1 to 3."""
    env = cols['ENV']
    openings = []
    for i in range(6):
        ya, yb = -12 + 4 * i, -8 + 4 * i
        if i in KITCHEN_BAYS:
            openings.append(((-6.5, ya + 0.45, 0.0), (-5.9, yb - 0.45, 3.0)))
        elif i == 0:
            openings.append(((-6.5, -10.6, 0.0), (-5.9, -9.4, 2.4)))
        elif i == 4:
            openings.append(((-6.5, ya + 1.0, 1.0), (-5.9, yb - 1.0, 2.6)))
        for floor_z in (3.6, 6.8):
            openings.append(((-6.5, ya + 0.7, floor_z + 0.7), (-5.9, yb - 0.7, floor_z + 2.9)))
    wall_with_openings('left_facade', (-6.4, -12.4, -0.3), (-6.0, 12.4, 10.0), openings, M['brick'], cols, 2.0)
    for i in range(7):
        y = -12 + 4 * i
        box(f'left_pilaster{i}', (-6.0, y - 0.25, -0.3), (-5.85, y + 0.25, 10.0), M['brick'], env, 2.0)
    box('left_coping', (-6.45, -12.4, 10.0), (-5.8, 12.4, 10.18), M['concrete_smooth'], env, 2.0)
    box('left_lintel_band', (-6.02, -8.0, 3.0), (-5.97, 4.0, 3.25), M['steel_dark'], env, 1.0)
    for i in range(6):
        ya, yb = -12 + 4 * i, -8 + 4 * i
        for floor_z in (3.6, 6.8):
            lo, hi = (-6.25, ya + 0.7, floor_z + 0.7), (-6.15, yb - 0.7, floor_z + 2.9)
            steel_window(f'left_win{i}_{int(floor_z)}', lo, hi, 'x', M, env)
            box(f'left_sill{i}_{int(floor_z)}', (-6.05, ya + 0.62, floor_z + 0.62), (-5.92, yb - 0.62, floor_z + 0.7), M['concrete_smooth'], env, 1.0)
        if i in (1, 3):
            steel_window(f'left_kitchen_glass{i}', (-6.25, ya + 0.45, 0.0), (-6.15, yb - 0.45, 3.0), 'x', M, env, cols=4, rows=3, glass='glass')
        if i == 2:
            # The middle kitchen bay stands open: folding steel-glass doors pushed back against the reveals.
            for k, (y, sign) in enumerate(((ya + 0.5, 1), (yb - 0.5, -1))):
                steel_window(f'left_folded{k}', (-5.95, y, 0.0), (-5.15, y + 0.04 * sign, 3.0), 'y', M, env, cols=2, rows=3, glass='glass')
        if i == 4:
            steel_window('left_win_ground4', (-6.25, ya + 1.0, 1.0), (-6.15, yb - 1.0, 2.6), 'x', M, env, cols=3, rows=2)
        barn_lamp(f'lamp_left{i}', (-5.85, -10 + 4 * i, 3.75), 1, M, env, lights)
    # Sage door in the first bay, by the gate.
    box('left_door_frame', (-6.18, -10.64, 0.0), (-6.08, -9.36, 2.44), M['frame'], env, 1.0)
    box('left_door', (-6.16, -10.6, 0.0), (-6.1, -9.4, 2.4), M['sage'], env, 1.0)
    box('left_door_handle', (-6.1, -10.05, 1.0), (-6.04, -10.0, 1.12), M['stainless'], env, 1.0)
    colliders.append({'id': 'left_facade', **collider((-6.4, -12.4, 0), (-5.85, 12.4, 4.0))})
    build_kitchen(M, cols, lights)


def build_kitchen(M, cols, lights):
    """Interior behind KITCHEN_BAYS: y runs from K0 to K1."""
    env = cols['ENV']
    K0, K1 = -12 + 4 * KITCHEN_BAYS[0], -8 + 4 * KITCHEN_BAYS[-1]
    box('kitchen_floor', (-11.0, K0, -0.3), (-6.4, K1, 0.0), M['concrete'], env, 3.0)
    box('kitchen_ceiling', (-11.0, K0, 3.6), (-6.4, K1, 3.75), M['plaster'], env, 3.0)
    box('kitchen_back', (-11.2, K0, 0.0), (-11.0, K1, 3.6), M['tile_white'], env, 1.0)
    box('kitchen_end_a', (-11.0, K0 - 0.2, 0.0), (-6.4, K0, 3.6), M['plaster'], env, 3.0)
    box('kitchen_end_b', (-11.0, K1, 0.0), (-6.4, K1 + 0.2, 3.6), M['plaster'], env, 3.0)
    for k in range(4):
        y = K0 + 1.5 + 3.0 * k
        box(f'kitchen_light{k}', (-10.2, y - 0.6, 3.56), (-7.2, y + 0.6, 3.6), M['light_panel'], env, 1.0)
        lights.append({'id': f'kitchen_light{k}', 'type': 'point', 'position': to_runtime((-8.7, y, 3.2)), 'color': '#ffe2b8', 'intensity': 6.0, 'distance': 7.0})
    # Back counter, hood, island, shelves of plates, pots: the working kitchen seen through the doors.
    box('kitchen_counter_back', (-11.0, K0 + 0.4, 0.0), (-10.3, K1 - 0.4, 0.9), M['stainless'], env, 1.0)
    box('kitchen_hood', (-11.0, K0 + 3.0, 2.35), (-10.05, K1 - 3.0, 2.9), M['stainless'], env, 1.0)
    box('kitchen_island', (-8.9, K0 + 2.0, 0.0), (-8.1, K1 - 3.0, 0.9), M['stainless'], env, 1.0)
    box('kitchen_island_kick', (-8.85, K0 + 2.05, 0.0), (-8.15, K1 - 3.05, 0.12), M['rubber'], env, 1.0)
    for k in range(4):
        y = K0 + 2.8 + 1.8 * k
        cone_shade(f'kitchen_pendant{k}', (-8.5, y, 3.6), 0.22, 0.24, M['stainless'], env)
        cylinder(f'kitchen_pendant_cord{k}', (-8.5, y, 3.36), (-8.5, y, 3.6), 0.006, M['rubber'], env, 6)
        cylinder(f'kitchen_pendant_bulb{k}', (-8.5, y, 3.3), (-8.5, y, 3.36), 0.07, M['lamp_glow'], env, 12)
    rng = random.Random(SEED + 1)
    for k in range(9):
        y = K0 + 0.8 + k * 1.3
        r = 0.11 + rng.random() * 0.05
        h = 0.14 + rng.random() * 0.12
        cylinder(f'kitchen_pot{k}', (-10.65, y, 0.9), (-10.65, y, 0.9 + h), r, M['stainless'], env, 16)
    for k, y in enumerate((K0 + 5.1, K0 + 6.6)):
        x = -7.2
        box(f'rack{k}_frame_a', (x - 0.3, y - 0.02, 0.0), (x - 0.26, y + 0.02, 1.7), M['stainless'], env, 1.0)
        box(f'rack{k}_frame_b', (x + 0.26, y - 0.02, 0.0), (x + 0.3, y + 0.02, 1.7), M['stainless'], env, 1.0)
        for j in range(5):
            z = 0.25 + j * 0.3
            box(f'rack{k}_shelf{j}', (x - 0.3, y - 0.25, z), (x + 0.3, y + 0.25, z + 0.02), M['stainless'], env, 1.0)
            cylinder(f'rack{k}_plates{j}', (x, y, z + 0.02), (x, y, z + 0.14), 0.13, M['ceramic'], env, 20)


def build_right_building(M, cols, colliders, lights):
    """Brick building with the stock room behind open sage doors, and the memo board by the office door."""
    env = cols['ENV']
    openings = [((5.9, -1.0, 0.0), (6.5, 2.2, 2.8)), ((5.9, 6.6, 0.0), (6.5, 7.6, 2.4))]
    for i in range(6):
        ya, yb = -12 + 4 * i, -8 + 4 * i
        for floor_z in (4.2, 7.4):
            openings.append(((5.9, ya + 0.8, floor_z + 0.6), (6.5, yb - 0.8, floor_z + 2.6)))
    wall_with_openings('right_facade', (6.0, -12.4, -0.3), (6.4, 12.4, 10.6), openings, M['brick'], cols, 2.0)
    box('right_band', (5.94, -12.4, 3.4), (6.02, 12.4, 4.2), M['render'], env, 3.0)
    box('right_coping', (5.8, -12.4, 10.6), (6.45, 12.4, 10.78), M['concrete_smooth'], env, 2.0)
    for i in range(6):
        ya, yb = -12 + 4 * i, -8 + 4 * i
        for floor_z in (4.2, 7.4):
            steel_window(f'right_win{i}_{int(floor_z * 10)}', (6.15, ya + 0.8, floor_z + 0.6), (6.25, yb - 0.8, floor_z + 2.6), 'x', M, env)
            box(f'right_sill{i}_{int(floor_z * 10)}', (5.92, ya + 0.72, floor_z + 0.52), (6.05, yb - 0.72, floor_z + 0.6), M['concrete_smooth'], env, 1.0)
    # Stock room: open sage double doors folded back against the facade, steel shelves of boxes inside.
    box('store_floor', (6.4, -1.4, -0.3), (10.0, 2.6, 0.0), M['concrete'], env, 3.0)
    box('store_ceiling', (6.4, -1.4, 3.0), (10.0, 2.6, 3.1), M['plaster'], env, 3.0)
    box('store_back', (10.0, -1.4, 0.0), (10.2, 2.6, 3.0), M['plaster'], env, 3.0)
    box('store_side_a', (6.4, -1.6, 0.0), (10.0, -1.4, 3.0), M['plaster'], env, 3.0)
    box('store_side_b', (6.4, 2.6, 0.0), (10.0, 2.8, 3.0), M['plaster'], env, 3.0)
    box('store_light', (7.6, 0.2, 2.96), (8.8, 1.0, 3.0), M['light_panel'], env, 1.0)
    lights.append({'id': 'store_light', 'type': 'point', 'position': to_runtime((8.2, 0.6, 2.6)), 'color': '#fff0d8', 'intensity': 4.0, 'distance': 6.0})
    box('store_door_a', (5.0, -1.06, 0.0), (5.94, -1.0, 2.76), M['sage'], env, 1.0)
    box('store_door_b', (5.0, 2.2, 0.0), (5.94, 2.26, 2.76), M['sage'], env, 1.0)
    rng = random.Random(SEED + 2)
    for k, y in enumerate((-0.9, 0.5, 1.9)):
        x0 = 9.3
        for j in range(4):
            z = 0.15 + j * 0.62
            box(f'store_shelf{k}_{j}', (x0, y - 0.55, z), (x0 + 0.6, y + 0.55, z + 0.03), M['stainless'], env, 1.0)
            for b in range(3):
                w = 0.28 + rng.random() * 0.06
                h = 0.22 + rng.random() * 0.14
                yy = y - 0.4 + b * 0.38
                box(f'store_box{k}_{j}_{b}', (x0 + 0.05, yy - w / 2, z + 0.03), (x0 + 0.5, yy + w / 2, z + 0.03 + h), M['cardboard'], env, 0.6)
        for c in ((x0, y - 0.55), (x0 + 0.6, y - 0.55), (x0, y + 0.55), (x0 + 0.6, y + 0.55)):
            box(f'store_upright{k}_{c[0]:.1f}_{c[1]:.2f}', (c[0] - 0.02, c[1] - 0.02, 0.0), (c[0] + 0.02, c[1] + 0.02, 2.6), M['stainless'], env, 1.0)
    barn_lamp('lamp_right_store', (5.85, 0.6, 3.0), -1, M, env, lights)
    # Office door and the memo board beside it.
    steel_window('office_door', (6.15, 6.6, 0.0), (6.25, 7.6, 2.4), 'x', M, env, cols=2, rows=4, glass='glass_dark')
    box('memo_board_frame', (5.9, 8.15, 0.95), (5.96, 9.65, 2.05), M['oak'], env, 1.0)
    board = box('memo_board', (5.86, 8.2, 1.0), (5.9, 9.6, 2.0), M['cork'], cols['PROPS'], 1.0)
    rng = random.Random(SEED + 3)
    for k in range(5):
        y = 8.35 + k * 0.25 + rng.random() * 0.03
        z = 1.25 + (k % 2) * 0.38
        box(f'memo_sheet{k}', (5.84, y, z), (5.86, y + 0.21, z + 0.297), M['paper'], cols['PROPS'], 1.0)
    barn_lamp('lamp_memo', (5.85, 8.9, 2.55), -1, M, env, lights)
    colliders.append({'id': 'right_facade', **collider((5.85, -12.4, 0), (6.4, 12.4, 4.0))})
    colliders.append({'id': 'store_doors', **collider((5.0, -1.1, 0), (5.95, 2.3, 2.8))})
    return board


def build_back_wall(M, cols, colliders):
    env = cols['ENV']
    wall_with_openings('back_wall', (-6.4, -12.8, -0.3), (6.4, -12.4, 6.0), [((-2.0, -13.0, 0.0), (2.0, -12.2, 3.6))], M['brick'], cols, 2.0)
    box('back_gate', (-2.0, -12.65, 0.0), (2.0, -12.55, 3.6), M['sage'], env, 1.0)
    for k in range(9):
        x = -1.8 + k * 0.45
        box(f'back_gate_rib{k}', (x - 0.02, -12.56, 0.05), (x + 0.02, -12.5, 3.55), M['frame'], env, 1.0)
    colliders.append({'id': 'back_wall', **collider((-6.4, -12.8, 0), (6.4, -12.4, 4.0))})


def build_props(M, cols, colliders):
    """The objects you can inspect. Names are stable ids the app binds to; positions go to the manifest."""
    props = cols['PROPS']
    objs = {}
    # Offer: a stainless prep counter on the terrace in front of the open kitchen, the contract folder on it.
    top = box('offer_counter_top', (-4.15, -7.0, 0.88), (-3.45, -5.0, 0.92), M['stainless'], props, 1.0)
    for k, (x, y) in enumerate(((-4.1, -6.95), (-3.5, -6.95), (-4.1, -5.05), (-3.5, -5.05))):
        box(f'offer_counter_leg{k}', (x - 0.02, y - 0.02, 0.0), (x + 0.02, y + 0.02, 0.88), M['stainless'], props, 1.0)
    box('offer_counter_shelf', (-4.12, -6.97, 0.2), (-3.48, -5.03, 0.22), M['stainless'], props, 1.0)
    folder = box_local('contract', (0.32, 0.24, 0.02), (-3.79, -6.3, 0.93), math.radians(8), M['linen_charcoal'], props)
    objs['offer_counter'] = top
    objs['contract'] = folder
    # Pan station: pots and a pan at the far end of the same counter.
    pots = []
    for k, (y, r, h) in enumerate(((-5.55, 0.14, 0.2), (-5.25, 0.11, 0.15))):
        pots.append(cylinder(f'pan_station_pot{k}', (-3.8, y, 0.92), (-3.8, y, 0.92 + h), r, M['stainless'], props, 20))
    pan = cylinder('pan', (-3.62, -5.85, 0.92), (-3.62, -5.85, 0.97), 0.15, M['stainless'], props, 24)
    cylinder('pan_handle', (-3.62, -5.85, 0.95), (-3.62, -6.25, 0.97), 0.012, M['rubber'], props, 8)
    objs['pan'] = pan
    colliders.append({'id': 'offer_counter', **collider((-4.15, -7.0, 0), (-3.45, -5.0, 0.92))})
    # The second fridge, new on the terrace by the kitchen doors (the equipment the contract would need).
    fridge = box('fridge', (-5.75, -3.4, 0.0), (-5.05, -2.65, 1.95), M['stainless'], props, 1.0)
    box('fridge_seal', (-5.06, -3.38, 1.18), (-5.04, -2.67, 1.2), M['rubber'], props, 1.0)
    box('fridge_handle', (-5.04, -2.78, 0.75), (-5.0, -2.74, 1.6), M['stainless'], props, 1.0)
    box('fridge_plinth', (-5.73, -3.38, 0.0), (-5.07, -2.67, 0.08), M['rubber'], props, 1.0)
    objs['fridge'] = fridge
    colliders.append({'id': 'fridge', **collider((-5.75, -3.4, 0), (-5.05, -2.65, 1.95))})
    # Intake: an oak table with paperwork and a tablet, crates of ingredients beside it.
    desk = box('intake_desk_top', (-4.6, 0.0, 0.74), (-3.85, 1.4, 0.78), M['oak'], props, 1.0)
    for k, (x, y) in enumerate(((-4.55, 0.05), (-3.9, 0.05), (-4.55, 1.35), (-3.9, 1.35))):
        box(f'intake_desk_leg{k}', (x - 0.025, y - 0.025, 0.0), (x + 0.025, y + 0.025, 0.74), M['frame'], props, 1.0)
    box('intake_papers', (-4.4, 0.25, 0.78), (-4.19, 0.547, 0.81), M['paper'], props, 1.0)
    box('intake_tablet', (-4.25, 0.75, 0.78), (-4.08, 1.0, 0.788), M['tablet'], props, 1.0)
    for k, y in enumerate((1.7, 2.15)):
        box(f'intake_crate{k}', (-5.3, y, 0.0), (-4.8, y + 0.38, 0.32 + 0.08 * k), M['cardboard'], props, 0.6)
    objs['intake_desk'] = desk
    colliders.append({'id': 'intake_desk', **collider((-4.6, 0.0, 0), (-3.85, 1.4, 0.78))})
    colliders.append({'id': 'intake_crates', **collider((-5.3, 1.7, 0), (-4.8, 2.53, 0.4))})
    return objs


# ------------------------------------------------------------------------------------------------------------- plants

def import_model(asset_id, cols, decimate=None):
    """Imports a Poly Haven glTF, joins it into one mesh at the origin and keeps it as a hidden template."""
    path = next((POLY / 'models' / asset_id).glob('*.gltf'))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.data = o.data.copy()  # a mesh shared by two nodes must not be transformed twice
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    names = [o.name for o in new]
    with bpy.context.temp_override(active_object=meshes[0], object=meshes[0], selected_objects=meshes, selected_editable_objects=meshes):
        bpy.ops.object.join()
    tpl = meshes[0]
    # Joining deletes the other meshes, so leftovers (empties, cameras) are looked up by name, not by stale reference.
    for nm in names:
        o = bpy.data.objects.get(nm)
        if o is not None and o != tpl:
            bpy.data.objects.remove(o, do_unlink=True)
    tpl.name = f'tpl_{asset_id}'
    for c in list(tpl.users_collection):
        c.objects.unlink(tpl)
    cols['TEMPLATES'].objects.link(tpl)
    if decimate:
        mod = tpl.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = decimate
        bake_modifiers(tpl)
    tpl.hide_render = True
    return tpl


def place(tpl, name, loc, col, rot_z=0.0, scale=1.0):
    ob = tpl.copy()  # linked duplicate: the mesh is stored once in the export
    ob.name = name
    ob.hide_render = False
    ob.location = loc
    ob.rotation_euler = (0, 0, rot_z)
    ob.scale = (scale, scale, scale)
    col.objects.link(ob)
    return ob


def build_plants(cols):
    rng = random.Random(SEED)
    # Decimation keeps every plant near 8k triangles: the garden is the bulk of what an integrated GPU draws.
    tpl = {
        'shrub_02': import_model('shrub_02', cols, 0.16),
        'shrub_03': import_model('shrub_03', cols, 0.45),
        'shrub_04': import_model('shrub_04', cols, 0.17),
        'fern_02': import_model('fern_02', cols),
        'grass': import_model('grass_bermuda_01', cols, 0.04),
        'rocks': import_model('rock_moss_set_01', cols, 0.4),
        'potted_02': import_model('potted_plant_02', cols, 0.5),
        'potted_04': import_model('potted_plant_04', cols),
    }
    plants = cols['PLANTS']
    floor = -2.55
    # Beds either side of the gravel path, two staggered rows per bed; deterministic jitter so the garden reads as
    # planted, not tiled. Scales are relative to Poly Haven's real-world sizes.
    kinds = ['shrub_02', 'shrub_04', 'fern_02', 'grass', 'shrub_03', 'shrub_02', 'grass', 'fern_02', 'shrub_04']
    scale = {'shrub_02': (1.7, 2.5), 'shrub_03': (1.6, 2.3), 'shrub_04': (1.7, 2.4), 'fern_02': (1.3, 1.9), 'grass': (1.5, 2.2)}
    n = 0
    for side, (x0, x1) in (('l', (-2.35, -0.7)), ('r', (0.7, 2.35))):
        for row in range(2):
            y = -2.9 + row * 0.35
            while y < 9.7:
                kind = kinds[n % len(kinds)]
                lo_x = x0 + (x1 - x0) * (0.5 * row)
                x = lo_x + rng.random() * (x1 - x0) * 0.5
                s0, s1 = scale[kind]
                place(tpl[kind], f'plant_{side}{n:03d}_{kind}', (x, y, floor), plants, rng.random() * math.tau, s0 + rng.random() * (s1 - s0))
                y += 0.75 + rng.random() * 0.6
                n += 1
    for k, (x, y) in enumerate(((-1.7, 3.2), (1.5, 7.8))):
        place(tpl['rocks'], f'rocks{k}', (x, y, floor), plants, rng.random() * math.tau, 0.45)
    # The far planter: a continuous green edge in front of the city.
    x = -5.6
    while x < 5.7:
        kind = ('shrub_02', 'grass', 'shrub_04', 'fern_02')[n % 4]
        s0, s1 = scale[kind]
        place(tpl[kind], f'far_{n:03d}_{kind}', (x, 11.9 + (rng.random() - 0.5) * 0.4, 1.22), plants, rng.random() * math.tau, s0 + rng.random() * (s1 - s0))
        x += 0.85 + rng.random() * 0.5
        n += 1
    place(tpl['shrub_04'], 'planter_a_shrub', (-1.55, 6.0, -1.97), plants, 0.4, 0.8)
    place(tpl['shrub_03'], 'planter_b_shrub', (1.55, -0.4, -2.07), plants, 1.1, 0.9)
    place(tpl['potted_02'], 'pot_kitchen_door', (-5.45, -11.4, 0.0), plants, 0.3, 1.0)
    place(tpl['potted_02'], 'pot_store_door', (5.4, 2.75, 0.0), plants, 2.0, 1.1)
    place(tpl['potted_04'], 'pot_desk', (-4.45, 1.2, 0.78), plants, 0.0, 0.8)
    place(tpl['potted_02'], 'pot_far_left', (-5.4, 11.3, 0.0), plants, 1.3, 1.2)
    return n


# --------------------------------------------------------------------------------------------------- places and output

def collider(lo, hi):
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    s = [abs(hi[i] - lo[i]) for i in range(3)]
    return {'shape': 'box', 'center': to_runtime(c), 'size': [round(s[0], 3), round(s[2], 3), round(s[1], 3)]}


PLACES = {
    # id: (label, standing spot, camera position, camera target), Blender coordinates
    'spawn': ('Courtyard', (0.0, -9.0, 0.0), (0.4, -8.6, 1.8), (-0.9, 4.5, 0.0)),
    'offer': ('Offer', (-2.9, -5.2, 0.0), (-2.75, -4.55, EYE), (-3.8, -6.3, 0.9)),
    'intake': ('Intake', (-2.9, 0.9, 0.0), (-2.7, 2.2, EYE), (-4.2, 0.6, 0.8)),
    'bridge': ('Bridge', (0.0, 3.0, 0.0), (-0.2, 2.6, EYE), (0.9, 11.5, 0.6)),
    'memo': ('Memo', (4.0, 7.6, 0.0), (3.6, 6.6, EYE), (5.9, 8.9, 1.5)),
}


def place_cameras():
    cams = {}
    for pid, (_, _, pos, target) in PLACES.items():
        data = bpy.data.cameras.new(f'cam_{pid}')
        data.lens = 24
        data.sensor_width = 36
        cam = bpy.data.objects.new(f'cam_{pid}', data)
        bpy.context.scene.collection.objects.link(cam)
        cam.location = pos
        cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        cams[pid] = cam
    return cams


def hdri_sun_uv(path):
    """Brightest point of the sky half of the equirect HDR (u from the left, v from the top)."""
    img = bpy.data.images.load(str(path), check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    lum = 0.2126 * px[..., 0] + 0.7152 * px[..., 1] + 0.0722 * px[..., 2]
    sky = lum[h // 2:, :]  # Blender rows start at the bottom, so the top half is the sky
    r, c = np.unravel_index(np.argmax(sky), sky.shape)
    row = h // 2 + r
    return (c + 0.5) / w, 1.0 - (row + 0.5) / h, float(sky[r, c])


def lighting(sun_target):
    """World from the Joburg HDRI, rotated so its sunset glow sits where the reference has its sun, plus a warm sun."""
    hdr = next((POLY / 'hdris' / 'sunset_jhbcentral').glob('*_2k.hdr'))
    u, v, peak = hdri_sun_uv(hdr)
    # Blender equirect lookup: u = atan2(dir.y, -dir.x) / 2pi + 0.5. Rotate the lookup so the glow lands on sun_target.
    phi = (u - 0.5) * math.tau
    glow_dir = Vector((-math.cos(phi), math.sin(phi), 0.0))
    target = Vector((sun_target[0], sun_target[1], 0.0)).normalized()
    rot_z = math.atan2(glow_dir.y, glow_dir.x) - math.atan2(target.y, target.x)
    world = bpy.data.worlds.new('joburg')
    bpy.context.scene.world = world
    try:
        world.use_nodes = True
    except (AttributeError, TypeError):
        pass
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = SKY_STRENGTH
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(hdr), check_existing=True)
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Rotation'].default_value = (0, 0, rot_z)
    coord = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    sun_dir = Vector(sun_target).normalized()
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = SUN_STRENGTH
    sun_data.color = (1.0, 0.66, 0.4)
    sun_data.angle = math.radians(1.2)
    sun = bpy.data.objects.new('sun', sun_data)
    bpy.context.scene.collection.objects.link(sun)
    sun.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
    elevation = math.degrees(math.asin(sun_dir.z))
    return {
        'hdri': {'lighting': 'joburg_2k.hdr', 'background': 'joburg_bg.jpg', 'assetId': 'sunset_jhbcentral', 'glowUV': [round(u, 4), round(v, 4)], 'glowRadiance': round(peak, 3)},
        'sun': {'direction': to_runtime(tuple(sun_dir)), 'elevationDeg': round(elevation, 1), 'color': '#ffa866', 'intensity': 4.5},
        'skyIntensity': SKY_STRENGTH,
        'blenderWorldRotationZ': round(rot_z, 5),
    }


def render_places(cams, which, samples):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    out = DERIVED / 'renders'
    out.mkdir(parents=True, exist_ok=True)
    for pid in which:
        scene.camera = cams[pid]
        scene.render.filepath = str(out / f'{pid}.png')
        bpy.ops.render.render(write_still=True)
        print(f'rendered {pid}')


def merge_static(cols):
    """One mesh per material for the static architecture: hundreds of boxes become a few dozen draw calls.
    Interactive props and plants stay separate, named nodes."""
    groups = {}
    for o in list(cols['ENV'].objects):
        if o.type == 'MESH' and len(o.data.materials) == 1:
            groups.setdefault(o.data.materials[0].name, []).append(o)
    for mat_name, objs in sorted(groups.items()):
        if len(objs) > 1:
            with bpy.context.temp_override(active_object=objs[0], object=objs[0], selected_objects=objs, selected_editable_objects=objs):
                bpy.ops.object.join()
        objs[0].name = f'env_{mat_name}'


def export(cols, manifest):
    WEB.mkdir(parents=True, exist_ok=True)
    DERIVED.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(DERIVED / 'courtyard.blend'))
    merge_static(cols)
    # Runtime textures: 2K sources re-encoded at 1K keep the first download modest; the .blend keeps the 2K links.
    for img in bpy.data.images:
        if img.source == 'FILE' and img.size[0] > 1024 and img.filepath.lower().endswith('.jpg') and '_2k' in img.filepath:
            img.scale(1024, 1024)
    export_names = {o.name for c in ('ENV', 'PROPS', 'PLANTS') for o in cols[c].all_objects}
    for o in bpy.context.view_layer.objects:
        o.select_set(o.name in export_names)
    wanted = {
        'filepath': str(WEB / 'environment.glb'),
        'export_format': 'GLB',
        'use_selection': True,
        'export_apply': True,
        'export_yup': True,
        'export_extras': True,
        'export_cameras': False,
        'export_lights': False,
        'export_image_format': 'JPEG',
        'export_jpeg_quality': 82,
        'export_materials': 'EXPORT',
    }
    valid = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    dropped = sorted(set(wanted) - valid)
    if dropped:
        print(f'glTF exporter does not know: {dropped}')
    bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in valid})
    (WEB / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


def main():
    opts = args()
    cols = reset()
    M = materials()
    colliders, lights = [], []
    build_ground(M, cols, colliders)
    build_bridge(M, cols, colliders)
    build_left_building(M, cols, colliders, lights)
    board = build_right_building(M, cols, colliders, lights)
    build_back_wall(M, cols, colliders)
    objs = build_props(M, cols, colliders)
    objs['memo'] = board
    planted = build_plants(cols)
    cams = place_cameras()
    # The reference's sun sits low at the far end, right of the courtyard's axis. Turning sky and sun together by
    # this direction also brings the panorama's dark CBD tower (25 degrees left of the glow) into the far view.
    light = lighting((0.36, 1.0, 0.21))

    required = ['left_facade', 'right_facade', 'bridge_plank00', 'contract', 'fridge', 'pan', 'intake_desk_top', 'memo_board', 'terrace_left']
    missing = [n for n in required if n not in bpy.data.objects]
    if missing:
        raise RuntimeError(f'required objects missing: {missing}')

    def centre(ob):
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        return tuple(sum(v[i] for v in bb) / 8 for i in range(3))

    interactive = {
        'contract': {'label': 'Contract', 'node': 'contract', 'place': 'offer', 'radius': 2.2, 'actions': ['inspect', 'ask', 'propose_terms'], 'claimBinding': 'contract'},
        'pan': {'label': 'Ingredients and packaging', 'node': 'pan', 'place': 'offer', 'radius': 2.2, 'actions': ['inspect', 'propose_direct_cost'], 'claimBinding': 'direct'},
        'fridge': {'label': 'Second fridge', 'node': 'fridge', 'place': 'intake', 'radius': 2.5, 'actions': ['inspect', 'propose_equipment_cost'], 'claimBinding': 'equipment'},
        'intake_desk': {'label': 'Intake desk', 'node': 'intake_desk_top', 'place': 'intake', 'radius': 2.2, 'actions': ['inspect'], 'claimBinding': None},
        'memo': {'label': 'Decision memo', 'node': 'memo_board', 'place': 'memo', 'radius': 2.5, 'actions': ['review'], 'claimBinding': 'memo'},
    }
    for oid, o in interactive.items():
        o['position'] = to_runtime(centre(bpy.data.objects[o['node']]))
    manifest = {
        'version': 1,
        'assetVersion': ASSET_VERSION,
        'worldId': 'courtyard-v1',
        'units': 'metres',
        'up': 'y',
        'bounds': {'min': to_runtime((-11.2, 12.4, -2.9)), 'max': to_runtime((10.2, -12.8, 10.8))},
        'eyeHeight': EYE,
        'spawn': 'spawn',
        'places': {
            pid: {'label': label, 'stand': to_runtime(stand), 'camera': to_runtime(pos), 'target': to_runtime(target)}
            for pid, (label, stand, pos, target) in PLACES.items()
        },
        'objects': interactive,
        'colliders': colliders,
        'lighting': {**light, 'lights': lights, 'exposure': 1.0},
        'assets': {'environment': 'environment.glb', 'plantsPlaced': planted},
        'provenance': 'assets/provenance.json; built by assets/blender/build_courtyard.py',
    }
    export(cols, manifest)
    if opts['render']:
        render_places(cams, opts['render'], opts['samples'])
    tris = 0
    for c in ('ENV', 'PROPS', 'PLANTS'):
        for o in cols[c].all_objects:
            if o.type == 'MESH':
                o.data.calc_loop_triangles()
                tris += len(o.data.loop_triangles)
    print(f'courtyard built: {len(colliders)} colliders, {len(lights)} lights, {planted} plants, {tris} triangles drawn')


main()
