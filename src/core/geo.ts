// Geometriya yig‘uvchi: bir material uchun ko‘plab qutilarni bitta mesh’ga birlashtiradi.
// UV koordinatalari dunyo o‘lchamida (metrda) beriladi — tosh choklari va derazalar
// barcha binolarda bir xil masshtabda chiqadi.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type UVMode = { su: number; sv: number; ou?: number; ov?: number };

const tmpN = new THREE.Vector3();

/** Pozitsiya va normal asosida UV hisoblash (o‘qlarga parallel sirtlar uchun). */
export function applyWorldUV(geom: THREE.BufferGeometry, uv: UVMode) {
  const pos = geom.getAttribute('position');
  const nor = geom.getAttribute('normal');
  const arr = new Float32Array(pos.count * 2);
  const ou = uv.ou ?? 0;
  const ov = uv.ov ?? 0;
  for (let i = 0; i < pos.count; i++) {
    tmpN.fromBufferAttribute(nor, i);
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(tmpN.x);
    const ay = Math.abs(tmpN.y);
    const az = Math.abs(tmpN.z);
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = x / uv.su;
      v = z / uv.su;
    } else if (ax >= az) {
      u = z / uv.su;
      v = y / uv.sv;
    } else {
      u = x / uv.su;
      v = y / uv.sv;
    }
    arr[i * 2] = u + ou;
    arr[i * 2 + 1] = v + ov;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
}

export class GeoBuilder {
  private parts = new Map<string, THREE.BufferGeometry[]>();

  /** x0..x1, y0..y1, z0..z1 chegarali quti. */
  box(key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, uv?: UVMode) {
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(key, g, uv);
  }

  /** Markaz va o‘lcham bilan, Y o‘qi atrofida burilgan quti. */
  boxAt(key: string, cx: number, cy: number, cz: number, w: number, h: number, d: number, rotY = 0, uv?: UVMode) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(cx, cy, cz);
    this.add(key, g, uv);
  }

  add(key: string, g: THREE.BufferGeometry, uv?: UVMode) {
    let geom = g.index ? g.toNonIndexed() : g;
    if (!geom.getAttribute('normal')) geom.computeVertexNormals();
    if (uv) applyWorldUV(geom, uv);
    else if (!geom.getAttribute('uv')) applyWorldUV(geom, { su: 1, sv: 1 });
    // faqat kerakli atributlar — birlashtirish uchun
    for (const name of Object.keys(geom.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geom.deleteAttribute(name);
    }
    if (geom !== g) g.dispose();
    let list = this.parts.get(key);
    if (!list) {
      list = [];
      this.parts.set(key, list);
    }
    list.push(geom);
  }

  /** Har bir kalit uchun bitta mesh qaytaradi. */
  build(materials: Record<string, THREE.Material>, opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mat = materials[key];
      if (!mat) throw new Error(`Material topilmadi: ${key}`);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = key;
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

/** Gorizontal tekislik (yer qatlamlari uchun): x0..x1, z0..z1, balandlik y. */
export function flatRect(x0: number, x1: number, z0: number, z1: number, y: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

/** Shakl (Shape) bo‘yicha gorizontal sirt. */
export function flatShape(shape: THREE.Shape, y: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shape, 24);
  g.rotateX(Math.PI / 2);
  // ShapeGeometry XY tekislikda; X o‘qi atrofida +90° burish y = 0 da z = shape.y beradi
  g.translate(0, y, 0);
  // normal yuqoriga qarashi uchun
  const nor = g.getAttribute('normal');
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  // uchburchaklar yo‘nalishini teskari qilish (pastdan ko‘rinmasligi uchun)
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  return g;
}
