// Protsedural teksturalar va umumiy materiallar.
// Hamma narsa canvas’da chiziladi — tashqi rasm fayllari kerak emas.
import * as THREE from 'three';

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Takrorlanuvchi tasodifiy son generatori — har safar bir xil maket chiqishi uchun. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c: HTMLCanvasElement, srgb = true, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function noiseCanvas(size: number, base: string, amp: number, seed: number, blotches = 0): HTMLCanvasElement {
  const [c, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const r = rng(seed);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amp;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < blotches; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 4 + r() * size * 0.12;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.05 + r() * 0.07;
    const dark = r() > 0.5;
    grad.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}

/** Tosh plitalar: gorizontal qatorlar, vertikal choklar. 1 UV birlik = 1 m. */
function stoneCanvas(): HTMLCanvasElement {
  const size = 512;
  const c = noiseCanvas(size, '#e6dcc8', 8, 11, 24);
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(120,100,70,0.28)';
  g.lineWidth = 2;
  // 4 m tile → 512px: qator balandligi 0.75 m, plita eni 1.5 m
  const rowH = size / (4 / 0.75);
  for (let y = 0, row = 0; y < size + 1; y += rowH, row++) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
    const off = row % 2 ? size / 8 : 0;
    for (let x = off; x < size; x += size / (4 / 1.5)) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + rowH);
      g.stroke();
    }
  }
  return c;
}

/** Deraza: 8×8 katak, har katak = 1 bay × 1 qavat. */
function windowCanvases(seed: number): { map: HTMLCanvasElement; lit: HTMLCanvasElement } {
  const cells = 8;
  const cs = 64;
  const size = cells * cs;
  const [m, g] = canvas(size);
  const [l, gl] = canvas(size);
  gl.fillStyle = '#000';
  gl.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x = i * cs;
      const y = j * cs;
      // shisha — biroz gradient, osmon aksi
      const grd = g.createLinearGradient(0, y, 0, y + cs);
      const tone = 0.85 + r() * 0.3;
      grd.addColorStop(0, `rgb(${Math.round(150 * tone)},${Math.round(170 * tone)},${Math.round(178 * tone)})`);
      grd.addColorStop(1, `rgb(${Math.round(88 * tone)},${Math.round(104 * tone)},${Math.round(112 * tone)})`);
      g.fillStyle = grd;
      g.fillRect(x, y, cs, cs);
      // ichki parda/jalyuzi
      if (r() > 0.6) {
        g.fillStyle = 'rgba(225,215,195,0.35)';
        g.fillRect(x + 4, y + 6, cs - 8, cs * (0.2 + r() * 0.4));
      }
      // ramka
      g.fillStyle = '#3b3f42';
      g.fillRect(x, y, cs, 3);
      g.fillRect(x, y, 3, cs);
      g.fillRect(x + cs / 2 - 1, y, 2, cs);
      g.fillRect(x, y + cs * 0.78, cs, 2);
      // tungi yorug‘lik
      if (r() > 0.42) {
        const warm = r();
        gl.fillStyle = warm > 0.25 ? `rgb(255,${200 + Math.round(r() * 30)},${130 + Math.round(r() * 40)})` : 'rgb(200,225,255)';
        gl.globalAlpha = 0.55 + r() * 0.45;
        gl.fillRect(x + 3, y + 3, cs - 3, cs - 3);
        gl.globalAlpha = 1;
      }
    }
  }
  return { map: m, lit: l };
}

/** Girih: 8 nurli yulduz panjarasi (abstrakt o‘zbek geometriyasi). Alfa-xarita. */
function girihCanvas(): HTMLCanvasElement {
  const size = 256;
  const [c, g] = canvas(size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#fff';
  g.lineWidth = 9;
  g.lineJoin = 'miter';
  const drawStar = (cx: number, cy: number, R: number) => {
    // {8/3} yulduz
    g.beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = (k * 3 * Math.PI * 2) / 8 + Math.PI / 8;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  for (const [cx, cy] of [
    [0, 0], [size, 0], [0, size], [size, size], [size / 2, size / 2],
  ]) {
    drawStar(cx, cy, size * 0.36);
  }
  // bog‘lovchi chiziqlar
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(size / 2, 0);
  g.lineTo(size / 2, size);
  g.moveTo(0, size / 2);
  g.lineTo(size, size / 2);
  g.stroke();
  g.strokeRect(0, 0, size, size);
  return c;
}

function pavingCanvas(base: string, joint: string, tile: number, seed: number): HTMLCanvasElement {
  const size = 512;
  const c = noiseCanvas(size, base, 10, seed, 30);
  const g = c.getContext('2d')!;
  g.strokeStyle = joint;
  g.lineWidth = 2;
  const step = size / tile;
  for (let i = 0; i <= tile; i++) {
    g.beginPath();
    g.moveTo(i * step, 0);
    g.lineTo(i * step, size);
    g.moveTo(0, i * step);
    g.lineTo(size, i * step);
    g.stroke();
  }
  return c;
}

function grassCanvas(): HTMLCanvasElement {
  const size = 512;
  const c = noiseCanvas(size, '#86a05e', 16, 5, 0);
  const g = c.getContext('2d')!;
  const r = rng(77);
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 10 + r() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const tone = r() > 0.5 ? 'rgba(60,85,30,0.18)' : 'rgba(170,175,90,0.14)';
    grad.addColorStop(0, tone);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}

function waterNormalCanvas(): HTMLCanvasElement {
  const size = 256;
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const nx = 0.5 * Math.sin(u * 3 + Math.sin(v * 2)) + 0.3 * Math.sin(u * 7 + v * 5);
      const ny = 0.5 * Math.cos(v * 4 + Math.sin(u * 3)) + 0.3 * Math.cos(v * 9 - u * 2);
      const i = (y * size + x) * 4;
      d[i] = 128 + nx * 40;
      d[i + 1] = 128 + ny * 40;
      d[i + 2] = 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Bronza harflar bilan yozuv (shaffof fon). */
export function textTexture(
  text: string,
  opts: { w?: number; h?: number; font?: string; color?: string; bg?: string; spacing?: number } = {},
): THREE.CanvasTexture {
  const w = opts.w ?? 2048;
  const h = opts.h ?? 160;
  const [c, g] = canvas(w, h);
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = opts.color ?? '#b58a4c';
  g.font = opts.font ?? `600 ${Math.round(h * 0.56)}px "Marcellus", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const spacing = opts.spacing ?? 0.12;
  // harflar orasidagi masofa — qo‘lda
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const extra = h * spacing;
  const total = widths.reduce((a, b) => a + b, 0) + extra * (chars.length - 1);
  const scale = Math.min(1, (w * 0.96) / total);
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(scale, 1);
  let x = -total / 2;
  g.textAlign = 'left';
  chars.forEach((ch, i) => {
    g.fillText(ch, x, 0);
    x += widths[i] + extra;
  });
  g.restore();
  const t = tex(c, true, false);
  return t;
}

export interface Materials {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  stoneWarm: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  glassPlain: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  screen: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  paving: THREE.MeshStandardMaterial;
  pavingWarm: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  marking: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  court: THREE.MeshStandardMaterial;
  courtLine: THREE.MeshStandardMaterial;
  hedge: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  crown: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  pool: THREE.MeshStandardMaterial;
  context: THREE.MeshStandardMaterial;
  mountain: THREE.MeshStandardMaterial;
  /** Tungi yorug‘lik bilan ishlaydigan materiallar. */
  nightEmissive: { mat: THREE.MeshStandardMaterial; max: number }[];
  waterNormal: THREE.Texture;
}

let cached: Materials | null = null;

export function getMaterials(): Materials {
  if (cached) return cached;

  const stoneTex = tex(stoneCanvas());
  stoneTex.repeat.set(1 / 4, 1 / 4);
  const win = windowCanvases(3);
  const winMap = tex(win.map);
  const winLit = tex(win.lit);
  const girih = tex(girihCanvas(), false);
  const grassTex = tex(grassCanvas());
  grassTex.repeat.set(1 / 24, 1 / 24);
  const groundTex = tex(noiseCanvas(512, '#c4bea9', 10, 9, 90));
  groundTex.repeat.set(1 / 60, 1 / 60);
  const paveTex = tex(pavingCanvas('#d9d0bf', 'rgba(110,95,70,0.35)', 8, 21));
  paveTex.repeat.set(1 / 6, 1 / 6);
  const paveWarmTex = tex(pavingCanvas('#cdb99a', 'rgba(110,85,55,0.4)', 4, 23));
  paveWarmTex.repeat.set(1 / 4, 1 / 4);
  const asphaltTex = tex(noiseCanvas(256, '#55585a', 26, 31));
  asphaltTex.repeat.set(1 / 8, 1 / 8);
  const waterNormal = tex(waterNormalCanvas(), false);
  waterNormal.repeat.set(1 / 9, 1 / 9);

  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

  const glass = std({
    color: 0xffffff,
    map: winMap,
    roughness: 0.12,
    metalness: 0.25,
    emissive: 0xffd9a0,
    emissiveMap: winLit,
    emissiveIntensity: 0,
    envMapIntensity: 1.1,
  });
  const glassPlain = std({
    color: 0x7f99a3,
    roughness: 0.06,
    metalness: 0.4,
    emissive: 0xffd49a,
    emissiveIntensity: 0,
    envMapIntensity: 1.2,
  });
  const lamp = std({ color: 0xfff1d6, emissive: 0xffd7a0, emissiveIntensity: 0, roughness: 0.4 });
  const pool = std({ color: 0x4fb6c9, emissive: 0x2a9fc0, emissiveIntensity: 0, roughness: 0.1, metalness: 0.1 });

  cached = {
    stone: std({ color: 0xffffff, map: stoneTex, roughness: 0.86, metalness: 0 }),
    stoneDark: std({ color: 0xbfb19a, map: stoneTex, roughness: 0.9 }),
    stoneWarm: std({ color: 0xf0dcc0, map: stoneTex, roughness: 0.85 }),
    roof: std({ color: 0x8e8c86, roughness: 0.95 }),
    glass,
    glassPlain,
    bronze: std({ color: 0x9a7444, roughness: 0.38, metalness: 0.85 }),
    darkMetal: std({ color: 0x33373b, roughness: 0.5, metalness: 0.6 }),
    wood: std({ color: 0xa8784c, roughness: 0.75 }),
    screen: std({
      color: 0xa47b48,
      roughness: 0.4,
      metalness: 0.8,
      alphaMap: girih,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    grass: std({ color: 0xffffff, map: grassTex, roughness: 1 }),
    ground: std({ color: 0xffffff, map: groundTex, roughness: 1 }),
    paving: std({ color: 0xffffff, map: paveTex, roughness: 0.9 }),
    pavingWarm: std({ color: 0xffffff, map: paveWarmTex, roughness: 0.9 }),
    asphalt: std({ color: 0xffffff, map: asphaltTex, roughness: 0.95 }),
    marking: std({ color: 0xf2efe6, roughness: 0.8 }),
    water: std({
      color: 0x2f5f6b,
      roughness: 0.04,
      metalness: 0.65,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.14, 0.14),
      envMapIntensity: 1.3,
    }),
    solar: std({ color: 0x1d2a3d, roughness: 0.25, metalness: 0.7 }),
    court: std({ color: 0x3f7f72, roughness: 0.9 }),
    courtLine: std({ color: 0xf4f1e8, roughness: 0.8 }),
    hedge: std({ color: 0x4f6d36, roughness: 1 }),
    trunk: std({ color: 0x8b7a66, roughness: 1 }),
    crown: std({ color: 0xffffff, roughness: 0.95 }),
    lamp,
    fabric: std({ color: 0xefe7d6, roughness: 0.9, side: THREE.DoubleSide }),
    pool,
    context: std({ color: 0xd6d2c8, roughness: 0.95 }),
    mountain: std({ color: 0x8f9a9c, roughness: 1, flatShading: true }),
    nightEmissive: [
      { mat: glass, max: 1.6 },
      { mat: glassPlain, max: 0.45 },
      { mat: lamp, max: 3 },
      { mat: pool, max: 0.9 },
    ],
    waterNormal,
  };
  return cached;
}
