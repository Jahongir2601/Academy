// Soya tahlili: hovli soyasi foizi va kunlik to‘g‘ridan-to‘g‘ri quyosh soatlari xaritasi.
import * as THREE from 'three';
import { Occluders, OCC_ALL, OCC_BUILDING } from '../core/occluders';
import { sunPosition, sunriseSunset } from '../core/sun';
import { COURTYARD, type Rect } from '../data/campus';

export function shadeFraction(occ: Occluders, rect: Rect, dir: THREE.Vector3, mask: number, step = 1.5): number {
  if (dir.y <= 0.01) return 1;
  let n = 0;
  let s = 0;
  for (let x = rect[0] + step / 2; x < rect[1]; x += step) {
    for (let z = rect[2] + step / 2; z < rect[3]; z += step) {
      n++;
      if (occ.isShaded(x, 0.15, z, dir, mask)) s++;
    }
  }
  return n ? s / n : 0;
}

export function courtyardShade(occ: Occluders, dir: THREE.Vector3) {
  return {
    buildings: shadeFraction(occ, COURTYARD, dir, OCC_BUILDING),
    all: shadeFraction(occ, COURTYARD, dir, OCC_ALL),
  };
}

export interface SunHoursMap {
  nx: number;
  nz: number;
  step: number;
  x0: number;
  z0: number;
  hours: Float32Array; // NaN — bino ichida
  dayLength: number;
  doy: number;
}

export const HEAT_RECT: Rect = [-190, 190, -150, 150];

/**
 * Kunlik quyosh soatlari (bo‘laklab hisoblanadi, UI qotib qolmasligi uchun).
 * onProgress(0..1) har bir vaqt qadamidan keyin chaqiriladi.
 */
export async function computeSunHours(
  occ: Occluders,
  doy: number,
  onProgress: (p: number) => void,
  opts: { step?: number; dtMin?: number; mask?: number; rect?: Rect; signal?: { cancelled: boolean } } = {},
): Promise<SunHoursMap | null> {
  const step = opts.step ?? 2.5;
  const dtMin = opts.dtMin ?? 30;
  const mask = opts.mask ?? OCC_ALL;
  const r = opts.rect ?? HEAT_RECT;
  const nx = Math.round((r[1] - r[0]) / step);
  const nz = Math.round((r[3] - r[2]) / step);
  const hours = new Float32Array(nx * nz);
  // bino ichidagi nuqtalar
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = r[0] + (i + 0.5) * step;
      const z = r[2] + (j + 0.5) * step;
      if (occ.insideBuilding(x, z)) hours[j * nx + i] = NaN;
    }
  }
  const { rise, set } = sunriseSunset(doy);
  const times: number[] = [];
  for (let t = rise + dtMin / 120; t < set; t += dtMin / 60) times.push(t);
  const dh = dtMin / 60;
  let k = 0;
  for (const t of times) {
    if (opts.signal?.cancelled) return null;
    const { dir } = sunPosition(doy, t);
    if (dir.y > 0.02) {
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const idx = j * nx + i;
          if (Number.isNaN(hours[idx])) continue;
          const x = r[0] + (i + 0.5) * step;
          const z = r[2] + (j + 0.5) * step;
          if (!occ.isShaded(x, 0.15, z, dir, mask)) hours[idx] += dh;
        }
      }
    }
    k++;
    onProgress(k / times.length);
    await new Promise((res) => setTimeout(res, 0));
  }
  return { nx, nz, step, x0: r[0], z0: r[2], hours, dayLength: set - rise, doy };
}

export function mapStats(m: SunHoursMap, rect: Rect) {
  let n = 0;
  let sum = 0;
  let under4 = 0;
  for (let j = 0; j < m.nz; j++) {
    const z = m.z0 + (j + 0.5) * m.step;
    if (z < rect[2] || z > rect[3]) continue;
    for (let i = 0; i < m.nx; i++) {
      const x = m.x0 + (i + 0.5) * m.step;
      if (x < rect[0] || x > rect[1]) continue;
      const v = m.hours[j * m.nx + i];
      if (Number.isNaN(v)) continue;
      n++;
      sum += v;
      if (v < 4) under4++;
    }
  }
  return { avg: n ? sum / n : 0, under4: n ? under4 / n : 0 };
}

/** Rang shkalasi: soya (salqin ko‘k) → sariq → issiq qizil. */
export function heatColor(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [36, 84, 140]],
    [0.25, [58, 150, 170]],
    [0.5, [150, 196, 120]],
    [0.72, [245, 205, 85]],
    [0.88, [238, 136, 60]],
    [1, [200, 60, 50]],
  ];
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const k = (x - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}

export function heatTexture(m: SunHoursMap, maxH: number): THREE.DataTexture {
  const data = new Uint8Array(m.nx * m.nz * 4);
  for (let j = 0; j < m.nz; j++) {
    for (let i = 0; i < m.nx; i++) {
      const v = m.hours[j * m.nx + i];
      // tekislikda v=0 janubda, 0-qator esa shimolda — qatorlarni teskari yozamiz
      const o = ((m.nz - 1 - j) * m.nx + i) * 4;
      if (Number.isNaN(v)) {
        data[o + 3] = 0;
        continue;
      }
      const [r, g, b] = heatColor(v / maxH);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 200;
    }
  }
  const tex = new THREE.DataTexture(data, m.nx, m.nz, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
