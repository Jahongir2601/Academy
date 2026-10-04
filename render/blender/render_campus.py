# O‘zbekiston Markaziy Banki Akademiyasi — Blender (Cycles) fotorealistik render skripti.
#
# Foydalanish:
#   blender -b --python render/blender/render_campus.py -- \
#       --glb exports/akademiya-kampus.glb --out render/out \
#       --views aerial,entrance,courtyard --samples 160 --res 1920x1080
#
# Skript GLB maketni import qiladi, materiallarni nomi bo‘yicha PBR materiallarga almashtiradi,
# daraxtlarga barg, yaqin kadrlarda o‘t qo‘shadi, Toshkent uchun quyosh/osmonni sozlaydi
# va har bir ko‘rinishni PNG ga render qiladi.
#
# Koordinatalar: three.js (x, y, z) → Blender (x, −z, y). Blender’da +Y shimol, +X sharq.

import argparse
import math
import os
import random
import sys
import time

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- argumentlar
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--glb', default='exports/akademiya-kampus.glb')
ap.add_argument('--out', default='render/out')
ap.add_argument('--views', default='all')
ap.add_argument('--samples', type=int, default=160)
ap.add_argument('--res', default='1920x1080')
ap.add_argument('--grass-density', type=float, default=26.0)
ap.add_argument('--leaf-density', type=float, default=52.0)
ap.add_argument('--threads', type=int, default=0)
ap.add_argument('--save-blend', default='')
ap.add_argument('--format', default='PNG', choices=['PNG', 'JPEG'])
ARGS = ap.parse_args(argv)

T0 = time.time()


def log(msg):
    print(f'[{time.time() - T0:7.1f}s] {msg}', flush=True)


def bl(x, y, z):
    """three.js koordinatasini Blender koordinatasiga."""
    return Vector((x, -z, y))


# ---------------------------------------------------------------- quyosh (NOAA)
LAT, LON, TZ = 41.3111, 69.2797, 5


def sun_position(doy, hours):
    g = 2 * math.pi / 365 * (doy - 1 + (hours - 12) / 24)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                    - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    decl = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
            + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    tst = hours * 60 + eqt + 4 * LON - 60 * TZ
    ha = math.radians(tst / 4 - 180)
    phi = math.radians(LAT)
    cz = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(ha)
    zen = math.acos(max(-1, min(1, cz)))
    alt = 90 - math.degrees(zen)
    az = (math.degrees(math.atan2(math.sin(ha), math.cos(ha) * math.sin(phi) - math.tan(decl) * math.cos(phi))) + 180) % 360
    return alt, az


# ---------------------------------------------------------------- ko‘rinishlar
# pos/target three.js koordinatalarida; doy — yil kuni; hour — mahalliy vaqt (UTC+5)
VIEWS = {
    'aerial': dict(pos=(-165, 240, 330), target=(14, 0, -30), lens=36, doy=266, hour=17.0, grass=False,
                   title='Kampus umumiy ko‘rinishi — kuzgi kech'),
    'entrance': dict(pos=(22, 1.65, 140), target=(0, 1.65, 98), lens=22, shift=0.12, doy=266, hour=15.75, grass=True,
                     title='Ceremonial Entrance va Grand Academy Hall'),
    'courtyard': dict(pos=(0, 8.4, 25.3), target=(0, 1.0, -24), lens=24, doy=266, hour=9.3, grass=True,
                      title='Academy Courtyard — chorbog‘, Knowledge Centre terrasasidan'),
    'arcade': dict(pos=(76.6, 1.6, -24), target=(77.0, 1.6, -60), lens=24, shift=0.06, doy=266, hour=10.3, grass=True,
                   title='Sharqiy ravoq — soyali promenada'),
    'dusk': dict(pos=(-24, 1.3, 148), target=(16, 1.3, 98), lens=24, shift=0.15, doy=172, hour=20.72, grass=False, night=True,
                 title='Grand Academy Hall — oqshom'),
    'garden': dict(pos=(-120, 14, -147), target=(-60, 2, -110), lens=28, doy=172, hour=17.5, grass=True,
                   title='Research Institute va Scholars’ Garden'),
}

# ---------------------------------------------------------------- sahna
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
log('GLB import')
bpy.ops.import_scene.gltf(filepath=os.path.abspath(ARGS.glb))
imported = [o for o in scene.objects if o.type == 'MESH']
log(f'{len(imported)} ta mesh obyekt')

# bir mesh ichida ustma-ust tushgan yassi orollar (yo‘l kesishmalari) Cycles’da qora chiqadi — har biriga 2 mm qavat
GROUND = {'paving', 'pavingWarm', 'asphalt', 'court', 'courtLine'}
n_up = 0
for o in imported:
    if o.data.users > 1 or not any(s.material and s.material.name.split('.')[0] in GROUND for s in o.material_slots):
        continue
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.faces.ensure_lookup_table()
    seen, isls = set(), []
    for f in bm.faces:
        if f.index in seen or f.normal.z < 0.99:
            continue
        st, isl = [f], set()
        while st:
            g = st.pop()
            if g.index in seen:
                continue
            seen.add(g.index)
            isl.add(g)
            st += [h for e in g.edges for h in e.link_faces if h.normal.z > 0.99 and h.index not in seen]
        vs = {v for g in isl for v in g.verts}
        isls.append((sum(g.calc_area() for g in isl), vs, min(v.co.x for v in vs), min(v.co.y for v in vs),
                     max(v.co.x for v in vs), max(v.co.y for v in vs), round(sum(v.co.z for v in vs) / len(vs), 4)))
    isls.sort(key=lambda r: -r[0])  # katta maydonlar pastda, kichik kesishmalar ustida
    lev = []
    for i, a in enumerate(isls):
        used = {lev[j] for j, b in enumerate(isls[:i]) if abs(a[6] - b[6]) < 1e-4
                and a[2] < b[4] - 1e-3 and b[2] < a[4] - 1e-3 and a[3] < b[5] - 1e-3 and b[3] < a[5] - 1e-3}
        k = 0
        while k in used:
            k += 1
        lev.append(k)
        if k:
            n_up += 1
            for v in a[1]:
                v.co.z += 0.002 * k
    bm.to_mesh(o.data)
    bm.free()
log(f'ustma-ust yer orollari ko‘tarildi: {n_up}')


# ---------------------------------------------------------------- material yordamchilari
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)
    return m, nt, out


def principled(nt, out, **kw):
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.location = (300, 0)
    for k, v in kw.items():
        if k in b.inputs:
            b.inputs[k].default_value = v
    nt.links.new(b.outputs[0], out.inputs['Surface'])
    return b


def node(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in props.items():
        if k.startswith('in_'):
            n.inputs[k[3:]].default_value = v
        else:
            setattr(n, k, v)
    return n


def link(nt, a, b):
    nt.links.new(a, b)


def image_of(mat_name):
    """Asl GLB materialidagi rasm teksturasi (tosh choklari, deraza ramkalari uchun)."""
    m = bpy.data.materials.get(mat_name)
    if not m or not m.use_nodes:
        return None, None
    img = emis = None
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            for l in n.outputs['Color'].links:
                sock = l.to_socket.name
                if 'Emission' in sock:
                    emis = n.image
                else:
                    img = n.image
    return img, emis


def uv_scale_of(name):
    """GLB KHR_texture_transform importda Mapping node’ga yoziladi — o‘sha masshtabni qaytaramiz."""
    m = bpy.data.materials.get(name)
    for n in (m.node_tree.nodes if m and m.use_nodes else []):
        if n.type == 'MAPPING':
            return tuple(n.inputs['Scale'].default_value)
    return (1.0, 1.0, 1.0)


def uv_tex(nt, img, loc, scale=(1, 1, 1), noncolor=False):
    t = node(nt, 'ShaderNodeTexImage', loc)
    t.image = img
    if noncolor:
        t.image.colorspace_settings.name = 'Non-Color'
    uv = node(nt, 'ShaderNodeUVMap', (loc[0] - 400, loc[1]))
    mp = node(nt, 'ShaderNodeMapping', (loc[0] - 200, loc[1]))
    mp.inputs['Scale'].default_value = scale
    link(nt, uv.outputs[0], mp.inputs[0])
    link(nt, mp.outputs[0], t.inputs[0])
    return t


def noise(nt, loc, scale=5.0, detail=6.0, rough=0.6, coord=None):
    n = node(nt, 'ShaderNodeTexNoise', loc)
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    if coord is not None:
        link(nt, coord, n.inputs['Vector'])
    return n


def bump(nt, height_out, strength, loc, normal_in=None):
    b = node(nt, 'ShaderNodeBump', loc)
    b.inputs['Strength'].default_value = strength
    link(nt, height_out, b.inputs['Height'])
    if normal_in is not None:
        link(nt, normal_in, b.inputs['Normal'])
    return b


def ramp(nt, fac, stops, loc):
    r = node(nt, 'ShaderNodeValToRGB', loc)
    el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0]
    el[1].position, el[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        e = el.new(pos)
        e.color = col
    link(nt, fac, r.inputs[0])
    return r


def rgba(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    # sRGB → chiziqli
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)


def mix_rgb(nt, a, b, fac, blend, loc):
    """ShaderNodeMix (RGBA) — soketlarni identifikator bo‘yicha olamiz (nomlar takrorlanadi)."""
    m = node(nt, 'ShaderNodeMix', loc, data_type='RGBA', blend_type=blend)
    ins = {s.identifier: s for s in m.inputs}
    outs = {s.identifier: s for s in m.outputs}
    ins['Factor_Float'].default_value = fac
    if isinstance(a, tuple):
        ins['A_Color'].default_value = a
    else:
        link(nt, a, ins['A_Color'])
    if isinstance(b, tuple):
        ins['B_Color'].default_value = b
    else:
        link(nt, b, ins['B_Color'])
    return outs['Result_Color']


def obj_random(nt, loc):
    oi = node(nt, 'ShaderNodeObjectInfo', loc)
    return oi.outputs['Random']


# ---------------------------------------------------------------- materiallar
MATS = {}


def mat_stone(name, tint, rough=0.78):
    img, _ = image_of(name)
    m, nt, out = new_mat(name + '_pbr')
    tc = node(nt, 'ShaderNodeTexCoord', (-1200, 0))
    b = principled(nt, out, Roughness=rough)
    n1 = noise(nt, (-700, 200), scale=0.9, detail=8, rough=0.65, coord=tc.outputs['Object'])
    n2 = noise(nt, (-700, -100), scale=28, detail=4, rough=0.7, coord=tc.outputs['Object'])
    col = ramp(nt, n1.outputs['Fac'], [(0.3, tuple(c * 0.86 for c in tint[:3]) + (1,)), (0.7, tint)], (-450, 200))
    base = col.outputs[0]
    if img:
        t = uv_tex(nt, img, (-450, 450), scale=uv_scale_of(name))
        # tekstura yuzasi ~0.72 (chiziqli): normallaymiz — plita yuzasi = tint, choklar ~0.75·tint
        tn = node(nt, 'ShaderNodeVectorMath', (-250, 450), operation='SCALE', in_Scale=1.38)
        link(nt, t.outputs['Color'], tn.inputs[0])
        base = mix_rgb(nt, col.outputs[0], tn.outputs['Vector'], 1.0, 'MULTIPLY', (-150, 300))
        h = node(nt, 'ShaderNodeMath', (-150, -250), operation='ADD')
        link(nt, t.outputs['Color'], h.inputs[0])
        link(nt, n2.outputs['Fac'], h.inputs[1])
        bp = bump(nt, h.outputs[0], 0.35, (100, -250))
        bv = node(nt, 'ShaderNodeBevel', (-100, -450), samples=4)
        bv.inputs['Radius'].default_value = 0.012
        link(nt, bv.outputs['Normal'], bp.inputs['Normal'])
    else:
        bp = bump(nt, n2.outputs['Fac'], 0.2, (100, -250))
    # tag qismi (0–0.5 m) biroz to‘qroq — yer bilan kontakt / sachrash
    geo = node(nt, 'ShaderNodeNewGeometry', (-1200, -450))
    sz = node(nt, 'ShaderNodeSeparateXYZ', (-1000, -450))
    link(nt, geo.outputs['Position'], sz.inputs[0])
    gr = ramp(nt, sz.outputs['Z'], [(0.0, (0.82, 0.8, 0.77, 1)), (0.5, (1, 1, 1, 1))], (-800, -450))
    base = mix_rgb(nt, base, gr.outputs[0], 1.0, 'MULTIPLY', (50, 300))
    link(nt, base, b.inputs['Base Color'])
    link(nt, bp.outputs[0], b.inputs['Normal'])
    rr = ramp(nt, n2.outputs['Fac'], [(0.3, (rough - 0.08,) * 3 + (1,)), (0.7, (min(1, rough + 0.1),) * 3 + (1,))], (-150, -50))
    link(nt, rr.outputs[0], b.inputs['Roughness'])
    return m


def mat_glass_windows():
    img, emis = image_of('glass')
    m, nt, out = new_mat('glass_pbr')
    b = principled(nt, out, Roughness=0.04, Metallic=0.0, IOR=1.52)
    b.inputs['Specular IOR Level'].default_value = 0.7
    if img:
        t = uv_tex(nt, img, (-500, 200))
        dark = mix_rgb(nt, t.outputs['Color'], rgba('#3a4a52'), 1.0, 'MULTIPLY', (-150, 200))
        link(nt, dark, b.inputs['Base Color'])
        # ramka chiziqlari matoviyroq
        sep = node(nt, 'ShaderNodeRGBToBW', (-150, -50))
        link(nt, t.outputs['Color'], sep.inputs[0])
        rr = ramp(nt, sep.outputs[0], [(0.15, (0.45, 0.45, 0.45, 1)), (0.3, (0.03, 0.03, 0.03, 1))], (50, -50))
        link(nt, rr.outputs[0], b.inputs['Roughness'])
    if emis:
        te = uv_tex(nt, emis, (-500, -350))
        warm = mix_rgb(nt, te.outputs['Color'], rgba('#ffd2a0'), 1.0, 'MULTIPLY', (-200, -350))
        link(nt, warm, b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.0
    MATS['glass_emission'] = b
    return m


def mat_simple(name, **kw):
    m, nt, out = new_mat(name)
    principled(nt, out, **kw)
    return m


def mat_glass_plain():
    m, nt, out = new_mat('glassPlain_pbr')
    b = principled(nt, out, Roughness=0.02, IOR=1.52)
    b.inputs['Base Color'].default_value = rgba('#1c2a31')
    b.inputs['Specular IOR Level'].default_value = 0.8
    b.inputs['Emission Color'].default_value = rgba('#ffd49a')
    b.inputs['Emission Strength'].default_value = 0.0
    MATS['glassPlain_emission'] = b
    return m


def mat_metal(name, col, rough):
    m, nt, out = new_mat(name)
    b = principled(nt, out, Metallic=1.0, Roughness=rough)
    b.inputs['Base Color'].default_value = rgba(col)
    tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    n = noise(nt, (-600, 0), scale=12, detail=6, coord=tc.outputs['Object'])
    rr = ramp(nt, n.outputs['Fac'], [(0.35, (rough * 0.7,) * 3 + (1,)), (0.65, (rough * 1.4,) * 3 + (1,))], (-300, 0))
    link(nt, rr.outputs[0], b.inputs['Roughness'])
    return m


def mat_wood():
    m, nt, out = new_mat('wood_pbr')
    b = principled(nt, out, Roughness=0.55)
    tc = node(nt, 'ShaderNodeTexCoord', (-1000, 0))
    w = node(nt, 'ShaderNodeTexWave', (-700, 200), wave_profile='SAW', bands_direction='X')
    w.inputs['Scale'].default_value = 2.0      # ~16 sm reykalar
    w.inputs['Distortion'].default_value = 0.4
    w.inputs['Detail'].default_value = 2
    link(nt, tc.outputs['Object'], w.inputs['Vector'])
    slat = ramp(nt, w.outputs['Fac'], [(0.0, (1, 1, 1, 1)), (0.86, (1, 1, 1, 1)), (0.9, (0.15, 0.15, 0.15, 1))], (-450, 200))
    slat.color_ramp.interpolation = 'CONSTANT'
    gmp = node(nt, 'ShaderNodeMapping', (-800, -150))
    gmp.inputs['Scale'].default_value = (40, 1.5, 40)   # tola reyka bo‘ylab (Y) cho‘zilgan
    link(nt, tc.outputs['Object'], gmp.inputs[0])
    gn = noise(nt, (-600, -150), scale=1.0, detail=4, coord=gmp.outputs[0])
    col = ramp(nt, gn.outputs['Fac'], [(0.3, rgba('#6b4a30')), (0.7, rgba('#8f6643'))], (-350, -150))
    base = mix_rgb(nt, col.outputs[0], slat.outputs[0], 1.0, 'MULTIPLY', (-100, 100))
    link(nt, base, b.inputs['Base Color'])
    bp = bump(nt, slat.outputs[0], 0.3, (0, -250))
    link(nt, bp.outputs[0], b.inputs['Normal'])
    return m


def mat_paving(name, tint, scale):
    img, _ = image_of(name)
    m, nt, out = new_mat(name + '_pbr')
    b = principled(nt, out, Roughness=0.82)
    tc = node(nt, 'ShaderNodeTexCoord', (-1200, 0))
    n = noise(nt, (-800, 200), scale=0.15, detail=6, coord=tc.outputs['Object'])
    col = ramp(nt, n.outputs['Fac'], [(0.35, tuple(c * 0.85 for c in tint[:3]) + (1,)), (0.65, tint)], (-500, 200))
    if img:
        t = uv_tex(nt, img, (-500, 450), scale=uv_scale_of(name))
        mixed = mix_rgb(nt, col.outputs[0], t.outputs['Color'], 0.9, 'MULTIPLY', (-150, 300))
        link(nt, mixed, b.inputs['Base Color'])
        bp = bump(nt, t.outputs['Color'], 0.35, (100, -250))
        link(nt, bp.outputs[0], b.inputs['Normal'])
    else:
        link(nt, col.outputs[0], b.inputs['Base Color'])
    return m


def mat_asphalt():
    m, nt, out = new_mat('asphalt_pbr')
    b = principled(nt, out, Roughness=1.0)
    b.inputs['Specular IOR Level'].default_value = 0.3
    tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    n = noise(nt, (-600, 150), scale=60, detail=8, rough=0.8, coord=tc.outputs['Object'])
    n2 = noise(nt, (-600, -150), scale=0.25, detail=4, coord=tc.outputs['Object'])
    col = ramp(nt, n.outputs['Fac'], [(0.3, rgba('#3b3c3c')), (0.7, rgba('#5a5957'))], (-300, 150))
    mixed = mix_rgb(nt, col.outputs[0], n2.outputs['Fac'], 0.4, 'MULTIPLY', (-50, 150))
    link(nt, mixed, b.inputs['Base Color'])
    bp = bump(nt, n.outputs['Fac'], 0.3, (100, -250))
    link(nt, bp.outputs[0], b.inputs['Normal'])
    return m


def mat_grass_ground():
    m, nt, out = new_mat('grass_pbr')
    b = principled(nt, out, Roughness=0.95)
    tc = node(nt, 'ShaderNodeTexCoord', (-1000, 0))
    n = noise(nt, (-700, 200), scale=0.08, detail=8, coord=tc.outputs['Object'])
    n2 = noise(nt, (-700, -100), scale=40, detail=6, rough=0.8, coord=tc.outputs['Object'])
    col = ramp(nt, n.outputs['Fac'], [(0.25, rgba('#4a5f2c')), (0.55, rgba('#62773a')), (0.8, rgba('#8a8a4e'))], (-400, 200))
    mixed = mix_rgb(nt, col.outputs[0], n2.outputs['Fac'], 0.35, 'MULTIPLY', (-100, 200))
    link(nt, mixed, b.inputs['Base Color'])
    bp = bump(nt, n2.outputs['Fac'], 0.6, (100, -250))
    link(nt, bp.outputs[0], b.inputs['Normal'])
    return m


def mat_water(name, deep, shallow):
    m, nt, out = new_mat(name + '_pbr')
    b = principled(nt, out, Roughness=0.03, IOR=1.33)
    b.inputs['Specular IOR Level'].default_value = 0.5
    lw = node(nt, 'ShaderNodeLayerWeight', (-450, 250), in_Blend=0.35)
    wc = mix_rgb(nt, rgba(shallow), rgba(deep), 0.5, 'MIX', (-200, 250))
    link(nt, lw.outputs['Facing'], {s.identifier: s for s in wc.node.inputs}['Factor_Float'])
    link(nt, wc, b.inputs['Base Color'])
    tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    mp = node(nt, 'ShaderNodeMapping', (-700, 0))
    mp.inputs['Scale'].default_value = (1, 1.6, 1)
    link(nt, tc.outputs['Object'], mp.inputs[0])
    n1 = noise(nt, (-450, 0), scale=9, detail=2, rough=0.5, coord=mp.outputs[0])
    n2 = noise(nt, (-450, -200), scale=35, detail=3, rough=0.5, coord=mp.outputs[0])
    ad = node(nt, 'ShaderNodeMath', (-250, -100), operation='ADD')
    link(nt, n1.outputs['Fac'], ad.inputs[0])
    link(nt, n2.outputs['Fac'], ad.inputs[1])
    bp = bump(nt, ad.outputs[0], 0.15, (0, -200))
    bp.inputs['Distance'].default_value = 0.01
    link(nt, bp.outputs[0], b.inputs['Normal'])
    return m


def mat_leaf():
    m, nt, out = new_mat('leaf_pbr')
    attr = node(nt, 'ShaderNodeAttribute', (-1000, 200), attribute_type='INSTANCER', attribute_name='leafrand')
    orand = node(nt, 'ShaderNodeAttribute', (-1000, -50), attribute_type='INSTANCER', attribute_name='treerand').outputs['Fac']
    add = node(nt, 'ShaderNodeMath', (-800, 100), operation='MULTIPLY_ADD')
    add.inputs[1].default_value = 0.25
    link(nt, attr.outputs['Fac'], add.inputs[0])
    m2 = node(nt, 'ShaderNodeMath', (-800, -50), operation='MULTIPLY')
    m2.inputs[1].default_value = 0.75
    link(nt, orand, m2.inputs[0])
    link(nt, m2.outputs[0], add.inputs[2])
    col = ramp(nt, add.outputs[0], [(0.0, rgba('#2c4519')), (0.5, rgba('#3f6321')), (1.0, rgba('#5a7a2c'))], (-550, 100))
    b = node(nt, 'ShaderNodeBsdfPrincipled', (-150, 150))
    b.inputs['Roughness'].default_value = 0.55
    link(nt, col.outputs[0], b.inputs['Base Color'])
    tr = node(nt, 'ShaderNodeBsdfTranslucent', (-150, -150))
    link(nt, col.outputs[0], tr.inputs['Color'])
    mix = node(nt, 'ShaderNodeMixShader', (250, 0))
    mix.inputs['Fac'].default_value = 0.28
    link(nt, b.outputs[0], mix.inputs[1])
    link(nt, tr.outputs[0], mix.inputs[2])
    link(nt, mix.outputs[0], out.inputs['Surface'])
    return m


def mat_grass_blade():
    m, nt, out = new_mat('grassblade_pbr')
    attr = node(nt, 'ShaderNodeAttribute', (-1000, 200), attribute_type='INSTANCER', attribute_name='grassrand')
    col = ramp(nt, attr.outputs['Fac'], [(0.0, rgba('#3b521f')), (0.6, rgba('#5a742f')), (1.0, rgba('#8a8e48'))], (-600, 150))
    b = node(nt, 'ShaderNodeBsdfPrincipled', (-150, 150))
    b.inputs['Roughness'].default_value = 0.6
    link(nt, col.outputs[0], b.inputs['Base Color'])
    tr = node(nt, 'ShaderNodeBsdfTranslucent', (-150, -150))
    link(nt, col.outputs[0], tr.inputs['Color'])
    mix = node(nt, 'ShaderNodeMixShader', (250, 0))
    mix.inputs['Fac'].default_value = 0.3
    link(nt, b.outputs[0], mix.inputs[1])
    link(nt, tr.outputs[0], mix.inputs[2])
    link(nt, mix.outputs[0], out.inputs['Surface'])
    return m


def mat_solar():
    m, nt, out = new_mat('solar_pbr')
    b = principled(nt, out, Roughness=0.2, Metallic=0.0)
    b.inputs['Coat Weight'].default_value = 0.0
    b.inputs['Specular IOR Level'].default_value = 0.35
    tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    br = node(nt, 'ShaderNodeTexBrick', (-600, 0))
    br.inputs['Scale'].default_value = 6
    br.inputs['Mortar Size'].default_value = 0.02
    br.offset = 0.0
    br.inputs['Color1'].default_value = rgba('#0a101c')
    br.inputs['Color2'].default_value = rgba('#0d1524')
    br.inputs['Mortar'].default_value = rgba('#4a525c')
    link(nt, tc.outputs['Object'], br.inputs['Vector'])
    link(nt, br.outputs['Color'], b.inputs['Base Color'])
    return m


def mat_bark():
    m, nt, out = new_mat('bark_pbr')
    b = principled(nt, out, Roughness=0.9)
    tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    mp = node(nt, 'ShaderNodeMapping', (-700, 0))
    mp.inputs['Scale'].default_value = (6, 6, 1.2)
    link(nt, tc.outputs['Object'], mp.inputs[0])
    n = noise(nt, (-450, 0), scale=4, detail=8, rough=0.75, coord=mp.outputs[0])
    col = ramp(nt, n.outputs['Fac'], [(0.3, rgba('#4a3f33')), (0.7, rgba('#7d7062'))], (-200, 100))
    link(nt, col.outputs[0], b.inputs['Base Color'])
    bp = bump(nt, n.outputs['Fac'], 0.6, (50, -200))
    link(nt, bp.outputs[0], b.inputs['Normal'])
    return m


def mat_car():
    m, nt, out = new_mat('carPaint_pbr')
    r = obj_random(nt, (-700, 0))
    col = ramp(nt, r, [(0.0, rgba('#e9e9e6')), (0.2, rgba('#1c1e21')), (0.4, rgba('#8b9298')), (0.55, rgba('#b9bec3')),
                       (0.7, rgba('#2c4a72')), (0.85, rgba('#7a2b2b')), (1.0, rgba('#d8d2c4'))], (-450, 0))
    col.color_ramp.interpolation = 'CONSTANT'
    b = principled(nt, out, Roughness=0.25, Metallic=0.5)
    b.inputs['Coat Weight'].default_value = 1.0
    link(nt, col.outputs[0], b.inputs['Base Color'])
    return m


def mat_emissive(name, col, strength):
    m, nt, out = new_mat(name)
    b = principled(nt, out, Roughness=0.4)
    b.inputs['Base Color'].default_value = rgba('#f4efe4')
    b.inputs['Emission Color'].default_value = rgba(col)
    b.inputs['Emission Strength'].default_value = strength
    MATS[name + '_emission'] = b
    return m


def girih_image(size=256, width=0.035):
    """8 nurli girih panjara niqobi (glTF alphaMap’ni saqlamaydi — shu yerda qayta chizamiz)."""
    segs = []

    def star(cx, cy, R):
        pts = []
        for k in range(9):
            a = k * 3 * math.pi * 2 / 8 + math.pi / 8
            pts.append((cx + math.cos(a) * R, cy + math.sin(a) * R))
        for i in range(8):
            segs.append((pts[i], pts[i + 1]))

    for c in [(0, 0), (1, 0), (0, 1), (1, 1), (0.5, 0.5)]:
        star(c[0], c[1], 0.36)
    segs += [((0.5, 0), (0.5, 1)), ((0, 0.5), (1, 0.5)), ((0, 0), (1, 0)), ((0, 0), (0, 1)), ((1, 0), (1, 1)), ((0, 1), (1, 1))]

    def dseg(px, py, a, b):
        ax, ay = a
        bx, by = b
        vx, vy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
        return math.hypot(px - (ax + vx * t), py - (ay + vy * t))

    img = bpy.data.images.new('girih', size, size, alpha=True)
    px = []
    for j in range(size):
        for i in range(size):
            x, y = (i + 0.5) / size, (j + 0.5) / size
            d = min(dseg(x, y, a, b) for a, b in segs)
            v = 1.0 if d < width else 0.0
            px += (v, v, v, 1.0)
    img.pixels = px
    img.pack()
    return img


def mat_screen():
    """Girih panjara: bronza metall, naqsh alfa orqali."""
    img = girih_image()
    m, nt, out = new_mat('screen_pbr')
    b = principled(nt, out, Metallic=1.0, Roughness=0.45)
    tcp = node(nt, 'ShaderNodeTexCoord', (-900, 250))
    pn = noise(nt, (-700, 250), scale=3, detail=4, coord=tcp.outputs['Object'])
    pc = ramp(nt, pn.outputs['Fac'], [(0.3, rgba('#5a3f26')), (0.7, rgba('#7a5634'))], (-450, 250))
    link(nt, pc.outputs[0], b.inputs['Base Color'])
    pr = ramp(nt, pn.outputs['Fac'], [(0.3, (0.38, 0.38, 0.38, 1)), (0.7, (0.55, 0.55, 0.55, 1))], (-450, 0))
    link(nt, pr.outputs[0], b.inputs['Roughness'])
    if img:
        t = uv_tex(nt, img, (-500, -150))
        bw = node(nt, 'ShaderNodeRGBToBW', (-200, -150))
        link(nt, t.outputs['Color'], bw.inputs[0])
        gt = node(nt, 'ShaderNodeMath', (0, -150), operation='GREATER_THAN')
        gt.inputs[1].default_value = 0.5
        link(nt, bw.outputs[0], gt.inputs[0])
        link(nt, gt.outputs[0], b.inputs['Alpha'])
    return m


def mat_inscription():
    src = bpy.data.materials.get('inscription')
    img = None
    if src and src.use_nodes:
        for n in src.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                img = n.image
    m, nt, out = new_mat('inscription_pbr')
    b = principled(nt, out, Metallic=1.0, Roughness=0.4)
    b.inputs['Base Color'].default_value = rgba('#7a5833')
    if img:
        t = uv_tex(nt, img, (-500, -150))
        link(nt, t.outputs['Alpha'], b.inputs['Alpha'])
    return m


log('materiallar')
REPLACE = {
    'stone': mat_stone('stone', rgba('#d9c9aa')),
    'stoneWarm': mat_stone('stoneWarm', rgba('#dcc29c')),
    'stoneDark': mat_stone('stoneDark', rgba('#ad9a7c'), 0.82),
    'roof': mat_stone('roof', rgba('#8d8b85'), 0.92),
    'glass': mat_glass_windows(),
    'glassPlain': mat_glass_plain(),
    'bronze': mat_metal('bronze_pbr', '#5a4027', 0.4),
    'darkMetal': mat_metal('darkMetal_pbr', '#2c2f33', 0.42),
    'wood': mat_wood(),
    'screen': mat_screen(),
    'inscription': mat_inscription(),
    'grass': mat_grass_ground(),
    'paving': mat_paving('paving', rgba('#d6cdbd'), 1),
    'pavingWarm': mat_paving('pavingWarm', rgba('#cbb796'), 1),
    'asphalt': mat_asphalt(),
    'marking': mat_simple('marking_pbr', **{'Base Color': rgba('#e8e6df'), 'Roughness': 0.7}),
    'water': mat_water('water', '#0c262c', '#1f3d3b'),
    'pool': mat_water('pool', '#2b8aa0', '#6fd0dc'),
    'solar': mat_solar(),
    'court': mat_simple('court_pbr', **{'Base Color': rgba('#356e62'), 'Roughness': 0.85}),
    'courtLine': mat_simple('courtLine_pbr', **{'Base Color': rgba('#f2f0ea'), 'Roughness': 0.7}),
    'hedge': mat_leaf(),
    'trunk': mat_bark(),
    'crown': None,  # pastda — barglar bilan
    'lamp': mat_emissive('lamp_pbr', '#ffd8a0', 0.0),
    'fabric': mat_simple('fabric_pbr', **{'Base Color': rgba('#ece4d2'), 'Roughness': 0.9, 'Sheen Weight': 0.4}),
    'context': mat_simple('context_pbr', **{'Base Color': rgba('#d9d5cc'), 'Roughness': 0.92}),
    'carPaint': mat_car(),
}
LEAF = REPLACE['hedge']
def mat_core():
    m, nt, out = new_mat('leafCore_pbr')
    b = principled(nt, out, Roughness=0.95)
    tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    vo = node(nt, 'ShaderNodeTexVoronoi', (-650, 0), in_Scale=4.0)
    link(nt, tc.outputs['Object'], vo.inputs['Vector'])
    col = ramp(nt, vo.outputs['Distance'], [(0.0, rgba('#3b5a22')), (0.5, rgba('#2a431a')), (1.0, rgba('#1d3013'))], (-400, 100))
    link(nt, col.outputs[0], b.inputs['Base Color'])
    bp = bump(nt, vo.outputs['Distance'], 0.8, (-100, -200))
    link(nt, bp.outputs[0], b.inputs['Normal'])
    return m


CORE = mat_core()
BLADE = mat_grass_blade()

# daraxt tojlari va butalar — almashtirishdan oldin aniqlaymiz
TREE_OBJS = [o for o in imported if any(s.material and s.material.name.split('.')[0] in ('crown', 'hedge') for s in o.material_slots)]

slots_done = 0
for o in imported:
    for s in o.material_slots:
        if not s.material:
            continue
        base = s.material.name.split('.')[0]
        rep = REPLACE.get(base)
        if rep is not None:
            s.material = rep
            slots_done += 1
log(f'{slots_done} ta material sloti almashtirildi')

# ---------------------------------------------------------------- daraxtlar: barglar
log('barglar (geometry nodes)')


def split_loose(o):
    """Bitta mesh’ga birlashtirilgan butalarni (tom bog‘i) alohida obyektlarga ajratadi.
    Barg yadrosi obyekt markazi atrofida kichraytiriladi; markaz dunyo boshida qolsa,
    yadro butadan uzoqqa — havoga «uchib» ketadi."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    seen = set()
    parts = []
    for f in bm.faces:
        if f in seen:
            continue
        seen.add(f)
        stack, comp = [f], []
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for k in e.link_faces:
                    if k not in seen:
                        seen.add(k)
                        stack.append(k)
        parts.append(comp)
    out = []
    for i, comp in enumerate(parts):
        vs = {v for f in comp for v in f.verts}
        c = sum((v.co for v in vs), Vector()) / len(vs)
        nb = bmesh.new()
        vmap = {v: nb.verts.new(v.co - c) for v in vs}
        for f in comp:
            nb.faces.new([vmap[v] for v in f.verts]).material_index = f.material_index
        me = bpy.data.meshes.new(f'{o.data.name}.{i}')
        nb.to_mesh(me)
        nb.free()
        for m in o.data.materials:
            me.materials.append(m)
        no = bpy.data.objects.new(f'{o.name}.{i}', me)
        no.location = c
        for col in o.users_collection:
            col.objects.link(no)
        out.append(no)
    bm.free()
    bpy.data.objects.remove(o)
    return out


def origin_inside(o):
    if not o.data.vertices:
        return True
    vs = [v.co for v in o.data.vertices]
    return all(min(v[a] for v in vs) - 0.5 <= 0 <= max(v[a] for v in vs) + 0.5 for a in range(3))


split = [o for o in TREE_OBJS if not origin_inside(o)]
TREE_OBJS = [o for o in TREE_OBJS if origin_inside(o)]
for o in split:
    imported.remove(o)
    TREE_OBJS += split_loose(o)
log(f'daraxt tojlari va butalar: {len(TREE_OBJS)} ({len(split)} ta birlashgan mesh ajratildi)')


def leaf_mesh():
    me = bpy.data.meshes.new('leafShape')
    bm = bmesh.new()
    pts = [(0, -0.5), (0.32, -0.18), (0.36, 0.15), (0, 0.5), (-0.36, 0.15), (-0.32, -0.18)]
    vs = [bm.verts.new((x, y, 0)) for x, y in pts]
    bm.faces.new(vs)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('leafShape', me)
    scene.collection.objects.link(o)
    o.hide_render = True
    o.hide_viewport = True
    return o


LEAF_OBJ = leaf_mesh()


def build_leaf_group():
    ng = bpy.data.node_groups.new('Barglar', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes
    L = ng.links
    gi = N.new('NodeGroupInput')
    go = N.new('NodeGroupOutput')
    # toj shaklini notekis qilish: shovqin bo‘yicha normal yo‘nalishida siljitish
    sub = N.new('GeometryNodeSubdivideMesh')
    sub.inputs['Level'].default_value = 1
    L.new(gi.outputs[0], sub.inputs['Mesh'])
    npos = N.new('GeometryNodeInputPosition')
    ntex = N.new('ShaderNodeTexNoise')
    ntex.inputs['Scale'].default_value = 0.35
    ntex.inputs['Detail'].default_value = 3
    selfo = N.new('GeometryNodeSelfObject')
    oinf = N.new('GeometryNodeObjectInfo')
    L.new(selfo.outputs[0], oinf.inputs['Object'])
    padd = N.new('ShaderNodeVectorMath')
    padd.operation = 'ADD'
    L.new(npos.outputs[0], padd.inputs[0])
    L.new(oinf.outputs['Location'], padd.inputs[1])
    L.new(padd.outputs[0], ntex.inputs['Vector'])
    wn = N.new('ShaderNodeTexWhiteNoise')
    L.new(oinf.outputs['Location'], wn.inputs['Vector'])
    seedm = N.new('ShaderNodeMath')
    seedm.operation = 'MULTIPLY'
    seedm.inputs[1].default_value = 9973
    L.new(wn.outputs['Value'], seedm.inputs[0])
    nsub = N.new('ShaderNodeMath')
    nsub.operation = 'MULTIPLY_ADD'
    nsub.inputs[1].default_value = 2.6
    nsub.inputs[2].default_value = -1.3
    L.new(ntex.outputs['Fac'], nsub.inputs[0])
    nnorm = N.new('GeometryNodeInputNormal')
    noff = N.new('ShaderNodeVectorMath')
    noff.operation = 'SCALE'
    L.new(nnorm.outputs[0], noff.inputs[0])
    L.new(nsub.outputs[0], noff.inputs['Scale'])
    lumpy = N.new('GeometryNodeSetPosition')
    L.new(sub.outputs[0], lumpy.inputs['Geometry'])
    L.new(noff.outputs[0], lumpy.inputs['Offset'])
    dist = N.new('GeometryNodeDistributePointsOnFaces')
    dist.inputs['Density'].default_value = ARGS.leaf_density
    L.new(lumpy.outputs[0], dist.inputs['Mesh'])
    L.new(seedm.outputs[0], dist.inputs['Seed'])
    # barglarni tojning ichiga/tashqarisiga tarqatish (hajm va notekis silueti uchun)
    rnd_off = N.new('FunctionNodeRandomValue')
    rnd_off.data_type = 'FLOAT'
    rnd_off.inputs['Min'].default_value = -0.95
    rnd_off.inputs['Max'].default_value = 0.45
    nrm_scale = N.new('ShaderNodeVectorMath')
    nrm_scale.operation = 'SCALE'
    L.new(dist.outputs['Normal'], nrm_scale.inputs[0])
    L.new(rnd_off.outputs['Value'], nrm_scale.inputs['Scale'])
    setpos = N.new('GeometryNodeSetPosition')
    L.new(dist.outputs['Points'], setpos.inputs['Geometry'])
    L.new(nrm_scale.outputs[0], setpos.inputs['Offset'])
    leaf = N.new('GeometryNodeObjectInfo')
    leaf.inputs['Object'].default_value = LEAF_OBJ
    inst = N.new('GeometryNodeInstanceOnPoints')
    L.new(setpos.outputs[0], inst.inputs['Points'])
    L.new(leaf.outputs['Geometry'], inst.inputs['Instance'])
    L.new(dist.outputs['Rotation'], inst.inputs['Rotation'])
    rs = N.new('FunctionNodeRandomValue')
    rs.data_type = 'FLOAT'
    rs.inputs['Min'].default_value = 0.12
    rs.inputs['Max'].default_value = 0.22
    L.new(rs.outputs['Value'], inst.inputs['Scale'])
    rot = N.new('GeometryNodeRotateInstances')
    rr = N.new('FunctionNodeRandomValue')
    rr.data_type = 'FLOAT_VECTOR'
    rr.inputs['Min'].default_value = (-0.9, -0.9, -3.2)
    rr.inputs['Max'].default_value = (0.9, 0.9, 3.2)
    L.new(inst.outputs[0], rot.inputs['Instances'])
    L.new(rr.outputs['Value'], rot.inputs['Rotation'])
    store = N.new('GeometryNodeStoreNamedAttribute')
    store.data_type = 'FLOAT'
    store.domain = 'INSTANCE'
    store.inputs['Name'].default_value = 'leafrand'
    rv = N.new('FunctionNodeRandomValue')
    rv.data_type = 'FLOAT'
    L.new(rot.outputs[0], store.inputs['Geometry'])
    L.new(rv.outputs['Value'], store.inputs['Value'])
    setm = N.new('GeometryNodeSetMaterial')
    setm.inputs['Material'].default_value = LEAF
    store2 = N.new('GeometryNodeStoreNamedAttribute')
    store2.data_type = 'FLOAT'
    store2.domain = 'INSTANCE'
    store2.inputs['Name'].default_value = 'treerand'
    L.new(store.outputs[0], store2.inputs['Geometry'])
    L.new(wn.outputs['Value'], store2.inputs['Value'])
    L.new(store2.outputs[0], setm.inputs['Geometry'])
    # ichki qorong‘i yadro (orqasi ko‘rinmasligi uchun)
    core_t = N.new('GeometryNodeTransform')
    core_t.inputs['Scale'].default_value = (0.62, 0.62, 0.62)
    L.new(lumpy.outputs[0], core_t.inputs['Geometry'])
    corem = N.new('GeometryNodeSetMaterial')
    corem.inputs['Material'].default_value = CORE
    L.new(core_t.outputs[0], corem.inputs['Geometry'])
    join = N.new('GeometryNodeJoinGeometry')
    L.new(setm.outputs[0], join.inputs[0])
    L.new(corem.outputs[0], join.inputs[0])
    L.new(join.outputs[0], go.inputs[0])
    return ng


LEAF_NG = build_leaf_group()
n_trees = 0
for o in TREE_OBJS:
    if True:
        # mesh’ni har bir daraxt uchun alohida qilib, masshtabni mesh’ga qo‘llaymiz —
        # aks holda barglar teralik masshtab bilan cho‘zilib ketadi
        if o.data.users > 1:
            o.data = o.data.copy()
        s = o.matrix_world.to_scale()
        o.data.transform(Matrix.Diagonal((s.x, s.y, s.z, 1.0)))
        loc, rotq, _ = o.matrix_world.decompose()
        o.matrix_world = Matrix.LocRotScale(loc, rotq, Vector((1, 1, 1)))
        mod = o.modifiers.new('Barglar', 'NODES')
        mod.node_group = LEAF_NG
        n_trees += 1
log(f'{n_trees} ta toj/butaga barg qo‘shildi')

# shoxlar: tana uchidan tojning ichiga qarab yo‘nalgan konussimon silindrlar
BARK = REPLACE['trunk']
bm_all = bmesh.new()
rb = random.Random(42)
n_br = 0
for o in TREE_OBJS:
    if not any(s.material is CORE or s.material is LEAF for s in o.material_slots) and not o.modifiers:
        continue
    bb = [o.matrix_world @ v.co for v in o.data.vertices]
    if not bb:
        continue
    mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    size = mx - mn
    if mn.z < 0.8 or size.z < 2.5:
        continue  # butalar va tom bog‘lari
    c = (mn + mx) / 2
    base = Vector((c.x, c.y, mn.z + size.z * 0.12))
    rad = min(size.x, size.y) / 2
    nb = 5 if rad > 2.5 else 3
    for k in range(nb):
        a0 = rb.random() * math.tau
        tip = Vector((c.x + math.cos(a0) * rad * rb.uniform(0.45, 0.8),
                      c.y + math.sin(a0) * rad * rb.uniform(0.45, 0.8),
                      mn.z + size.z * rb.uniform(0.45, 0.8)))
        d = tip - base
        L = d.length
        r0 = max(0.06, rad * 0.035)
        res = bmesh.ops.create_cone(bm_all, cap_ends=False, segments=7, radius1=r0, radius2=r0 * 0.35, depth=L)
        rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(bm_all, matrix=Matrix.Translation(base + d / 2) @ rot, verts=res['verts'])
        n_br += 1
me_br = bpy.data.meshes.new('shoxlar')
bm_all.to_mesh(me_br)
bm_all.free()
ob_br = bpy.data.objects.new('shoxlar', me_br)
scene.collection.objects.link(ob_br)
ob_br.data.materials.append(BARK)
for poly in me_br.polygons:
    poly.use_smooth = True
log(f'{n_br} ta shox')

# ---------------------------------------------------------------- yer, kontekst, tog‘lar
log('yer va tog‘lar')
bpy.ops.mesh.primitive_plane_add(size=160000, location=(0, 0, -0.08))
ground = bpy.context.active_object
ground.name = 'kontekst-yer'
gm, gnt, gout = new_mat('field_pbr')
gb = principled(gnt, gout, Roughness=0.95)
gtc = node(gnt, 'ShaderNodeTexCoord', (-900, 0))
gn1 = noise(gnt, (-600, 150), scale=0.004, detail=6, coord=gtc.outputs['Object'])
gn2 = noise(gnt, (-600, -150), scale=0.05, detail=6, coord=gtc.outputs['Object'])
gcol = ramp(gnt, gn1.outputs['Fac'], [(0.3, rgba('#6f6a48')), (0.5, rgba('#857e5c')), (0.7, rgba('#5f6b3c'))], (-300, 150))
gmix = mix_rgb(gnt, gcol.outputs[0], gn2.outputs['Fac'], 0.3, 'MULTIPLY', (-50, 150))
link(gnt, gmix, gb.inputs['Base Color'])
ground.data.materials.append(gm)

# shimoli-sharqdagi tog‘ tizmasi (G‘arbiy Tyan-Shan etaklari)
me = bpy.data.meshes.new('toglar')
verts, faces = [], []
seg, rows = 120, 6
rnd = random.Random(1234)
for j in range(rows + 1):
    for i in range(seg + 1):
        a = math.radians(-10 + i / seg * 110)
        d = 38000 + j * 5000
        ridge = max(0, math.sin(i * 0.16) * 0.5 + math.sin(i * 0.05 + 1) * 0.8 + math.sin(i * 0.41) * 0.25 + 0.7)
        hgt = 0 if j == 0 else 2.0 * (300 + ridge * 700 + rnd.random() * 140) * (j / rows) ** 0.6 * (0.6 + 0.4 * math.sin(i / seg * math.pi))
        verts.append(bl(math.sin(a) * d, hgt - 20, -math.cos(a) * d))
for j in range(rows):
    for i in range(seg):
        a = j * (seg + 1) + i
        faces.append((a, a + 1, a + seg + 2, a + seg + 1))
me.from_pydata(verts, [], faces)
me.update()
mt = bpy.data.objects.new('toglar', me)
scene.collection.objects.link(mt)
mtm, mtnt, mtout = new_mat('mountain_pbr')
mtb = principled(mtnt, mtout, Roughness=1.0)
mtb.inputs['Base Color'].default_value = rgba('#8c8a80')
mt.data.materials.append(mtm)

# shahar konteksti (bloklar + ko‘cha daraxtlari) va havo perspektivasi
HAZE = []


def add_haze(mat, start=250.0, end=6000.0, maxf=0.65):
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    surf = out.inputs['Surface'].links[0].from_socket
    cd = nt.nodes.new('ShaderNodeCameraData')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = start
    mr.inputs['From Max'].default_value = end
    mr.inputs['To Max'].default_value = maxf
    nt.links.new(cd.outputs['View Distance'], mr.inputs['Value'])
    em = nt.nodes.new('ShaderNodeEmission')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mr.outputs['Result'], mix.inputs['Fac'])
    nt.links.new(surf, mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    HAZE.append(em)


ctxm = REPLACE['context']
cnt = ctxm.node_tree
cpb = next(n for n in cnt.nodes if n.type == 'BSDF_PRINCIPLED')
cpb.inputs['Roughness'].default_value = 0.9
cattr = node(cnt, 'ShaderNodeAttribute', (-700, 0), attribute_type='GEOMETRY', attribute_name='blk')
ccol = ramp(cnt, cattr.outputs['Fac'], [(0.0, rgba('#857d70')), (0.35, rgba('#9a9387')), (0.65, rgba('#8f8576')), (1.0, rgba('#a8a092'))], (-450, 0))
link(cnt, ccol.outputs[0], cpb.inputs['Base Color'])
rc = random.Random(77)
bmc, bmt = bmesh.new(), bmesh.new()
blk_layer = bmc.faces.layers.float.new('blk')
placed = []  # (x0, x1, z0, z1) — bloklar bir-birining ustiga chiqmasin (bir tekislikdagi tomlar qora chiqadi)
for _ in range(2600):
    r, a = rc.uniform(300, 2600), rc.uniform(0, math.tau)
    x, z = math.cos(a) * r, math.sin(a) * r
    if (abs(x) < 250 and abs(z) < 210) or (148 < z < 176 and abs(x) < 760):
        continue
    w_, d_ = rc.uniform(14, 44), rc.uniform(12, 26)
    turn = rc.choice((0.0, math.pi / 2))
    ex, ez = (w_, d_) if turn == 0.0 else (d_, w_)
    fx = (x - ex / 2 - 3, x + ex / 2 + 3, z - ez / 2 - 3, z + ez / 2 + 3)
    if any(fx[0] < q[1] and q[0] < fx[1] and fx[2] < q[3] and q[2] < fx[3] for q in placed):
        continue
    placed.append(fx)
    h_ = rc.choice((5, 8, 11, 14, 14, 17, 20, 27, 36)) + rc.uniform(0.1, 0.9)
    res = bmesh.ops.create_cube(bmc, size=1.0)
    M = Matrix.Translation(bl(x, h_ / 2, z)) @ Matrix.Rotation(turn + rc.uniform(-0.03, 0.03), 4, 'Z') @ Matrix.Diagonal((w_, d_, h_, 1.0))
    bmesh.ops.transform(bmc, matrix=M, verts=res['verts'])
    tone = rc.random()
    for f in {f for v in res['verts'] for f in v.link_faces}:
        f[blk_layer] = tone
for _ in range(3000):
    r, a = rc.uniform(260, 2600), rc.uniform(0, math.tau)
    x, z = math.cos(a) * r, math.sin(a) * r
    if abs(x) < 240 and abs(z) < 200:
        continue
    if any(q[0] < x < q[1] and q[2] < z < q[3] for q in placed):
        continue  # daraxt bino ichida bo‘lmasin
    rr_ = rc.uniform(2.5, 5.0)
    res = bmesh.ops.create_icosphere(bmt, subdivisions=2, radius=rr_)
    bmesh.ops.translate(bmt, vec=bl(x, rr_ * 0.95, z), verts=res['verts'])
for f in bmt.faces:
    f.smooth = True
for nm_, bmx, mat_ in (('shahar', bmc, ctxm), ('shahar-daraxt', bmt, CORE)):
    mex = bpy.data.meshes.new(nm_)
    bmx.to_mesh(mex)
    bmx.free()
    ox = bpy.data.objects.new(nm_, mex)
    scene.collection.objects.link(ox)
    ox.data.materials.append(mat_)
for m_ in (gm, mtm, ctxm, CORE):
    add_haze(m_)

# ---------------------------------------------------------------- o‘t (faqat yaqin kadrlar uchun)
log('o‘t')


def grass_clump():
    me = bpy.data.meshes.new('grassClump')
    bm = bmesh.new()
    r = random.Random(7)
    for _ in range(14):
        x, y = (r.random() - 0.5) * 0.22, (r.random() - 0.5) * 0.22
        h = 0.06 + r.random() * 0.1
        w = 0.008 + r.random() * 0.006
        ang = r.random() * math.pi
        lean = (r.random() - 0.5) * 0.06
        dx, dy = math.cos(ang) * w, math.sin(ang) * w
        v1 = bm.verts.new((x - dx, y - dy, 0))
        v2 = bm.verts.new((x + dx, y + dy, 0))
        v3 = bm.verts.new((x + lean, y + lean * 0.5, h))
        bm.faces.new((v1, v2, v3))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('grassClump', me)
    scene.collection.objects.link(o)
    o.hide_render = True
    o.hide_viewport = True
    o.data.materials.append(BLADE)
    return o


CLUMP = grass_clump()
grass_objs = [o for o in imported if any(s.material is REPLACE['grass'] for s in o.material_slots)]
cover_col = bpy.data.collections.new('qoplamalar')
scene.collection.children.link(cover_col)
bpy.context.view_layer.layer_collection.children['qoplamalar'].exclude = True
grass_set = set(grass_objs)
for o in imported:
    if o in grass_set or o.modifiers:
        continue
    # faqat yerga yaqin obyektlar (yo‘lak, yo‘l, suv, bino tagi) — o‘t ulardan chiqib qolmasligi uchun
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    if min(v.z for v in bb) < 0.6:
        cover_col.objects.link(o)
log(f'o‘t qatlamlari: {len(grass_objs)}, qoplamalar: {len(cover_col.objects)}')

CAM_TARGET = bpy.data.objects.new('grassCenter', None)
scene.collection.objects.link(CAM_TARGET)


def build_grass_group():
    ng = bpy.data.node_groups.new('Ot', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes
    L = ng.links
    gi = N.new('NodeGroupInput')
    go = N.new('NodeGroupOutput')
    radv = N.new('ShaderNodeValue')
    radv.name = 'RadiusValue'
    radv.outputs[0].default_value = 70.0
    sub = N.new('GeometryNodeSubdivideMesh')
    sub.inputs['Level'].default_value = 6
    L.new(gi.outputs['Geometry'], sub.inputs['Mesh'])
    cen = N.new('GeometryNodeObjectInfo')
    cen.transform_space = 'RELATIVE'
    cen.inputs['Object'].default_value = CAM_TARGET
    pos = N.new('GeometryNodeInputPosition')
    dist = N.new('ShaderNodeVectorMath')
    dist.operation = 'DISTANCE'
    L.new(pos.outputs[0], dist.inputs[0])
    L.new(cen.outputs['Location'], dist.inputs[1])
    far = N.new('FunctionNodeCompare')
    far.data_type = 'FLOAT'
    far.operation = 'GREATER_THAN'
    L.new(dist.outputs['Value'], far.inputs['A'])
    L.new(radv.outputs[0], far.inputs['B'])
    dele = N.new('GeometryNodeDeleteGeometry')
    dele.domain = 'FACE'
    L.new(sub.outputs[0], dele.inputs['Geometry'])
    L.new(far.outputs[0], dele.inputs['Selection'])
    # masofa bo‘yicha zichlik
    fall = N.new('ShaderNodeMapRange')
    L.new(dist.outputs['Value'], fall.inputs['Value'])
    L.new(radv.outputs[0], fall.inputs['From Max'])
    fall.inputs['From Min'].default_value = 8.0
    fall.inputs['To Min'].default_value = 1.0
    fall.inputs['To Max'].default_value = 0.15
    dens = N.new('ShaderNodeMath')
    dens.operation = 'MULTIPLY'
    dens.inputs[1].default_value = ARGS.grass_density
    L.new(fall.outputs['Result'], dens.inputs[0])
    dpf = N.new('GeometryNodeDistributePointsOnFaces')
    L.new(dele.outputs[0], dpf.inputs['Mesh'])
    L.new(dens.outputs[0], dpf.inputs['Density'])
    # qoplama tagidagi nuqtalarni olib tashlash (pastdan yuqoriga nur)
    col = N.new('GeometryNodeCollectionInfo')
    col.transform_space = 'RELATIVE'
    col.inputs['Collection'].default_value = cover_col
    real = N.new('GeometryNodeRealizeInstances')
    L.new(col.outputs[0], real.inputs[0])
    ppos = N.new('GeometryNodeInputPosition')
    below = N.new('ShaderNodeVectorMath')
    below.operation = 'ADD'
    below.inputs[1].default_value = (0, 0, -0.012)
    L.new(ppos.outputs[0], below.inputs[0])
    ray = N.new('GeometryNodeRaycast')
    L.new(real.outputs[0], ray.inputs['Target Geometry'])
    L.new(below.outputs[0], ray.inputs['Source Position'])
    ray.inputs['Ray Direction'].default_value = (0, 0, 1)
    ray.inputs['Ray Length'].default_value = 0.6
    keep = N.new('GeometryNodeDeleteGeometry')
    keep.domain = 'POINT'
    L.new(dpf.outputs['Points'], keep.inputs['Geometry'])
    L.new(ray.outputs['Is Hit'], keep.inputs['Selection'])
    clump = N.new('GeometryNodeObjectInfo')
    clump.inputs['Object'].default_value = CLUMP
    inst = N.new('GeometryNodeInstanceOnPoints')
    L.new(keep.outputs[0], inst.inputs['Points'])
    L.new(clump.outputs['Geometry'], inst.inputs['Instance'])
    rz = N.new('FunctionNodeRandomValue')
    rz.data_type = 'FLOAT_VECTOR'
    rz.inputs['Min'].default_value = (0, 0, 0)
    rz.inputs['Max'].default_value = (0, 0, 6.28)
    L.new(rz.outputs['Value'], inst.inputs['Rotation'])
    rsc = N.new('FunctionNodeRandomValue')
    rsc.data_type = 'FLOAT'
    rsc.inputs['Min'].default_value = 0.8
    rsc.inputs['Max'].default_value = 1.5
    L.new(rsc.outputs['Value'], inst.inputs['Scale'])
    store = N.new('GeometryNodeStoreNamedAttribute')
    store.data_type = 'FLOAT'
    store.domain = 'INSTANCE'
    store.inputs['Name'].default_value = 'grassrand'
    rv = N.new('FunctionNodeRandomValue')
    rv.data_type = 'FLOAT'
    L.new(inst.outputs[0], store.inputs['Geometry'])
    L.new(rv.outputs['Value'], store.inputs['Value'])
    join = N.new('GeometryNodeJoinGeometry')
    L.new(gi.outputs['Geometry'], join.inputs[0])
    L.new(store.outputs[0], join.inputs[0])
    L.new(join.outputs[0], go.inputs[0])
    return ng


GRASS_NG = build_grass_group()
RADIUS_NODE = GRASS_NG.nodes['RadiusValue']
GRASS_MODS = []
for o in grass_objs:
    md = o.modifiers.new('Ot', 'NODES')
    md.node_group = GRASS_NG
    md.show_render = False
    md.show_viewport = False
    GRASS_MODS.append(md)

# ---------------------------------------------------------------- yorug‘lik, osmon, kamera
log('osmon va quyosh')
world = bpy.data.worlds.new('Osmon')
scene.world = world
world.use_nodes = True
wnt = world.node_tree
sky = wnt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'MULTIPLE_SCATTERING'
sky.sun_disc = False
sky.altitude = 450.0
sky.air_density = 1.0
sky.aerosol_density = 1.6
sky.ozone_density = 1.0
bgn = wnt.nodes['Background']
SKY_HS = wnt.nodes.new('ShaderNodeHueSaturation')
wnt.links.new(sky.outputs[0], SKY_HS.inputs['Color'])
wnt.links.new(SKY_HS.outputs[0], bgn.inputs['Color'])
bgn.inputs['Strength'].default_value = 1.0

sun_data = bpy.data.lights.new('Quyosh', 'SUN')
sun_data.angle = math.radians(0.55)
sun = bpy.data.objects.new('Quyosh', sun_data)
scene.collection.objects.link(sun)

cam_data = bpy.data.cameras.new('Kamera')
cam = bpy.data.objects.new('Kamera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.clip_start = 0.1
cam_data.clip_end = 250000
cam_data.sensor_width = 36

# kechki fasad yoritgichlari: har ustunga tor uplight, yozuvga past quvvatli chiziqli grazer, ko‘cha chiroqlariga nuqta yorug‘lik
floods = []


def add_spot(pos, tgt, power, ang, blend, soft):
    ld = bpy.data.lights.new('Projektor', 'SPOT')
    ld.spot_size = math.radians(ang)
    ld.spot_blend = blend
    ld.shadow_soft_size = soft
    ld.color = (1.0, 0.82, 0.62)
    lo = bpy.data.objects.new('Projektor', ld)
    scene.collection.objects.link(lo)
    lo.location = bl(*pos)
    lo.rotation_euler = (bl(*tgt) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    floods.append((ld, power))


for k in range(8):  # buildings.ts: ustunlar cx = -21 + 6k, old yuzasi z≈97.6, podium y=1.2
    cx = -21 + 6 * k
    add_spot((cx, 1.25, 98.3), (cx, 16.9, 97.7), 1000, 14, 0.4, 0.05)
add_spot((76, 0.6, 118), (76, 6, 98), 2500, 42, 0.6, 0.25)  # Conference Centre
ld = bpy.data.lights.new('YozuvGrazer', 'AREA')
ld.shape = 'RECTANGLE'
ld.size, ld.size_y = 34.0, 0.2
ld.spread = math.radians(75)
ld.color = (1.0, 0.85, 0.66)
lo = bpy.data.objects.new('YozuvGrazer', ld)
scene.collection.objects.link(lo)
lo.location = bl(0, 17.45, 99.3)
lo.rotation_euler = (math.radians(166), 0.0, 0.0)
floods.append((ld, 200))

LAMP_LIGHTS = []
for o in imported:
    if not any(s.material is REPLACE['lamp'] for s in o.material_slots):
        continue
    o.visible_shadow = False  # yorug‘lik chiroq korpusi ichidan chiqa olsin
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    c = sum(bb, Vector()) / 8
    tall = max(v.z for v in bb) - min(v.z for v in bb) > 0.5  # 0.9 m bollard, aks holda ustun boshi
    ld = bpy.data.lights.new('Chiroq', 'POINT')
    ld.shadow_soft_size = 0.1
    ld.color = (1.0, 0.78, 0.55)
    lo = bpy.data.objects.new('Chiroq', ld)
    lo.location = c
    scene.collection.objects.link(lo)
    LAMP_LIGHTS.append((ld, 20.0 if tall else 150.0))

# ---------------------------------------------------------------- render sozlamalari
rs = scene.render
rs.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'
cy.samples = ARGS.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cy.max_bounces = 8
cy.diffuse_bounces = 3
cy.glossy_bounces = 4
cy.transmission_bounces = 6
cy.transparent_max_bounces = 16
cy.sample_clamp_indirect = 6.0
cy.blur_glossy = 0.5
if ARGS.threads:
    rs.threads_mode = 'FIXED'
    rs.threads = ARGS.threads
w, h = (int(x) for x in ARGS.res.lower().split('x'))
rs.resolution_x, rs.resolution_y = w, h
rs.resolution_percentage = 100
rs.image_settings.file_format = ARGS.format
rs.image_settings.color_mode = 'RGB'
if ARGS.format == 'JPEG':
    rs.image_settings.quality = 92
vs = scene.view_settings
try:
    vs.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast', 'AgX - Base Contrast'):
        try:
            vs.look = look
            break
        except Exception:
            continue
except Exception:
    pass


log(f'rang boshqaruvi: {vs.view_transform} / {vs.look}')


def setup_view(name, v):
    alt, az = sun_position(v['doy'], v['hour'])
    night = v.get('night', False)
    log(f'{name}: quyosh {alt:.1f}°, azimut {az:.0f}°')
    sky.sun_elevation = math.radians(max(alt, -6.0))
    sky.sun_rotation = math.radians(az)
    d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(alt)),
                math.cos(math.radians(az)) * math.cos(math.radians(alt)),
                math.sin(math.radians(alt))))
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    day = max(0.0, min(1.0, (alt + 1) / 8))
    low = 1 - max(0.0, min(1.0, (alt - 5) / 30))
    sun_data.energy = 5.0 * day
    warm = Vector((1.0, 0.97, 0.93)).lerp(Vector((1.0, 0.72, 0.48)), low * 0.8)
    sun_data.color = warm
    bgn.inputs['Strength'].default_value = 0.55 if not night else 2.0
    em = 1.2 if night else 0.0
    MATS['glass_emission'].inputs['Emission Strength'].default_value = em
    MATS['glassPlain_emission'].inputs['Emission Strength'].default_value = 0.18 if night else 0.0
    MATS['lamp_pbr_emission'].inputs['Emission Strength'].default_value = 25.0 if night else 0.0
    for ld, p in floods:
        ld.energy = p if night else 0.0
    for ld, p in LAMP_LIGHTS:
        ld.energy = p if night else 0.0
    SKY_HS.inputs['Saturation'].default_value = 0.75 if night else 1.0
    for em_ in HAZE:
        em_.inputs['Color'].default_value = v.get('haze', (0.62, 0.68, 0.76, 1.0))
        em_.inputs['Strength'].default_value = 0.0 if night else v.get('haze_k', 1.0)
    vs.exposure = -0.35 if not night else 1.0
    # kamera
    p = bl(*v['pos'])
    t = bl(*v['target'])
    cam.location = p
    cam.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = v['lens']
    cam_data.shift_y = v.get('shift', 0.0)
    # o‘t
    for md in GRASS_MODS:
        md.show_render = bool(v.get('grass'))
    RADIUS_NODE.outputs[0].default_value = 70.0 if v['pos'][1] < 5 else 95.0
    CAM_TARGET.location = Vector((p.x, p.y, 0))


os.makedirs(ARGS.out, exist_ok=True)
names = list(VIEWS) if ARGS.views == 'all' else [x.strip() for x in ARGS.views.split(',') if x.strip()]
if ARGS.save_blend:
    setup_view(names[0], VIEWS[names[0]])
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(ARGS.save_blend))
for name in names:
    v = VIEWS[name]
    setup_view(name, v)
    ext = 'jpg' if ARGS.format == 'JPEG' else 'png'
    rs.filepath = os.path.abspath(os.path.join(ARGS.out, f'{name}.{ext}'))
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    log(f'{name}: tayyor ({time.time() - t1:.0f} s) → {rs.filepath}')
log('hammasi tayyor')
