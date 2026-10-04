// Soya tahlili uchun soddalashtirilgan to‘siqlar (binolar — qutilar, daraxtlar — ellipsoidlar).
// Fazoviy panjara (grid) bilan tezlashtirilgan: bitta nur odatda 20–40 ta test.
import * as THREE from 'three';

export const OCC_BUILDING = 1;
export const OCC_ARCADE = 2;
export const OCC_TREE = 4;
export const OCC_CANOPY = 8;
export const OCC_ALL = 15;

interface Box {
  kind: number;
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  stamp: number;
}
interface Ell {
  kind: number;
  cx: number; cy: number; cz: number; r: number; ry: number;
  stamp: number;
}

const CELL = 8;
const GX0 = -260;
const GZ0 = -220;
const NX = 65;
const NZ = 55;

export class Occluders {
  boxes: Box[] = [];
  ells: Ell[] = [];
  private cells: { b: Box[]; e: Ell[] }[] = [];
  private stamp = 1;
  maxTop = 0;
  private built = false;

  addBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind = OCC_BUILDING) {
    this.boxes.push({
      kind,
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      y0: Math.min(y0, y1), y1: Math.max(y0, y1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
      stamp: 0,
    });
    this.built = false;
  }

  addEllipsoid(cx: number, cy: number, cz: number, r: number, ry: number, kind = OCC_TREE) {
    this.ells.push({ kind, cx, cy, cz, r, ry, stamp: 0 });
    this.built = false;
  }

  private build() {
    this.cells = Array.from({ length: NX * NZ }, () => ({ b: [], e: [] }));
    this.maxTop = 0;
    const span = (a: number, b: number, o: number, n: number) => [
      Math.max(0, Math.floor((a - o) / CELL)),
      Math.min(n - 1, Math.floor((b - o) / CELL)),
    ];
    for (const bx of this.boxes) {
      this.maxTop = Math.max(this.maxTop, bx.y1);
      const [i0, i1] = span(bx.x0, bx.x1, GX0, NX);
      const [j0, j1] = span(bx.z0, bx.z1, GZ0, NZ);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.cells[j * NX + i].b.push(bx);
    }
    for (const el of this.ells) {
      this.maxTop = Math.max(this.maxTop, el.cy + el.ry);
      const [i0, i1] = span(el.cx - el.r, el.cx + el.r, GX0, NX);
      const [j0, j1] = span(el.cz - el.r, el.cz + el.r, GZ0, NZ);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.cells[j * NX + i].e.push(el);
    }
    this.built = true;
  }

  /**
   * Nuqta soyadami? dir — quyosh tomonga birlik vektor.
   * Quyosh ufqdan past bo‘lsa, `true` (yorug‘lik yo‘q).
   */
  isShaded(px: number, py: number, pz: number, dir: THREE.Vector3, mask = OCC_ALL): boolean {
    if (!this.built) this.build();
    if (dir.y <= 0.01) return true;
    const dx = dir.x;
    const dy = dir.y;
    const dz = dir.z;
    const hl = Math.hypot(dx, dz);
    const stamp = ++this.stamp;
    const maxT = (this.maxTop - py + 0.5) / dy; // nur parametri chegarasi
    if (maxT <= 0) return false;
    const travel = maxT * hl; // gorizontal masofa

    // 2D DDA
    let ci = Math.floor((px - GX0) / CELL);
    let cj = Math.floor((pz - GZ0) / CELL);
    const ux = hl > 1e-6 ? dx / hl : 0;
    const uz = hl > 1e-6 ? dz / hl : 0;
    const stepI = ux > 0 ? 1 : -1;
    const stepJ = uz > 0 ? 1 : -1;
    const nextX = GX0 + (ci + (stepI > 0 ? 1 : 0)) * CELL;
    const nextZ = GZ0 + (cj + (stepJ > 0 ? 1 : 0)) * CELL;
    let tMaxX = Math.abs(ux) > 1e-9 ? (nextX - px) / ux : Infinity;
    let tMaxZ = Math.abs(uz) > 1e-9 ? (nextZ - pz) / uz : Infinity;
    const tDX = Math.abs(ux) > 1e-9 ? CELL / Math.abs(ux) : Infinity;
    const tDZ = Math.abs(uz) > 1e-9 ? CELL / Math.abs(uz) : Infinity;
    let dist = 0;

    while (dist <= travel + CELL) {
      if (ci >= 0 && ci < NX && cj >= 0 && cj < NZ) {
        const cell = this.cells[cj * NX + ci];
        for (const b of cell.b) {
          if (!(b.kind & mask) || b.stamp === stamp) continue;
          b.stamp = stamp;
          if (rayBox(px, py, pz, dx, dy, dz, b)) return true;
        }
        for (const el of cell.e) {
          if (!(el.kind & mask) || el.stamp === stamp) continue;
          el.stamp = stamp;
          if (rayEll(px, py, pz, dx, dy, dz, el)) return true;
        }
      } else if (dist > 0) {
        break;
      }
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        tMaxX += tDX;
        ci += stepI;
      } else {
        dist = tMaxZ;
        tMaxZ += tDZ;
        cj += stepJ;
      }
      if (hl < 1e-6) break;
    }
    return false;
  }

  /** Nuqta biror bino ichidami (yer sathida). */
  insideBuilding(x: number, z: number): boolean {
    for (const b of this.boxes) {
      if (b.kind !== OCC_BUILDING) continue;
      if (b.y0 > 0.5) continue;
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
    }
    return false;
  }
}

function rayBox(px: number, py: number, pz: number, dx: number, dy: number, dz: number, b: Box): boolean {
  let tmin = 1e-3;
  let tmax = Infinity;
  // x
  if (Math.abs(dx) < 1e-9) {
    if (px < b.x0 || px > b.x1) return false;
  } else {
    let t1 = (b.x0 - px) / dx;
    let t2 = (b.x1 - px) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (py < b.y0 || py > b.y1) return false;
  } else {
    let t1 = (b.y0 - py) / dy;
    let t2 = (b.y1 - py) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (pz < b.z0 || pz > b.z1) return false;
  } else {
    let t1 = (b.z0 - pz) / dz;
    let t2 = (b.z1 - pz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function rayEll(px: number, py: number, pz: number, dx: number, dy: number, dz: number, e: Ell): boolean {
  // ellipsoidni sferaga keltirish (y o‘qini masshtablash)
  const k = e.r / e.ry;
  const ox = px - e.cx;
  const oy = (py - e.cy) * k;
  const oz = pz - e.cz;
  const vy = dy * k;
  const a = dx * dx + vy * vy + dz * dz;
  const b = 2 * (ox * dx + oy * vy + oz * dz);
  const c = ox * ox + oy * oy + oz * oz - e.r * e.r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc);
  const t2 = (-b + sq) / (2 * a);
  return t2 > 1e-3;
}
