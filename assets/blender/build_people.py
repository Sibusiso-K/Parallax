"""Parallax people v1: realistic rigged Ayanda and advisor, built with MPFB 2.0.18 from MakeHuman assets
(CC0 system assets and Mindfront brows/lashes; the CC-BY overshirt is credited in assets/CREDITS.md).

Run with Blender 5.2 from the repository root, WITHOUT --factory-startup (the MPFB extension must load):
  blender -b --python-exit-code 1 --python assets/blender/build_people.py -- [--preview] [--export]

Outputs
  assets/derived/people-v1/people.blend             authoring scene
  assets/derived/people-v1/renders/lineup.png        Cycles line-up for checking the look (--preview)
  web/public/avatars/<id>-preview-v3.glb, avatar-manifest.json  skinned characters for the courtyard (--export)

Identity targets (PRODUCT-SPEC, design/photoreal-courtyard-v1/03-ayanda-sheet.png and 04-advisor-portrait.png):
  Ayanda: woman about 40, deep brown skin, short natural coils, olive top, oatmeal apron, dark trousers, boots.
  Advisor: woman about 58, medium-brown skin, salt-and-pepper curls, tortoiseshell glasses, navy overshirt, cream tee.
Both are fictional. Blender is Z-up and MakeHuman figures face -Y.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from bl_ext.user_default.mpfb.services import ExportService, FaceService, HumanService, LocationService, ObjectService, TargetService
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
DERIVED = ROOT / 'assets' / 'derived' / 'people-v1'
WEB = ROOT / 'web' / 'public' / 'avatars'
DATA = Path(LocationService.get_user_data())


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return {'preview': '--preview' in argv, 'export': '--export' in argv}


def age_value(years):
    """MakeHuman's age dial: 0.5 is 25 years and 1.0 is 90, linear in between."""
    return 0.5 + (years - 25) / 65 * 0.5


PEOPLE = {
    'ayanda': {
        'name': 'Ayanda',
        'phenotype': {'gender': 0.0, 'age': age_value(40), 'muscle': 0.5, 'weight': 0.42, 'proportions': 0.62, 'height': 0.48,
                      'cupsize': 0.45, 'firmness': 0.55, 'race': {'african': 1.0, 'asian': 0.0, 'caucasian': 0.0}},
        'skin': 'young_african_female/young_african_female.mhmat',
        'hair': 'afro01/afro01.mhclo',
        'eyebrows': 'mindfront_eyebrows_03/mindfront_eyebrows_03.mhclo',
        'eyelashes': 'mindfront_eyelashes_02/mindfront_eyelashes_02.mhclo',
        # No work shirt: the casual suit's own top is the olive layer (MakeHuman CC0 system asset). The shirt that was here
        # is CC BY with an unconfirmed licence version, and its delete-verts cut the body where only it covered.
        'clothes': ['female_casualsuit01/female_casualsuit01.mhclo', 'shoes03/shoes03.mhclo'],
        # Colours from the reference sheet (sRGB): olive top, near-black trousers, dark brown boots, black coils.
        'tone': {'casualsuit': {'rgb': (0.07, 0.07, 0.08), 'contrast': 0.15},
                 'shoes': (0.22, 0.14, 0.09), 'afro': {'coils': ((0.018, 0.013, 0.011), (0.20, 0.13, 0.09))}},
        'suit_top': (0.074, 0.088, 0.033),  # olive, sRGB (0.30, 0.33, 0.20); plain materials take linear values
        'apron': (0.70, 0.65, 0.55),  # oatmeal linen
        'hair_volume': 1.12,
    },
    'advisor': {
        'name': 'Advisor',
        'phenotype': {'gender': 0.0, 'age': age_value(58), 'muscle': 0.45, 'weight': 0.74, 'proportions': 0.5, 'height': 0.44,
                      'cupsize': 0.62, 'firmness': 0.45, 'race': {'african': 0.85, 'asian': 0.0, 'caucasian': 0.15}},
        'skin': 'middleage_african_female/middleage_african_female.mhmat',
        'hair': 'afro01/afro01.mhclo',
        'eyebrows': 'mindfront_eyebrows_05/mindfront_eyebrows_05.mhclo',
        'eyelashes': 'mindfront_eyelashes_01/mindfront_eyelashes_01.mhclo',
        'clothes': ['female_casualsuit01/female_casualsuit01.mhclo', 'mindfront_cardigan_long_open_front/mindfront_cardigan_long_open_front.mhclo',
                    'kwnet_at_optical_glasses/kwnet_at_optical_glasses.mhclo', 'shoes04/shoes04.mhclo'],
        # Navy linen overshirt, dark trousers, brown tortoiseshell frames, salt-and-pepper curls.
        'tone': {'cardigan': {'rgb': (0.07, 0.09, 0.18), 'contrast': 0.5}, 'casualsuit': {'rgb': (0.09, 0.09, 0.11), 'contrast': 0.15},
                 'optical': (0.28, 0.17, 0.10), 'afro': {'coils': ((0.025, 0.025, 0.025), (0.45, 0.44, 0.42))}},
        'suit_top': (0.88, 0.84, 0.74),  # the casual suit's tee becomes a plain cream tee
        'hide_outer_sleeves': True,  # under the overshirt the long tee's outer sleeves poke through, so they are hidden
        'cardigan_hem': 0.47,  # cut the long cardigan to hip length: keep faces above this fraction of body height
        'hair_volume': 1.08,
    },
}


def mhclo_uuid(fragment, subdir):
    path = DATA / subdir / fragment
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        if line.startswith('uuid '):
            return line.split()[1]
    return None


def human_info(spec):
    eyes_uuid = mhclo_uuid('high-poly/high-poly.mhclo', 'eyes')
    return {
        'name': spec['name'],
        'phenotype': spec['phenotype'],
        'rig': 'game_engine',
        'eyes': 'high-poly/high-poly.mhclo',
        'eyebrows': spec['eyebrows'],
        'eyelashes': spec['eyelashes'],
        'teeth': 'teeth_base/teeth_base.mhclo',
        'tongue': 'tongue01/tongue01.mhclo',
        'hair': spec['hair'],
        'proxy': '',
        'targets': [],
        'clothes': spec['clothes'],
        'skin_mhmat': spec['skin'],
        # MAKESKIN is a plain principled material the glTF exporter understands; the SSS skins do not export.
        'skin_material_type': 'MAKESKIN',
        'eyes_material_type': 'MAKESKIN',
        'clothes_material_type': 'MAKESKIN',
        'skin_material_settings': {},
        'eyes_material_settings': {},
        'alternative_materials': {eyes_uuid: 'materials/brown.mhmat'} if eyes_uuid else {},
        'expressions': [],
    }


def settings():
    s = HumanService.get_default_deserialization_settings()
    s['subdiv_levels'] = 0  # no subdivision: the browser draws the base mesh
    s['material_instances'] = 'NEVER'
    return s


def armature_of(basemesh):
    return basemesh.parent if basemesh.parent and basemesh.parent.type == 'ARMATURE' else None


def parts_of(rig):
    return [o for o in rig.children_recursive if o.type == 'MESH']


LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def save_image(name, w, h, px):
    folder = DERIVED / 'textures'
    folder.mkdir(parents=True, exist_ok=True)
    out = bpy.data.images.new(name, w, h, alpha=True)
    out.pixels.foreach_set(np.ascontiguousarray(px, dtype=np.float32).ravel())
    out.filepath_raw = str(folder / f'{name}.png')
    out.file_format = 'PNG'
    out.save()
    return out


def pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return w, h, px.reshape(h, w, 4)


def toned_image(img, rgb, label, contrast=1.0):
    """Grey-scale copy of a texture with its mean set to mid-grey and multiplied by rgb: keeps folds and weave,
    replaces the colour. contrast < 1 flattens marks such as the jeans' rips. Written to assets/derived/people-v1/textures."""
    w, h, px = pixels(img)
    lum = px[..., :3] @ LUMA
    mean = max(float(lum.mean()), 1e-3)
    lum = mean + (lum - mean) * contrast
    lum = np.clip(lum / mean * 0.62, 0.0, 1.0)
    px[..., :3] = np.clip(lum[..., None] * np.array(rgb, dtype=np.float32) / 0.62 * 0.95, 0.0, 1.0)
    return save_image(label, w, h, px)


def coil_texture(img, root_rgb, tip_rgb, label):
    """afro01 is an opaque scalp cap with a woven pattern plus a band of real curl strands (the bottom of the texture,
    which is the first rows in Blender's bottom-up pixels). Tile the strands over the cap so it reads as coils, then
    colour strands and gaps: near-black with brown highlights for Ayanda, silver on dark for salt-and-pepper."""
    w, h, px = pixels(img)
    lum = px[..., :3] @ LUMA
    alpha = px[..., 3]
    strip = int(h * 0.27)
    strands = lum[:strip] * alpha[:strip]
    strands = strands / max(float(strands.max()), 1e-3)
    tiled = np.tile(strands, (int(np.ceil(h / strip)), 1))[:h]
    tiled = np.maximum(tiled, np.roll(tiled, w // 3, axis=1) * 0.85)  # a second offset layer closes the gaps
    cap = (alpha > 0.85) & (np.arange(h)[:, None] > strip)
    own = np.clip(lum / max(float(lum.max()), 1e-3), 0.0, 1.0)
    strand = np.where(cap, tiled, own)[..., None]
    px[..., :3] = np.array(root_rgb, dtype=np.float32) * (1 - strand) + np.array(tip_rgb, dtype=np.float32) * strand
    return save_image(label, w, h, px)


def linen_maps(person, rgb, size=512, seed=7):
    """A procedural linen weave (colour and OpenGL normal map), generated here so it needs no licence."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    weave = 0.5 + 0.25 * np.sin(xx * np.pi / 2) * np.sin(yy * np.pi / 2)
    slub = rng.normal(0, 1, (size, size)).astype(np.float32)
    for _ in range(3):  # cheap blur: irregular thicker threads
        slub = (slub + np.roll(slub, 1, 0) + np.roll(slub, 1, 1) + np.roll(slub, -1, 0)) / 4
    height = weave + 0.35 * slub
    shade = 0.92 + 0.08 * (height - height.mean()) / max(float(height.std()), 1e-3) * 0.5
    col = np.ones((size, size, 4), dtype=np.float32)
    col[..., :3] = np.clip(np.array(rgb, dtype=np.float32) * shade[..., None], 0, 1)
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.6
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.6
    n = np.stack([-gx, -gy, np.ones_like(gx)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    nrm = np.ones((size, size, 4), dtype=np.float32)
    nrm[..., :3] = n * 0.5 + 0.5
    return save_image(f'{person}_linen_diffuse', size, size, col), save_image(f'{person}_linen_normal', size, size, nrm)


def _occlusion_group():
    """glTF exports an occlusion map only through a node group named 'glTF Material Output'."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g:
        return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def simplify_material(mat, cutout=False):
    """MakeHuman's MAKESKIN graph routes textures through legacy mix and bump nodes the glTF exporter does not
    follow. Rewire to the plain pattern it does: colour texture -> Base Color (alpha -> Alpha), normal map ->
    Normal, AO texture -> 'glTF Material Output'. Cut-out parts (hair, brows, lashes) get alpha > 0.5, which
    exports as alphaMode MASK and avoids sorting problems."""
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return
    diff = nodes.get('diffuseTexture')
    nrm_tex = nodes.get('normalmapTexture')
    nrm = nodes.get('normalmap')
    ao = nodes.get('aomapTexture')
    for name in ('diffuseIntensity', 'aoMix', 'bumpmap'):
        if nodes.get(name):
            nodes.remove(nodes[name])
    if diff:
        links.new(diff.outputs['Color'], bsdf.inputs['Base Color'])
        if cutout:
            gate = nodes.new('ShaderNodeMath')
            gate.operation = 'GREATER_THAN'
            gate.inputs[1].default_value = 0.5
            links.new(diff.outputs['Alpha'], gate.inputs[0])
            links.new(gate.outputs['Value'], bsdf.inputs['Alpha'])
        elif bsdf.inputs['Alpha'].is_linked:
            links.remove(bsdf.inputs['Alpha'].links[0])
            bsdf.inputs['Alpha'].default_value = 1.0
    if nrm_tex and nrm:
        links.new(nrm_tex.outputs['Color'], nrm.inputs['Color'])
        links.new(nrm.outputs['Normal'], bsdf.inputs['Normal'])
    if ao and ao.image:
        ao.image.colorspace_settings.name = 'Non-Color'
        occ = nodes.new('ShaderNodeGroup')
        occ.node_tree = _occlusion_group()
        links.new(ao.outputs['Color'], occ.inputs['Occlusion'])


def retone(obj, tone, person):
    """tone is an sRGB-ish colour, or {'rgb': ..., 'contrast': ...}, or {'coils': (root, tip)} for hair."""
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree:
            continue
        tex = mat.node_tree.nodes.get('diffuseTexture')
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        label = f'{person}_{mat.name}'.replace('.', '_')
        spec = tone if isinstance(tone, dict) else {'rgb': tone}
        if tex and tex.image and 'coils' in spec:
            tex.image = coil_texture(tex.image, *spec['coils'], label)
        elif tex and tex.image:
            tex.image = toned_image(tex.image, spec['rgb'], label, spec.get('contrast', 1.0))
        elif bsdf and not bsdf.inputs['Base Color'].is_linked:
            bsdf.inputs['Base Color'].default_value = (*spec['rgb'], 1.0)


def plain_material(name, rgb, roughness=0.85):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except (AttributeError, TypeError):
        pass
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def split_by_height(obj, cut_z, above):
    """Faces whose centre is above cut_z (above=True) or below it; returns their indices."""
    me = obj.data
    return [p.index for p in me.polygons if (p.center.z > cut_z) == above]


def delete_faces(obj, indices):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in indices], context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


CUTOUT_PARTS = ('afro', 'hair', 'eyebrow', 'eyelash', 'optical')  # glasses: frames stay, lens area drops out


def coil_coverage(root_rgb, tip_rgb, label, size=512, seed=11):
    """Strand-density texture for the hair shells: small curls (ring fragments) scattered at random, coloured from
    root to tip; alpha is the curl coverage, so each shell's cut-off decides how sparse it looks."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    cover = np.zeros((size, size), dtype=np.float32)
    for _ in range(900):
        cx, cy = rng.uniform(0, size, 2)
        r = rng.uniform(3.0, 7.0)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        ring = np.clip(1.0 - np.abs(d - r) / 1.3, 0.0, 1.0)
        start = rng.uniform(0, 2 * math.pi)
        ang = (np.arctan2(yy - cy, xx - cx) - start) % (2 * math.pi)
        cover = np.maximum(cover, ring * (ang < rng.uniform(3.5, 5.6)))
    px = np.ones((size, size, 4), dtype=np.float32)
    t = cover[..., None]
    px[..., :3] = np.array(root_rgb, dtype=np.float32) * (1 - t) + np.array(tip_rgb, dtype=np.float32) * t
    px[..., 3] = cover
    return save_image(label, size, size, px)


def add_hair_shells(hair, head, coils, person, layers=4):
    """Real-time fur shells: copies of the hair cap pushed outward in steps, each cut by a higher alpha threshold, so
    the outline becomes a soft, uneven coil volume instead of a smooth cap. They share the cap's weights and parent."""
    root, tip = coils
    image = coil_coverage(root, tip, f'{person}_coil_cover')
    for i in range(1, layers + 1):
        shell = hair.copy()
        shell.data = hair.data.copy()
        shell.name = f'{hair.name}.shell{i}'
        for col in hair.users_collection:
            col.objects.link(shell)
        me = shell.data
        me.update()
        for v in me.vertices:
            v.co += (v.co - head).normalized() * 0.0045 * i
        mat = bpy.data.materials.new(f'{person}_hair_shell{i}')
        try:
            mat.use_nodes = True
        except (AttributeError, TypeError):
            pass
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Roughness'].default_value = 0.65
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        gate = nodes.new('ShaderNodeMath')
        gate.operation = 'GREATER_THAN'
        gate.inputs[1].default_value = 0.25 + 0.15 * i
        links.new(tex.outputs['Alpha'], gate.inputs[0])
        links.new(gate.outputs['Value'], bsdf.inputs['Alpha'])
        me.materials.clear()
        me.materials.append(mat)
        uv = me.uv_layers.active
        if uv:  # a different scatter per shell, so curls do not stack in lines
            for d in uv.data:
                d.uv = (d.uv[0] * 3.0 + 0.37 * i, d.uv[1] * 3.0 + 0.21 * i)


def add_apron(person, basemesh, rig, height, rgb):
    """An oatmeal bib apron shaped on the body: ray casts find the body's front; the bib follows the chest, the skirt
    hangs straight across both legs at the most forward point of each row, like cloth. Each vertex copies the deform
    weights of the nearest body vertex, so the apron moves with the rig."""
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    # The front of the torso comes from the body's own rest vertices, leaving out anything weighted to the arms: in
    # MakeHuman's A-pose rest the forearms, hands and the shirt's cuffs sit in front of the hips, and ray casts
    # against them wrapped the apron around the hands. The bib clears the loose shirt with a fixed allowance.
    arm_bones = ('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky', 'clavicle')
    arm_groups = {g.index for g in basemesh.vertex_groups if g.name.startswith(arm_bones)}
    mw = basemesh.matrix_world
    torso = np.array([tuple(mw @ v.co) for v in basemesh.data.vertices
                      if sum(g.weight for g in v.groups if g.group in arm_groups) < 0.3], dtype=np.float32)
    print(f'apron: {len(arm_groups)} arm groups, {len(torso)} torso vertices of {len(basemesh.data.vertices)}')
    rows, cols = 24, 15
    shirt_allowance, skirt_allowance = 0.05, 0.03
    top = height * 0.79  # the bib reaches the upper chest, as in the reference

    def front_hit(x, z):
        near = torso[(np.abs(torso[:, 0] - x) < 0.03) & (np.abs(torso[:, 2] - z) < 0.015)]
        return float(near[:, 1].min()) if len(near) else None
    waist, bottom = height * 0.58, height * 0.31

    def half_width(z):
        if z >= waist:  # bib: narrower toward the chest
            t = (z - waist) / (top - waist)
            return 0.20 - 0.08 * t
        return 0.20 + 0.05 * (waist - z) / (waist - bottom)

    grid = []
    for r in range(rows):
        z = top - (top - bottom) * r / (rows - 1)
        hw = half_width(z)
        hits = [front_hit(-hw + 2 * hw * c / (cols - 1), z) for c in range(cols)]
        valid = [h for h in hits if h is not None]
        front = min(valid) if valid else -0.12
        # Below the waist the cloth hangs: soft vertical folds that deepen toward the hem.
        hang = max(0.0, (waist - z) / (waist - bottom))
        row = []
        for c, h in enumerate(hits):
            x = -hw + 2 * hw * c / (cols - 1)
            follow = z >= waist - 0.04 and h is not None
            fold = 0.011 * hang * math.sin(x * 2 * math.pi / 0.13 + 0.7)
            y = (h - shirt_allowance if follow else front - skirt_allowance) + fold
            row.append((x, y, z))
        grid.append(row)
    verts = [Vector(v) for row in grid for v in row]
    faces = [(r * cols + c, r * cols + c + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c) for r in range(rows - 1) for c in range(cols - 1)]
    # Neck straps: a 2.2 cm band from each top corner of the bib up to the side of the neck.
    neck_z = height * 0.855
    neck_front = front_hit(0.0, neck_z) or grid[0][cols // 2][1]
    for corner in (0, cols - 1):
        cx, cy, cz = grid[0][corner]
        side = -1 if corner == 0 else 1
        tx, ty = side * 0.055, neck_front + 0.035
        start = len(verts)
        for k in range(7):
            t = k / 6
            x, y, z = cx + (tx - cx) * t, cy + (ty - cy) * t, cz + (neck_z - cz) * t
            verts.extend([Vector((x - side * 0.011, y, z)), Vector((x + side * 0.011, y, z))])
        faces.extend((start + 2 * k, start + 2 * k + 1, start + 2 * k + 3, start + 2 * k + 2) for k in range(6))
    me = bpy.data.meshes.new(f'{person}_apron')
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    uv = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (v.x * 4.0, v.z * 4.0)  # the weave repeats every 25 cm
    for p in me.polygons:
        p.use_smooth = True
    apron = bpy.data.objects.new(f'{rig.name}.apron', me)
    for col in rig.users_collection:
        col.objects.link(apron)
    mat = plain_material(f'{person}_apron', rgb, roughness=0.9)
    diffuse, normal = linen_maps(person, rgb)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = diffuse
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    ntex = nodes.new('ShaderNodeTexImage')
    ntex.image = normal
    normal.colorspace_settings.name = 'Non-Color'
    nmap = nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = 0.6
    links.new(ntex.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    me.materials.append(mat)
    # Weights: nearest body vertex (rest positions), deform groups only.
    bones = {b.name for b in rig.data.bones}
    kd = KDTree(len(basemesh.data.vertices))
    for v in basemesh.data.vertices:
        kd.insert(mw @ v.co, v.index)
    kd.balance()
    groups = {g.index: g.name for g in basemesh.vertex_groups if g.name in bones}
    targets = {name: apron.vertex_groups.new(name=name) for name in groups.values()}
    for v in me.vertices:
        _co, idx, _d = kd.find(v.co)
        for g in basemesh.data.vertices[idx].groups:
            if g.group in groups and g.weight > 0.0001:
                targets[groups[g.group]].add([v.index], g.weight, 'REPLACE')
    apron.parent = rig
    apron.matrix_parent_inverse = rig.matrix_world.inverted()
    mod = apron.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    return apron


def build(person, spec):
    basemesh = HumanService.deserialize_from_dict(human_info(spec), settings())
    rig = armature_of(basemesh)
    if rig is None:
        raise RuntimeError(f'{person}: MPFB returned no armature')
    height = max((rig.matrix_world @ Vector(c)).z for c in basemesh.bound_box)
    waist = height * 0.585
    for obj in parts_of(rig):
        name = obj.name.lower()
        for slot in obj.material_slots:
            if slot.material and slot.material.node_tree:
                simplify_material(slot.material, cutout=any(k in name for k in CUTOUT_PARTS))
        for key, rgb in spec['tone'].items():
            if key in name:
                retone(obj, rgb, person)
        if 'afro' in name:
            # The afro01 cap sits close to the scalp; the references show a fuller rounded volume.
            head = sum((Vector(c) for c in obj.bound_box), Vector()) / 8
            for v in obj.data.vertices:
                v.co = head + (v.co - head) * spec.get('hair_volume', 1.12)
            add_hair_shells(obj, head, spec['tone']['afro']['coils'], person)
        if 'cardigan' in name:
            # Push the overshirt 4 mm out so the tee underneath cannot poke through at the shoulders.
            obj.data.update()
            for v in obj.data.vertices:
                v.co += v.normal * 0.004
        if 'shoes' in name:
            # Shoe ankle geometry protrudes through the trouser legs. Trim the
            # upper part inside the trousers; preserve the visible shoe below.
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                   dist=0.00001, plane_co=(0, 0, 0.10), plane_no=(0, 0, 1),
                                   clear_outer=True, clear_inner=False)
            bm.to_mesh(obj.data)
            bm.free()
        if 'casualsuit' in name:
            top = split_by_height(obj, waist, True)
            if spec['suit_top'] == 'delete':
                delete_faces(obj, top)
            else:
                obj.data.materials.append(plain_material(f'{person}_tee', spec['suit_top']))
                slot = len(obj.data.materials) - 1
                for i in top:
                    obj.data.polygons[i].material_index = slot
                # The long-sleeved tee protrudes through the overshirt when the
                # arm rises. Remove its hidden outer sleeves, retain front tee.
                if spec.get('hide_outer_sleeves'):
                    obj.data.update()
                    hidden_sleeves = [p.index for p in obj.data.polygons
                                      if p.center.z > height * 0.585 and abs(p.center.x) > 0.15]
                    delete_faces(obj, hidden_sleeves)
        if 'cardigan' in name and 'cardigan_hem' in spec:
            delete_faces(obj, split_by_height(obj, height * spec['cardigan_hem'], False))
    if 'apron' in spec:
        apron = add_apron(person, basemesh, rig, height, spec['apron'])
        # Fit the bib to the actual shirt, not the hidden body. Keep the hanging
        # skirt untouched; pulling it inward causes trouser and shirt clipping.
        # It fits to the top the person wears: the work shirt where there is one, else the casual suit's own top.
        shirt = (next((o for o in parts_of(rig) if 'elvs_male_shirt' in o.name.lower()), None)
                 or next((o for o in parts_of(rig) if 'casualsuit' in o.name.lower()), None))
        if shirt is None:
            raise RuntimeError(f'{person}: apron fitting requires a top to fit to')
        arm_names = ('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky', 'clavicle')
        arm_groups = {g.index for g in shirt.vertex_groups if g.name.startswith(arm_names)}
        points = np.array([tuple(v.co) for v in shirt.data.vertices
                           if sum(g.weight for g in v.groups if g.group in arm_groups) < 0.25])
        for row in range(11):
            row_verts = list(apron.data.vertices)[row * 15:(row + 1) * 15]
            samples = []
            for i, v in enumerate(row_verts):
                near = points[(np.abs(points[:, 0] - v.co.x) < 0.025) &
                              (np.abs(points[:, 2] - v.co.z) < 0.025)]
                if len(near):
                    samples.append((i, float(near[:, 1].min()) - 0.012))
            if samples:
                for i, v in enumerate(row_verts):
                    v.co.y = float(np.interp(i, [x[0] for x in samples], [x[1] for x in samples]))
        apron.data.update()
    return basemesh, rig, height


# From MakeHuman's A-pose rest (elbows bent about 35 degrees) to arms hanging relaxed at the sides. Axes follow MPFB's
# own game_engine t-pose (upperarm Z raises the arm) and the previews: lowerarm +X deepens the elbow bend, upperarm +X
# swings the arm forward (0.05 brought the hands together in front, -0.12 hid them behind the hips).
BASE_POSE = {
    'upperarm_l': (0.0, 0.0, -0.55), 'upperarm_r': (0.0, 0.0, 0.55),
    'lowerarm_l': (-0.15, 0.0, 0.0), 'lowerarm_r': (-0.15, 0.0, 0.0),
    'clavicle_l': (0.0, 0.0, -0.05), 'clavicle_r': (0.0, 0.0, 0.05),
    'hand_l': (0.0, 0.0, 0.0), 'hand_r': (0.0, 0.0, 0.0),
    'spine_01': (0.0, 0.0, 0.0), 'spine_02': (0.0, 0.0, 0.0), 'spine_03': (0.0, 0.0, 0.0),
    'neck_01': (0.0, 0.0, 0.0), 'head': (0.0, 0.0, 0.0), 'pelvis': (0.0, 0.0, 0.0),
}


def relax_arms(rig):
    for bone, euler in BASE_POSE.items():
        pb = rig.pose.bones.get(bone)
        if pb:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = euler


def _add(pose, bone, dx=0.0, dy=0.0, dz=0.0):
    x, y, z = pose[bone]
    pose[bone] = (x + dx, y + dy, z + dz)


def _clip_idle(t):
    p = dict(BASE_POSE)
    breath, sway = math.sin(2 * math.pi * t), math.sin(2 * math.pi * t + 0.6)
    _add(p, 'spine_02', dx=0.012 * breath)
    _add(p, 'spine_03', dx=0.010 * breath)
    _add(p, 'neck_01', dx=0.006 * breath, dy=0.010 * sway)
    _add(p, 'head', dx=0.010 * sway, dy=0.025 * math.sin(2 * math.pi * t + 1.9))
    _add(p, 'pelvis', dy=0.012 * sway)
    _add(p, 'upperarm_l', dz=0.010 * breath)
    _add(p, 'upperarm_r', dz=-0.010 * breath)
    return p


def _clip_listen(t):
    p = _clip_idle(t)
    w = math.sin(2 * math.pi * t)
    _add(p, 'head', dx=0.07 + 0.02 * w, dy=0.05, dz=0.09)
    _add(p, 'neck_01', dx=0.03, dz=0.03)
    _add(p, 'spine_03', dx=0.03)
    return p


def _clip_speak(t):
    p = _clip_idle(t)
    a = 2 * math.pi * t
    _add(p, 'head', dx=0.04 * math.sin(2 * a), dy=0.04 * math.sin(a))
    p['upperarm_r'] = (0.35 + 0.08 * math.sin(a), 0.0, 0.62)
    p['lowerarm_r'] = (0.55 + 0.25 * math.sin(a + 1.0), 0.0, 0.0)
    p['hand_r'] = (0.20 * math.sin(a), 0.0, 0.0)
    p['upperarm_l'] = (0.12, 0.0, -0.76)
    p['lowerarm_l'] = (0.15 + 0.10 * math.sin(a + 2.0), 0.0, 0.0)
    return p


def _clip_point(t):
    """Bounded one-shot: ease into an index-finger gesture, hold, return to idle.

    This is an illustrative gesture, not a sign-language animation.
    """
    p = _clip_idle(t)
    def ease(x):
        x = max(0.0, min(1.0, x))
        return x * x * (3.0 - 2.0 * x)
    k = ease(t / 0.30) * ease((1.0 - t) / 0.35)
    targets = {'upperarm_r': (1.25, 0.0, 0.60), 'lowerarm_r': (-0.55, 0.0, 0.0)}
    for bone, target in targets.items():
        p[bone] = tuple(start + (end - start) * k for start, end in zip(p[bone], target))
    _add(p, 'head', dy=0.22 * k)
    # Index remains extended; the other fingers curl and return to rest.
    for finger in ('middle', 'ring', 'pinky'):
        for joint in (1, 2, 3):
            p[f'{finger}_{joint:02d}_r'] = (0.8 * k, 0.0, 0.0)
    return p


def _clip_acknowledge(t):
    p = _clip_idle(t)
    _add(p, 'head', dx=0.12 * math.sin(math.pi * t) ** 2)
    _add(p, 'spine_03', dx=0.02 * math.sin(math.pi * t))
    return p


# Clip names match the earlier scene state machine. Point and acknowledge are one-shot gestures.
CLIPS = {'idle': (120, _clip_idle), 'listen': (90, _clip_listen), 'speak': (90, _clip_speak),
         'point': (60, _clip_point), 'acknowledge': (45, _clip_acknowledge)}

FACE_KEYS = {'viseme_aa', 'viseme_CH', 'viseme_DD', 'viseme_E', 'viseme_FF', 'viseme_I', 'viseme_kk', 'viseme_nn', 'viseme_O',
             'viseme_PP', 'viseme_RR', 'viseme_sil', 'viseme_SS', 'viseme_TH', 'viseme_U',
             'eyeBlinkLeft', 'eyeBlinkRight', 'mouthSmileLeft', 'mouthSmileRight', 'browInnerUp', 'jawOpen'}


def author_clips(rig):
    rig.animation_data_create()
    created = []
    for name, (frames, fn) in CLIPS.items():
        act = bpy.data.actions.new(name)
        created.append(act)
        act.use_fake_user = True
        rig.animation_data.action = act
        for f in range(0, frames + 1, 2):
            for bone, euler in fn(f / frames).items():
                pb = rig.pose.bones.get(bone)
                if pb:
                    pb.rotation_mode = 'XYZ'
                    pb.rotation_euler = euler
                    pb.keyframe_insert('rotation_euler', frame=f)
    rig.animation_data.action = created[0]
    return created


def keep_face_keys(rig):
    """Drop every shape key except the mouth shapes and the few face units the app drives (bodies arrive with 52
    ARKit units; morph targets cost download size per vertex)."""
    dropped = 0
    for obj in [rig] + list(rig.children_recursive):
        keys = getattr(obj.data, 'shape_keys', None) if obj.type == 'MESH' else None
        if not keys:
            continue
        for kb in list(keys.key_blocks):
            if kb != keys.reference_key and kb.name not in FACE_KEYS:
                obj.shape_key_remove(kb)
                dropped += 1
    return dropped


def export_person(person, basemesh):
    copy = ExportService.create_character_copy(basemesh, name_suffix='.export')
    base = ObjectService.find_object_of_type_amongst_nearest_relatives(copy)
    TargetService.bake_targets(base)
    FaceService.load_targets(base, load_microsoft_visemes=False, load_meta_visemes=True, load_arkit_faceunits=True)
    FaceService.interpolate_targets(base)
    ExportService.bake_modifiers_remove_helpers(base, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=True)
    dropped = keep_face_keys(copy)
    actions = author_clips(copy)
    images = {n.image for o in copy.children_recursive if o.type == 'MESH' for s in o.material_slots if s.material and s.material.node_tree
              for n in s.material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
    for img in images:
        if img.size[0] > 1024 or img.size[1] > 1024:
            img.scale(min(1024, img.size[0]), min(1024, img.size[1]))
    for o in bpy.context.view_layer.objects:
        o.select_set(o == copy or o in copy.children_recursive)
    WEB.mkdir(parents=True, exist_ok=True)
    path = WEB / f'{person}-preview-v3.glb'
    wanted = {
        'filepath': str(path), 'export_format': 'GLB', 'use_selection': True, 'export_apply': False,
        'export_yup': True, 'export_skins': True, 'export_def_bones': True, 'export_leaf_bone': False,
        'export_morph': True, 'export_morph_normal': False, 'export_morph_tangent': False, 'export_try_sparse_sk': True,
        'export_animations': True, 'export_animation_mode': 'ACTIONS', 'export_force_sampling': True,
        'export_optimize_animation_size': True, 'export_image_format': 'WEBP', 'export_image_quality': 85,
        'export_materials': 'EXPORT', 'export_cameras': False, 'export_lights': False, 'export_extras': False,
    }
    valid = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    missing = sorted(set(wanted) - valid)
    if missing:
        print(f'glTF exporter does not know: {missing}')
    bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in valid})
    # Avoid leaking the first character's actions into the next GLB export.
    for action in actions:
        bpy.data.actions.remove(action, do_unlink=True)
    # Export copies must not remain visible in the subsequent studio lineup.
    for obj in reversed(list(copy.children_recursive)):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(copy, do_unlink=True)
    print(f'exported {path.name}: {path.stat().st_size / 1048576:.1f} MB, dropped {dropped} unused shape keys')
    return path


def studio(people):
    scene = bpy.context.scene
    world = bpy.data.worlds.new('studio')
    scene.world = world
    try:
        world.use_nodes = True
    except (AttributeError, TypeError):
        pass
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.6, 0.58, 1.0)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    for name, loc, energy, size in (('key', (-2.5, -3.0, 3.2), 900, 2.5), ('fill', (3.0, -2.5, 2.0), 350, 3.0), ('rim', (0.0, 3.0, 3.0), 500, 2.0)):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.size = energy, size
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = loc
        light.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam_data = bpy.data.cameras.new('lineup')
    cam_data.lens = 50
    cam = bpy.data.objects.new('lineup', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0.0, -4.6, 1.15)
    cam.rotation_euler = (Vector((0.0, 0.0, 0.95)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 900
    scene.view_settings.view_transform = 'AgX'


def main():
    opts = args()
    bpy.ops.wm.read_homefile(use_empty=True)
    built = {}
    for i, (person, spec) in enumerate(PEOPLE.items()):
        basemesh, rig, height = build(person, spec)
        relax_arms(rig)
        rig.location.x = -0.55 if i == 0 else 0.55
        built[person] = (basemesh, rig, height)
        print(f'built {person}: height {height:.2f} m, parts {sorted(o.name for o in parts_of(rig))}')
    DERIVED.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(DERIVED / 'people.blend'))
    if opts['export']:
        for person, (basemesh, rig, height) in built.items():
            rig.location.x = 0.0  # export at the origin; the courtyard places them
            export_person(person, basemesh)
            rig.location.x = -0.55 if person == 'ayanda' else 0.55
    if opts['preview']:
        studio(built)
        out = DERIVED / 'renders'
        out.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.filepath = str(out / 'lineup.png')
        bpy.ops.render.render(write_still=True)
        print('rendered lineup')


try:
    main()
except Exception as exc:
    import traceback
    traceback.print_exc()
    print(f'build_people failed: {exc}')
    sys.exit(1)

