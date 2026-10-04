// Landshaft: yer qatlamlari, yo‘llar, suv, daraxtlar, parking (solar carport),
// sport maydonlari, to‘siqlar, chiroqlar, mebel va atrofdagi shahar konteksti.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuilder, flatRect, flatShape, applyWorldUV } from '../core/geo';
import { getMaterials, rng } from '../core/materials';
import { Instancer } from '../core/instancer';
import { getOccluders } from './buildings';
import { OCC_CANOPY, OCC_TREE } from '../core/occluders';
import { BUILDINGS, COURTYARD, type Rect } from '../data/campus';

const UV1 = { su: 1, sv: 1 };

export type TreeKind = 'plane' | 'elm' | 'poplar' | 'fruit' | 'cypress' | 'mulberry';

const TREE_SPECS: Record<TreeKind, { r: number; ry: number; trunk: number; tr: number; colors: number[] }> = {
  plane: { r: 5.2, ry: 4.4, trunk: 5.2, tr: 0.32, colors: [0x5f8a3a, 0x6b9442, 0x56803a] },
  elm: { r: 3.6, ry: 3.0, trunk: 3.4, tr: 0.22, colors: [0x58803a, 0x4d7434, 0x638a40] },
  poplar: { r: 1.5, ry: 7.2, trunk: 1.6, tr: 0.25, colors: [0x6a8f3c, 0x5e8636, 0x739a45] },
  fruit: { r: 2.3, ry: 1.9, trunk: 1.5, tr: 0.18, colors: [0x6f9845, 0x7aa04b, 0x668e3e] },
  cypress: { r: 0.9, ry: 3.6, trunk: 0.6, tr: 0.12, colors: [0x3f5f34, 0x46663a] },
  mulberry: { r: 3.0, ry: 2.4, trunk: 2.4, tr: 0.3, colors: [0x5a8538, 0x66903f] },
};

export interface LandscapeResult {
  group: THREE.Group;
  water: THREE.Mesh[];
  trees: { x: number; z: number; kind: TreeKind }[];
}

function crownGeometry(): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, 2);
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  const g = mergeVertices(ico);
  const pos = g.getAttribute('position');
  const r = rng(99);
  const offsets = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let o = offsets.get(key);
    if (o === undefined) {
      o = 0.82 + r() * 0.3 + 0.08 * Math.sin(x * 5) * Math.cos(z * 4);
      offsets.set(key, o);
    }
    const flat = y < -0.3 ? 0.75 : 1; // pastki qismi biroz yassi
    pos.setXYZ(i, x * o, y * o * flat, z * o);
  }
  g.computeVertexNormals();
  return g;
}

export function buildLandscape(I: Instancer): LandscapeResult {
  const m = getMaterials();
  const B = new GeoBuilder();
  const group = new THREE.Group();
  group.name = 'landscape';
  const occ = getOccluders();
  const R = rng(2026);
  const trees: { x: number; z: number; kind: TreeKind }[] = [];
  const water: THREE.Mesh[] = [];

  // ---------- instanced turlar ----------
  I.define('crown', crownGeometry(), m.crown);
  const trunkG = new THREE.CylinderGeometry(0.7, 1, 1, 7);
  trunkG.translate(0, 0.5, 0);
  I.define('trunk', trunkG, m.trunk);
  const lampPole = new THREE.CylinderGeometry(0.08, 0.11, 1, 6);
  lampPole.translate(0, 0.5, 0);
  I.define('lampPole', lampPole, m.darkMetal);
  const lampHead = new THREE.BoxGeometry(0.5, 0.18, 0.5);
  I.define('lampHead', lampHead, m.lamp, { castShadow: false });
  const bollard = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8);
  bollard.translate(0, 0.45, 0);
  I.define('bollard', bollard, m.lamp, { castShadow: false });
  const bench = new THREE.BoxGeometry(2.0, 0.45, 0.6);
  bench.translate(0, 0.225, 0);
  I.define('bench', bench, m.wood);
  const canopyPanel = new THREE.BoxGeometry(5.6, 0.14, 7.4);
  I.define('canopyPanel', canopyPanel, m.solar);
  const post = new THREE.BoxGeometry(0.25, 1, 0.25);
  post.translate(0, 0.5, 0);
  I.define('post', post, m.darkMetal);
  const carBody = new THREE.BoxGeometry(1.8, 0.8, 4.3);
  carBody.translate(0, 0.55, 0);
  I.define('carBody', carBody, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.6 }));
  const carTop = new THREE.BoxGeometry(1.55, 0.55, 2.2);
  carTop.translate(0, 1.2, -0.2);
  I.define('carTop', carTop, m.glassPlain);
  const marking = new THREE.BoxGeometry(0.12, 0.02, 5);
  I.define('marking', marking, m.marking, { castShadow: false });
  const dash = new THREE.BoxGeometry(0.15, 0.02, 3);
  I.define('dash', dash, m.marking, { castShadow: false });
  const fenceBar = new THREE.BoxGeometry(0.06, 1, 0.06);
  fenceBar.translate(0, 0.5, 0);
  I.define('fenceBar', fenceBar, m.darkMetal, { receiveShadow: false });
  const umbrella = new THREE.ConeGeometry(1.6, 0.6, 8);
  umbrella.translate(0, 2.6, 0);
  I.define('umbrella', umbrella, m.fabric);
  const table = new THREE.CylinderGeometry(0.5, 0.5, 0.75, 10);
  table.translate(0, 0.375, 0);
  I.define('table', table, m.wood);
  const shrub = new THREE.IcosahedronGeometry(1, 1);
  I.define('shrub', shrub, m.hedge);
  const contextB = new THREE.BoxGeometry(1, 1, 1);
  contextB.translate(0, 0.5, 0);
  I.define('context', contextB, m.context);

  const tree = (x: number, z: number, kind: TreeKind, scale = 1) => {
    const s = TREE_SPECS[kind];
    const k = scale * (0.85 + R() * 0.3);
    const r = s.r * k;
    const ry = s.ry * k;
    const th = s.trunk * k;
    const col = new THREE.Color(s.colors[Math.floor(R() * s.colors.length)]).offsetHSL(0, 0, (R() - 0.5) * 0.05);
    I.add('trunk', x, 0, z, s.tr * k, th + ry * 0.5, s.tr * k, R() * 6);
    const cy = th + ry * 0.75;
    I.add('crown', x, cy, z, r, ry, r, R() * Math.PI * 2, col);
    occ.addEllipsoid(x, cy, z, r * 0.85, ry * 0.85, OCC_TREE);
    trees.push({ x, z, kind });
  };

  const lamp = (x: number, z: number, h = 5) => {
    I.add('lampPole', x, 0, z, 1, h, 1);
    I.add('lampHead', x, h, z);
  };

  // ---------- yer qatlamlari ----------
  const [sx0, sx1, sz0, sz1] = [-190, 190, -150, 150];
  B.add('grass', flatRect(sx0, sx1, sz0, sz1, 0), UV1);

  const pave = (r: Rect, key = 'paving', y = 0.03) => B.add(key, flatRect(r[0], r[1], r[2], r[3], y), UV1);
  const road = (r: Rect) => B.add('asphalt', flatRect(r[0], r[1], r[2], r[3], 0.02), UV1);

  // janubiy ko‘cha (uchastka tashqarisida)
  road([-700, 700, 152, 170]);
  pave([-700, 700, 150, 152], 'paving', 0.06);
  pave([-700, 700, 170, 173], 'paving', 0.06);
  for (let x = -690; x < 700; x += 7) I.add('dash', x, 0.04, 161, 1, 1, 1, Math.PI / 2);

  // ceremonial drop-off halqasi
  road([-50, -40, 110, 152]);
  road([40, 50, 110, 152]);
  road([-50, 104, 110, 118]);
  road([96, 104, 118, 152]);
  // forecourt promenadasi
  pave([-100, 120, 98, 110], 'pavingWarm');
  // markaziy orol: maysa + oval havza
  const oval = new THREE.Shape();
  oval.absellipse(0, 134, 22, 7, 0, Math.PI * 2, false, 0);
  const ovalRim = new THREE.Shape();
  ovalRim.absellipse(0, 134, 23.2, 8.2, 0, Math.PI * 2, false, 0);
  B.add('stoneDark', flatShape(ovalRim, 0.35), UV1);
  const ovalWater = new THREE.Mesh(flatShape(oval, 0.42), m.water);
  applyWorldUV(ovalWater.geometry, UV1);
  ovalWater.receiveShadow = true;
  water.push(ovalWater);
  group.add(ovalWater);
  pave([-40, 40, 118, 124], 'paving');
  pave([-4, 4, 118, 150], 'paving');
  // forecourt daraxtlari (ko‘rinishni ochiq qoldirib)
  for (let z = 122; z <= 148; z += 8.5) {
    tree(-34, z, 'elm');
    tree(34, z, 'elm');
  }
  for (const x of [-96, -86, -76, 62, 72, 82, 92, 108, 116]) tree(x, 108.5, 'elm', 0.9);
  for (let x = -36; x <= 36; x += 6) if (Math.abs(x) > 8) I.add('bench', x, 0, 121.5);

  // velosiped parkingi
  for (let k = 0; k < 10; k++) I.add('fenceBar', -33 + k * 0.7, 0.03, 106, 1, 0.9, 12);

  // ---------- parking (solar carport) ----------
  const P: Rect = [-180, -124, -20, 106];
  road(P);
  road([-160, -152, 106, 152]);
  let stallCount = 0;
  const carColors = [0xf2f2f2, 0x1d1f22, 0x8a9198, 0xb8bec4, 0x2d4a73, 0x7a2a2a, 0xe8e3d8, 0x3a3f45];
  for (let mI = 0; mI < 3; mI++) {
    const bx = -180 + mI * 16;
    const rows = [bx, bx + 11];
    for (const rx of rows) {
      const cx = rx + 2.5;
      for (let z = -14, k = 0; z < 98 - 2.4; z += 2.5, k++) {
        I.add('marking', rx + 2.5, 0.04, z, 1, 1, 0.98, Math.PI / 2);
        stallCount++;
        if (R() < 0.72) {
          const col = new THREE.Color(carColors[Math.floor(R() * carColors.length)]);
          const face = rx === bx ? -1 : 1;
          const rot = face < 0 ? Math.PI / 2 : -Math.PI / 2;
          I.add('carBody', cx + (R() - 0.5) * 0.3, 0.02, z + 1.25, 1, 1, 1, rot, col);
          I.add('carTop', cx + (R() - 0.5) * 0.3, 0.02, z + 1.25, 1, 1, 1, rot);
        }
      }
      // soyabon bo‘laklari (janubga qaragan arra-tishli profil)
      for (let z = -14 + 3.7; z < 98; z += 7.5) {
        I.add('canopyPanel', cx, 3.2, z, 1, 1, 1, 0, undefined, -0.14);
        I.add('post', cx, 0, z, 1, 3.0, 1);
        occ.addBox(rx - 0.3, rx + 5.3, 2.7, 3.7, z - 3.7, z + 3.7, OCC_CANOPY);
      }
    }
    // o‘rta yo‘lak chizig‘i
    for (let z = -12; z < 96; z += 6) I.add('dash', bx + 8, 0.04, z);
  }
  // EV zaryadlash joylari (yashil)
  B.add('court', flatRect(-180, -175, 86, 98, 0.035), UV1);
  B.add('court', flatRect(-169, -164, 86, 98, 0.035), UV1);
  for (let z = -16; z <= 104; z += 10) tree(-121.5, z, 'elm', 0.9);
  for (let z = -16; z <= 104; z += 24) lamp(-119.5, z, 7);

  // ---------- sharqiy xizmat yo‘li va VIP / yer osti parking ----------
  road([178, 188, -150, 152]);
  road([119, 178, 64, 74]); // VIP yo‘li
  road([150, 178, 84, 92]); // yer osti parking kirishi
  // rampa portali: yopiq tushish yo‘li (yer ostiga Conference Centre tagiga)
  B.box('stone', 132, 150, 0, 3.6, 82.6, 84, UV1);
  B.box('stone', 132, 150, 0, 3.6, 92, 93.4, UV1);
  B.box('stone', 132, 150.6, 3.6, 4.2, 82.6, 93.4, UV1);
  B.box('darkMetal', 149.2, 149.6, 0.03, 3.6, 84, 92, UV1);
  B.add('hedge', flatRect(132, 149, 84.2, 91.8, 4.25), UV1);
  getOccluders().addBox(132, 150.6, 0, 4.2, 82.6, 93.4);
  road([100, 178, -24, -16]); // texnik zona
  road([100, 188, -150, -142]); // Residence mehmon yo‘li (shimoli-sharq)
  road([156, 178, -142, -126]); // burilish maydoni
  for (let z = -140; z < 150; z += 30) lamp(176, z, 7);

  // ---------- ichki piyoda yo‘laklari ----------
  pave([-124, -40, 16, 24]); // g‘arbiy kirish
  pave([-40, -26, 26, 52]);
  pave([26, 40, 26, 46]);
  pave([40, 124, 31, 45]); // Conference–Simulation o‘tish joyi
  pave([64, 80, -24, -15]);
  pave([72, 81, -106, 8]); // sharqiy promenada
  pave([64, 88, 1, 8]);
  pave([-30, 20, -60, -37]); // Research Commons
  pave([-6, 6, -106, -60]);
  pave([-30, -6, -84, -76]);
  pave([6, 20, -81, -73]);
  pave([-64, -56, -112, -104]);
  pave([-124, -118, -20, 106]); // parking sharqiy trotuar
  // Residence bog‘i
  pave([10, 120, -124, -118]);
  pave([60, 66, -118, -100]);
  pave([81, 120, -106, -100]);
  // jogging yo‘lagi
  const track = (r: Rect) => B.add('pavingWarm', flatRect(r[0], r[1], r[2], r[3], 0.035), UV1);
  track([-188, -184, -148, 98]);
  track([-188, 98, -148, -144]);

  // ---------- Academy Courtyard (chorbog‘) ----------
  const [cx0, cx1, cz0, cz1] = COURTYARD;
  pave([cx0, cx1, cz0, cz1], 'paving', 0.03);
  const quads: Rect[] = [
    [-34, -8, -30, -6],
    [8, 34, -30, -6],
    [-34, -8, 3, 22],
    [8, 34, 3, 22],
  ];
  for (const q of quads) {
    B.add('grass', flatRect(q[0], q[1], q[2], q[3], 0.06), UV1);
    B.box('stoneDark', q[0] - 0.3, q[1] + 0.3, 0, 0.22, q[2] - 0.3, q[2], UV1);
    B.box('stoneDark', q[0] - 0.3, q[1] + 0.3, 0, 0.22, q[3], q[3] + 0.3, UV1);
    B.box('stoneDark', q[0] - 0.3, q[0], 0, 0.22, q[2], q[3], UV1);
    B.box('stoneDark', q[1], q[1] + 0.3, 0, 0.22, q[2], q[3], UV1);
    const nx = 3;
    const nz = 3;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = q[0] + ((i + 0.5) * (q[1] - q[0])) / nx;
        const z = q[2] + ((j + 0.5) * (q[3] - q[2])) / nz;
        if (Math.hypot(x - 26, z + 22) < 9) continue; // amfiteatr joyi
        tree(x, z, 'plane', 0.95);
      }
    }
  }
  // xoch shaklidagi suv havzasi
  const pool = (r: Rect, rim = 0.45) => {
    B.box('stoneDark', r[0] - rim, r[1] + rim, 0, 0.45, r[2] - rim, r[2], UV1);
    B.box('stoneDark', r[0] - rim, r[1] + rim, 0, 0.45, r[3], r[3] + rim, UV1);
    B.box('stoneDark', r[0] - rim, r[0], 0, 0.45, r[2], r[3], UV1);
    B.box('stoneDark', r[1], r[1] + rim, 0, 0.45, r[2], r[3], UV1);
    const w = new THREE.Mesh(flatRect(r[0], r[1], r[2], r[3], 0.32), m.water);
    applyWorldUV(w.geometry, UV1);
    w.receiveShadow = true;
    water.push(w);
    group.add(w);
  };
  pool([-3.5, 3.5, -28, -9]);
  pool([-3.5, 3.5, 6, 24]);
  pool([-31, -8, -3.6, -0.4]);
  pool([8, 31, -3.6, -0.4]);
  pool([-7, 7, -8, 5]);
  // fontan markazida
  const jet = new THREE.CylinderGeometry(0.6, 0.9, 0.9, 12);
  jet.translate(0, 0.45, -1.5);
  B.add('stone', jet, UV1);
  // coffee terrace (Knowledge Centre oldida)
  for (let k = 0; k < 8; k++) {
    const x = -21 + k * 6;
    if (Math.abs(x) < 6) continue;
    I.add('table', x, 0.03, 25);
    I.add('umbrella', x, 0.03, 25);
  }
  // outdoor seminar amfiteatri (shimoli-sharqiy bo‘lakda)
  for (let s = 0; s < 3; s++) {
    const ext = new THREE.ExtrudeGeometry(
      (() => {
        const sh = new THREE.Shape();
        sh.absarc(0, 0, 4.4 + s * 1.4, 0, Math.PI, false);
        sh.absarc(0, 0, 3 + s * 1.4, Math.PI, 0, true);
        return sh;
      })(),
      { depth: 0.45 * (s + 1), bevelEnabled: false, curveSegments: 20 },
    );
    ext.rotateX(-Math.PI / 2);
    ext.translate(26, 0, -22);
    B.add('stoneWarm', ext, UV1);
  }
  // o‘rindiqlar va yoritgichlar
  for (const q of quads) {
    for (let x = q[0] + 3; x < q[1] - 1; x += 7) {
      I.add('bench', x, 0, q[2] - 1.4);
      I.add('bench', x, 0, q[3] + 1.4);
    }
    I.add('bollard', q[0] - 1, 0, q[2] - 1);
    I.add('bollard', q[1] + 1, 0, q[2] - 1);
    I.add('bollard', q[0] - 1, 0, q[3] + 1);
    I.add('bollard', q[1] + 1, 0, q[3] + 1);
  }

  // ---------- Academic va Research ichki hovlilari ----------
  for (const b of BUILDINGS) {
    if (!b.court) continue;
    const c = b.court;
    B.add('grass', flatRect(c[0] + 2, c[1] - 2, c[2] + 2, c[3] - 2, 0.05), UV1);
    pave([c[0], c[1], c[2], c[3]], 'pavingWarm', 0.03);
    const ccx = (c[0] + c[1]) / 2;
    const ccz = (c[2] + c[3]) / 2;
    tree(ccx - 6, ccz - 5, 'mulberry');
    tree(ccx + 6, ccz + 5, 'mulberry');
    tree(ccx + 6, ccz - 5, 'fruit');
    tree(ccx - 6, ccz + 5, 'fruit');
    pool([ccx - 2.5, ccx + 2.5, ccz - 2.5, ccz + 2.5], 0.35);
  }

  // ---------- Ring 3 yashil maydoni ----------
  for (let k = 0; k < 18; k++) {
    const x = -26 + R() * 44;
    const z = -100 + R() * 38;
    if (Math.abs(x) < 8 || (z > -86 && z < -72)) continue;
    tree(x, z, R() > 0.5 ? 'elm' : 'mulberry');
  }

  // ---------- Scholars’ Garden ----------
  // ariq — egri chiziq bo‘ylab tor suv kanali
  const ariqPts: [number, number][] = [];
  for (let t = 0; t <= 1.0001; t += 1 / 40) {
    const x = -170 + t * 168;
    const z = -128 + Math.sin(t * Math.PI * 2.2) * 7;
    ariqPts.push([x, z]);
  }
  for (let i = 0; i < ariqPts.length - 1; i++) {
    const [ax, az] = ariqPts[i];
    const [bx, bz] = ariqPts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const g = new THREE.PlaneGeometry(len + 0.3, 1.4);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-ang);
    g.translate((ax + bx) / 2, 0.12, (az + bz) / 2);
    const wm = new THREE.Mesh(g, m.water);
    applyWorldUV(wm.geometry, UV1);
    water.push(wm);
    group.add(wm);
    const rim = new THREE.BoxGeometry(len + 0.3, 0.3, 2.2);
    rim.rotateY(-ang);
    rim.translate((ax + bx) / 2, -0.06, (az + bz) / 2);
    B.add('stoneWarm', rim, UV1);
  }
  // aylana yo‘lak
  const loop: [number, number][] = [];
  for (let t = 0; t < 1; t += 1 / 48) {
    const a = t * Math.PI * 2;
    loop.push([-86 + Math.cos(a) * 78, -128 + Math.sin(a) * 15]);
  }
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i];
    const [bx, bz] = loop[(i + 1) % loop.length];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const g = new THREE.PlaneGeometry(len + 0.6, 2.6);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-ang);
    g.translate((ax + bx) / 2, 0.04, (az + bz) / 2);
    B.add('pavingWarm', g, UV1);
    if (i % 6 === 0) I.add('bench', ax, 0, az + 2.2, 1, 1, 1, -ang);
    if (i % 4 === 0) I.add('bollard', ax, 0, az - 2);
  }
  // pavilonlar (shiypon)
  const pavilion = (x: number, z: number, s = 5) => {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      B.box('wood', x + dx * (s / 2 - 0.3) - 0.15, x + dx * (s / 2 - 0.3) + 0.15, 0, 3.2, z + dz * (s / 2 - 0.3) - 0.15, z + dz * (s / 2 - 0.3) + 0.15, UV1);
    }
    B.box('stoneWarm', x - s / 2 - 0.5, x + s / 2 + 0.5, 3.2, 3.6, z - s / 2 - 0.5, z + s / 2 + 0.5, UV1);
    B.box('wood', x - s / 2, x + s / 2, 3.6, 4.1, z - s / 2, z + s / 2, UV1);
    B.box('stoneWarm', x - s / 2, x + s / 2, 0, 0.35, z - s / 2, z + s / 2, UV1);
    occ.addBox(x - s / 2 - 0.5, x + s / 2 + 0.5, 3.2, 4.1, z - s / 2 - 0.5, z + s / 2 + 0.5, OCC_CANOPY);
  };
  pavilion(-150, -120);
  pavilion(-96, -136);
  pavilion(-40, -121);
  pavilion(0, -112, 6); // asosiy o‘qning yakuni
  // zich daraxtzor
  const inLoopPath = (x: number, z: number) => {
    const dx = (x + 86) / 78;
    const dz = (z + 128) / 15;
    const d = Math.sqrt(dx * dx + dz * dz);
    return Math.abs(d - 1) < 0.12;
  };
  let placed = 0;
  for (let k = 0; k < 900 && placed < 170; k++) {
    const x = -178 + R() * 182;
    const z = -147 + R() * 37;
    if (inLoopPath(x, z)) continue;
    const ariqZ = -128 + Math.sin(((x + 170) / 168) * Math.PI * 2.2) * 7;
    if (Math.abs(z - ariqZ) < 3 && x > -171 && x < -1) continue;
    if (Math.hypot(x + 150, z + 120) < 6 || Math.hypot(x + 96, z + 136) < 6 || Math.hypot(x + 40, z + 121) < 6) continue;
    if (Math.abs(x) < 6 && z > -118) continue;
    if (x < -183 && z > -149) continue;
    const roll = R();
    tree(x, z, roll < 0.45 ? 'fruit' : roll < 0.75 ? 'elm' : roll < 0.9 ? 'cypress' : 'mulberry');
    placed++;
  }

  // ---------- Residence bog‘i ----------
  pool([40, 72, -115, -108], 0.4);
  for (let k = 0; k < 26; k++) {
    const x = 14 + R() * 102;
    const z = -122 + R() * 20;
    if (x > 36 && x < 76 && z > -118 && z < -105) continue;
    if (x > 58 && x < 68) continue;
    tree(x, z, R() > 0.4 ? 'fruit' : 'elm');
  }

  // ---------- sport maydonlari ----------
  const court = (r: Rect, lines: (x0: number, x1: number, z0: number, z1: number) => void) => {
    B.add('court', flatRect(r[0], r[1], r[2], r[3], 0.04), UV1);
    lines(r[0], r[1], r[2], r[3]);
  };
  const line = (x0: number, x1: number, z0: number, z1: number) => B.box('courtLine', x0, x1, 0.04, 0.06, z0, z1);
  court([136, 174, -98, -62], (x0, x1, z0, z1) => {
    // 2 ta tennis korti (har biri 10.97 × 23.77)
    for (const cx of [(x0 + (x0 + x1) / 2) / 2, ((x0 + x1) / 2 + x1) / 2]) {
      const cz = (z0 + z1) / 2;
      const hw = 5.485;
      const hl = 11.885;
      line(cx - hw, cx + hw, cz - hl - 0.05, cz - hl + 0.05);
      line(cx - hw, cx + hw, cz + hl - 0.05, cz + hl + 0.05);
      line(cx - hw - 0.05, cx - hw + 0.05, cz - hl, cz + hl);
      line(cx + hw - 0.05, cx + hw + 0.05, cz - hl, cz + hl);
      line(cx - 0.05, cx + 0.05, cz - 6.4, cz + 6.4);
      line(cx - 4.115, cx + 4.115, cz - 6.4 - 0.05, cz - 6.4 + 0.05);
      line(cx - 4.115, cx + 4.115, cz + 6.4 - 0.05, cz + 6.4 + 0.05);
      B.box('darkMetal', cx - hw - 0.9, cx + hw + 0.9, 0, 1.0, cz - 0.03, cz + 0.03);
    }
  });
  court([112, 132, -98, -74], (x0, x1, z0, z1) => {
    // 2 ta padel korti (10 × 20) shisha devor bilan
    for (const cx of [x0 + 5, x1 - 5]) {
      line(cx - 0.05, cx + 0.05, z0, z1);
      B.box('glassPlain', cx - 5, cx + 5, 0, 3, z0, z0 + 0.1);
      B.box('glassPlain', cx - 5, cx + 5, 0, 3, z1 - 0.1, z1);
      B.box('darkMetal', cx - 5, cx + 5, 0.9, 0.95, (z0 + z1) / 2 - 0.03, (z0 + z1) / 2 + 0.03);
    }
  });
  for (let x = 140; x <= 172; x += 8) {
    I.add('lampPole', x, 0, -60, 1, 9, 1);
    I.add('lampPole', x, 0, -100, 1, 9, 1);
  }

  // ---------- perimetr to‘sig‘i ----------
  const fence = (ax: number, az: number, bx: number, bz: number, h = 2.2, step = 2.4) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      I.add('fenceBar', ax + (bx - ax) * t, 0, az + (bz - az) * t, 1, h, 1);
    }
    const g = new THREE.BoxGeometry(len, 0.08, 0.08);
    const ang = Math.atan2(bz - az, bx - ax);
    g.rotateY(-ang);
    g.translate((ax + bx) / 2, h, (az + bz) / 2);
    B.add('darkMetal', g, UV1);
  };
  fence(-190, -150, 190, -150);
  fence(-190, -150, -190, 150);
  fence(190, -150, 190, 150);
  fence(-190, 150, -162, 150);
  fence(-150, 150, -50, 150);
  fence(104, 150, 178, 150);

  // perimetr teraklari
  for (let z = -146; z <= 146; z += 7) tree(-189, z, 'poplar');
  for (let x = -182; x <= 186; x += 7) if (x < 96) tree(x, -149, 'poplar');
  for (let z = -136; z <= 146; z += 7) tree(189, z, 'poplar');
  // sharqiy promenada va texnik zona daraxtlari
  for (let z = -100; z <= -24; z += 9) tree(85, z, 'elm', 0.9);
  for (let x = 92; x <= 132; x += 10) tree(x, 20, 'elm', 0.85);
  for (let x = -96; x <= -42; x += 9) tree(x, 27, 'elm', 0.85);
  for (let z = 30; z <= 60; z += 10) tree(-104, z, 'elm');
  for (let z = -36; z <= 12; z += 12) tree(-106, z, 'elm');
  // Research old tomoni
  for (let x = -88; x <= -36; x += 9) tree(x, -50, 'mulberry', 0.9);

  // ko‘cha daraxtlari va chiroqlar
  for (let x = -320; x <= 320; x += 11) {
    if (x > -55 && x < 55) continue;
    tree(x, 151.2, 'plane', 0.8);
    tree(x + 5, 172.5, 'plane', 0.75);
  }
  for (let x = -300; x <= 300; x += 33) lamp(x, 151.5, 8);
  // promenada va hovli chiroqlari
  for (let x = -96; x <= 116; x += 16) lamp(x, 104, 5);
  for (let z = -100; z <= -20; z += 16) lamp(70.5, z, 4.5);

  // butalar (gullar/butalar chegarasi)
  for (let x = -96; x <= -42; x += 2.6) I.add('shrub', x, 0.4, 61, 1.0, 0.7, 0.9);
  for (let x = 42; x <= 110; x += 2.6) I.add('shrub', x, 0.4, 43.5, 0.9, 0.6, 0.9);

  // ---------- atrofdagi shahar konteksti ----------
  const ctxCol = (t: number) => new THREE.Color().setHSL(0.09 + t * 0.03, 0.12, 0.72 + t * 0.12);
  for (let k = 0; k < 120; k++) {
    const side = R();
    let x: number;
    let z: number;
    if (side < 0.55) {
      x = -650 + R() * 1300;
      z = 190 + R() * 420;
    } else if (side < 0.8) {
      x = 220 + R() * 420;
      z = -400 + R() * 560;
    } else {
      x = -650 + R() * 420;
      z = -300 + R() * 440;
    }
    const w = 18 + R() * 40;
    const d = 14 + R() * 30;
    const h = 9 + Math.floor(R() * 6) * 3.2;
    I.add('context', x, 0, z, w, h, d, Math.round(R()) * 0.02, ctxCol(R()));
    if (R() > 0.4) tree(x + w / 2 + 4, z, 'elm', 0.9);
  }

  const mats = m as unknown as Record<string, THREE.Material>;
  const merged = B.build(mats);
  merged.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      const ground = ['grass', 'paving', 'pavingWarm', 'asphalt', 'court', 'courtLine'].includes(mesh.name);
      mesh.castShadow = !ground;
      mesh.receiveShadow = true;
    }
  });
  group.add(merged);
  group.userData.stallCount = stallCount;
  return { group, water, trees };
}
