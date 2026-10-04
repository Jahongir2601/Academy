# Barg to‘dasi spraytini render qiladi: public/tex/leaves.png (RGBA, 512×512).
# Saytning «Realistik» rejimida daraxt tojlari shu rasmli kartochkalardan yig‘iladi.
#
#   blender -b --python render/blender/leaf_sprite.py -- --out public/tex/leaves.png
#
# Rang neytral (Standard view transform) — yorug‘lik va soya saytda real vaqtda qo‘shiladi.
# Barglar orasidagi o‘zaro soya (AO) rasmga «pishiriladi», kartochka hajmli ko‘rinishi uchun.
import argparse
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='public/tex/leaves.png')
ap.add_argument('--res', type=int, default=512)
ap.add_argument('--leaves', type=int, default=115)
ARGS = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rnd = random.Random(7)


def leaf_mesh():
    """Tuxumsimon barg, o‘rta tomiri bo‘ylab biroz bukilgan (soya o‘yini uchun)."""
    bm = bmesh.new()
    n = 9
    pts = []
    for i in range(n + 1):
        t = i / n
        w = math.sin(math.pi * t) ** 0.8 * (1.0 - 0.35 * t) * 0.36
        y = -0.5 + t
        pts.append((y, w))
    left = [bm.verts.new((-w, y, w * 0.35)) for y, w in pts]
    mid = [bm.verts.new((0, y, 0)) for y, _ in pts]
    right = [bm.verts.new((w, y, w * 0.35)) for y, w in pts]
    for i in range(n):
        for a, b in ((left, mid), (mid, right)):
            vs = [a[i], a[i + 1], b[i + 1], b[i]]
            if len({v.co.to_tuple() for v in vs}) >= 3:
                try:
                    bm.faces.new(vs)
                except ValueError:
                    pass
    me = bpy.data.meshes.new('leaf')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


LEAF = leaf_mesh()

# materiallar: har barg uchun obyekt rangi (Object Info → Random) orqali yashil tuslar
mat = bpy.data.materials.new('leafMat')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.55
oi = nt.nodes.new('ShaderNodeObjectInfo')
ramp = nt.nodes.new('ShaderNodeValToRGB')
cr = ramp.color_ramp
cr.elements[0].position = 0.0
cr.elements[0].color = (0.17, 0.28, 0.08, 1)
cr.elements[1].position = 1.0
cr.elements[1].color = (0.42, 0.52, 0.17, 1)
mid = cr.elements.new(0.5)
mid.color = (0.26, 0.40, 0.12, 1)
nt.links.new(oi.outputs['Random'], ramp.inputs['Fac'])
# tomir: markazda biroz och chiziq
tc = nt.nodes.new('ShaderNodeTexCoord')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
nt.links.new(tc.outputs['Object'], sep.inputs[0])
ab = nt.nodes.new('ShaderNodeMath')
ab.operation = 'ABSOLUTE'
nt.links.new(sep.outputs['X'], ab.inputs[0])
vein = nt.nodes.new('ShaderNodeMath')
vein.operation = 'LESS_THAN'
vein.inputs[1].default_value = 0.012
nt.links.new(ab.outputs[0], vein.inputs[0])
mix = nt.nodes.new('ShaderNodeMix')
mix.data_type = 'RGBA'
ins = {s.identifier: s for s in mix.inputs}
outs = {s.identifier: s for s in mix.outputs}
nt.links.new(ramp.outputs['Color'], ins['A_Color'])
ins['B_Color'].default_value = (0.36, 0.46, 0.22, 1)
nt.links.new(vein.outputs[0], ins['Factor_Float'])
nt.links.new(outs['Result_Color'], bsdf.inputs['Base Color'])

LEAF.materials.append(mat)

twig_mat = bpy.data.materials.new('twig')
twig_mat.use_nodes = True
twig_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.16, 0.12, 0.08, 1)

# shoxchalar: markazdan tarqaladi, barglar ular bo‘ylab
col = scene.collection
twigs = []
for k in range(7):
    a = k / 7 * math.tau + rnd.uniform(-0.3, 0.3)
    L = rnd.uniform(0.32, 0.46)
    tip = Vector((math.cos(a) * L, math.sin(a) * L, rnd.uniform(-0.05, 0.05)))
    twigs.append(tip)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.006, depth=L, location=tip / 2)
    o = bpy.context.active_object
    o.rotation_euler = tip.to_track_quat('Z', 'Y').to_euler()
    o.data.materials.append(twig_mat)

for i in range(ARGS.leaves):
    tip = twigs[i % len(twigs)]
    t = rnd.uniform(0.25, 1.05)
    base = tip * t + Vector((rnd.gauss(0, 0.04), rnd.gauss(0, 0.04), rnd.gauss(0, 0.03)))
    o = bpy.data.objects.new(f'leaf{i}', LEAF)
    col.objects.link(o)
    s = rnd.uniform(0.12, 0.18)
    o.scale = (s, s, s)
    o.location = base
    yaw = math.atan2(tip.y, tip.x) - math.pi / 2 + rnd.uniform(-0.9, 0.9)
    o.rotation_euler = Euler((rnd.uniform(-0.7, 0.7), rnd.uniform(-0.7, 0.7), yaw), 'XYZ')

# yorug‘lik: yuqoridan yumshoq (neytral) — faqat barglararo soya pishiriladi
world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 2.2
sun.angle = math.radians(25)
so = bpy.data.objects.new('sun', sun)
col.objects.link(so)
so.rotation_euler = (math.radians(35), math.radians(15), 0)

cam_d = bpy.data.cameras.new('cam')
cam_d.type = 'ORTHO'
cam_d.ortho_scale = 1.0
cam = bpy.data.objects.new('cam', cam_d)
col.objects.link(cam)
cam.location = (0, 0, 2)
scene.camera = cam

scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = ARGS.res
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = os.path.abspath(ARGS.out)
bpy.ops.render.render(write_still=True)
print('saved', scene.render.filepath)
