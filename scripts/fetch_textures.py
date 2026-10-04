#!/usr/bin/env python3
"""«Realistik» rejim uchun Poly Haven (CC0) teksturalarini yuklab, siqib public/tex/ ga yozadi.

    python3 scripts/fetch_textures.py

Har bir material uchun uchta fayl: <nom>_diff.jpg (rang), <nom>_nor.jpg (OpenGL normal),
<nom>_arm.jpg (R — AO, G — g‘adir-budurlik, B — metall). Hajmni kichik tutish uchun normal va
ARM xaritalari 512 px. Kerak: Pillow (pip install pillow).
"""
import io
import json
import os
import urllib.request

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'tex')

# nom → (Poly Haven id, diff o‘lchami, normal/arm o‘lchami)
TEXTURES = {
    'stone': ('sandstone_blocks_08', 1024, 512),
    'paving': ('large_grey_tiles', 1024, 512),
    'pavingWarm': ('patio_tiles', 1024, 512),
    'asphalt': ('clean_asphalt', 1024, 512),
    'grass': ('grass_ground', 1024, 512),
    'roof': ('gravel_concrete', 512, 256),
    'wood': ('fine_grained_wood', 512, 256),
    'bark': ('bark_brown_02', 512, 256),
}


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'akademiya-3d texture fetch'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def save(data, path, size, quality):
    im = Image.open(io.BytesIO(data)).convert('RGB')
    if im.width != size:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)
    return os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = json.loads(get('https://api.polyhaven.com/assets?t=textures'))
    credits = []
    total = 0
    for name, (pid, dsize, nsize) in TEXTURES.items():
        files = json.loads(get(f'https://api.polyhaven.com/files/{pid}'))
        res = '1k'
        maps = {'diff': files['Diffuse'], 'nor': files['nor_gl']}
        if 'arm' in files:
            maps['arm'] = files['arm']
        for kind, entry in maps.items():
            url = entry[res]['jpg']['url']
            size = dsize if kind == 'diff' else nsize
            q = 84 if kind == 'diff' else 80
            n = save(get(url), os.path.join(OUT, f'{name}_{kind}.jpg'), size, q)
            total += n
            print(f'{name}_{kind}.jpg  {n // 1024} KB')
        if 'arm' not in files:
            # ARM yo‘q — AO va Rough xaritalaridan yig‘amiz (metall = 0)
            def chan(key, fill):
                if key not in files:
                    return Image.new('L', (nsize, nsize), fill)
                im = Image.open(io.BytesIO(get(files[key][res]['jpg']['url']))).convert('L')
                return im.resize((nsize, nsize), Image.LANCZOS)
            arm = Image.merge('RGB', (chan('AO', 255), chan('Rough', 200), Image.new('L', (nsize, nsize), 0)))
            path = os.path.join(OUT, f'{name}_arm.jpg')
            arm.save(path, 'JPEG', quality=80, optimize=True, progressive=True)
            total += os.path.getsize(path)
            print(f'{name}_arm.jpg  {os.path.getsize(path) // 1024} KB (AO + Rough)')
        dims = meta.get(pid, {}).get('dimensions') or []
        credits.append((name, pid, meta.get(pid, {}).get('name', pid), dims))
    with open(os.path.join(OUT, 'CREDITS.md'), 'w') as f:
        f.write('# Teksturalar\n\nBarcha teksturalar [Poly Haven](https://polyhaven.com) dan, litsenziya CC0 (jamoat mulki).\n\n')
        f.write('| Fayl | Poly Haven | Haqiqiy o‘lcham |\n|---|---|---|\n')
        for name, pid, title, dims in credits:
            d = f'{round(dims[0] / 1000, 2):g} × {round(dims[1] / 1000, 2):g} m' if dims else '—'
            f.write(f'| `{name}_*.jpg` | [{title}](https://polyhaven.com/a/{pid}) | {d} |\n')
        f.write('\n`leaves.png` — Blender’da render qilingan barg to‘dasi (render/blender/leaf_sprite.py).\n')
    print(f'jami: {total // 1024} KB')


if __name__ == '__main__':
    main()
