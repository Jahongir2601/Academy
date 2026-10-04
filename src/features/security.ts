// «Xavfsizlik» bo‘limi: uch bosqichli ring tizimi — zonalar, bino rangi, to‘siq, nazorat nuqtalari.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h, ICONS } from '../ui/dom';
import { BUILDINGS, RING_INFO, buildingHeight, type Rect, type Ring } from '../data/campus';

export const RING_COLORS: Record<Ring, number> = { 1: 0x2f9a63, 2: 0xd99a25, 3: 0xd0453c };

export const RING_ZONES: { ring: Ring; rect: Rect }[] = [
  // Ring 1 — public
  { ring: 1, rect: [-100, 120, 98, 150] },
  { ring: 1, rect: [-92, -40, 64, 98] },
  { ring: 1, rect: [-28, 28, 50, 98] },
  { ring: 1, rect: [40, 112, 46, 98] },
  { ring: 1, rect: [-40, -28, 76, 81] },
  { ring: 1, rect: [28, 40, 76, 81] },
  { ring: 1, rect: [-180, -118, -20, 150] },
  // Ring 2 — academy
  { ring: 2, rect: [-100, 70, -44, 30] },
  { ring: 2, rect: [-100, -28, 30, 64] },
  { ring: 2, rect: [-28, 28, 30, 50] },
  { ring: 2, rect: [28, 124, 30, 46] },
  { ring: 2, rect: [70, 178, -150, 30] },
  { ring: 2, rect: [-190, 70, -150, -108] },
  { ring: 2, rect: [-118, -100, -44, 64] },
  { ring: 2, rect: [-190, -100, -108, -20] },
  // Ring 3 — secure research
  { ring: 3, rect: [-100, 60, -108, -44] },
];

export const RING3_FENCE: Rect = [-100, 60, -108, -44];

export const CHECKPOINTS: { x: number; y: number; z: number; label: string }[] = [
  { x: 0, y: 8, z: 52, label: 'Knowledge Stair · 1→2' },
  { x: -100, y: 2, z: 20, label: 'G‘arbiy kirish · 1→2' },
  { x: -52.5, y: 2, z: 58, label: 'Museum–Doctoral · 1→2' },
  { x: 52, y: 2, z: 38, label: 'Conference–Simulation · 1→2' },
  { x: 100, y: 2, z: -20, label: 'Xizmat kirishi' },
  { x: 0, y: 2, z: -45, label: 'Ring 3 darvozasi · 2→3' },
  { x: -60, y: 2, z: -108, label: 'Research orqa darvoza' },
  { x: 20, y: 2, z: -77, label: 'Secure Lab · biometrik' },
  { x: 112, y: 2, z: -146, label: 'Residence mehmon kirishi' },
];

export function mountSecurity(app: App, shell: Shell) {
  const group = new THREE.Group();
  group.name = 'security-overlay';
  group.visible = false;
  app.overlays.add(group);
  const markers: CSS2DObject[] = [];

  for (const z of RING_ZONES) {
    const [x0, x1, z0, z1] = z.rect;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: RING_COLORS[z.ring], transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }),
    );
    m.position.set((x0 + x1) / 2, 0.4 + z.ring * 0.02, (z0 + z1) / 2);
    m.renderOrder = 3;
    group.add(m);
  }
  for (const b of BUILDINGS) {
    const [x0, x1, z0, z1] = b.rect;
    const hgt = b.id === 'grandHall' ? 27 : b.id === 'conference' ? 24.5 : buildingHeight(b) + 0.4;
    const g = new THREE.BoxGeometry(x1 - x0 + 1.2, hgt, z1 - z0 + 1.2);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: RING_COLORS[b.ring], transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false }),
    );
    m.position.set((x0 + x1) / 2, hgt / 2, (z0 + z1) / 2);
    m.renderOrder = 4;
    group.add(m);
  }
  // Ring 3 to‘sig‘i — balandroq qizil chiziq
  const [fx0, fx1, fz0, fz1] = RING3_FENCE;
  const pts = [
    new THREE.Vector3(fx0, 2.2, fz0), new THREE.Vector3(fx1, 2.2, fz0),
    new THREE.Vector3(fx1, 2.2, fz1), new THREE.Vector3(fx0, 2.2, fz1), new THREE.Vector3(fx0, 2.2, fz0),
  ];
  const fence = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color: 0xd0453c, dashSize: 3, gapSize: 2, linewidth: 2 }),
  );
  fence.computeLineDistances();
  group.add(fence);
  // fizik to‘siq (har doim ko‘rinadi): past metall panjara
  const posts = new THREE.Group();
  const postG = new THREE.BoxGeometry(0.08, 2, 0.08);
  postG.translate(0, 1, 0);
  const postM = new THREE.MeshStandardMaterial({ color: 0x3a3f43, metalness: 0.6, roughness: 0.5 });
  const segs: [number, number, number, number][] = [
    // janubda (asosiy o‘qda) va shimolda (Research orqa darvozasi) darvoza uchun bo‘shliq
    [fx0, fz0, -63, fz0], [-57, fz0, fx1, fz0], [fx1, fz0, fx1, fz1], [fx1, fz1, 6, fz1], [-6, fz1, fx0, fz1], [fx0, fz1, fx0, fz0],
  ];
  let count = 0;
  for (const [ax, az, bx, bz] of segs) count += Math.round(Math.hypot(bx - ax, bz - az) / 2.5) + 1;
  const inst = new THREE.InstancedMesh(postG, postM, count);
  let k = 0;
  const mx = new THREE.Matrix4();
  for (const [ax, az, bx, bz] of segs) {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      mx.makeTranslation(ax + (bx - ax) * t, 0, az + (bz - az) * t);
      inst.setMatrixAt(k++, mx);
    }
    const len = Math.hypot(bx - ax, bz - az);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), postM);
    rail.position.set((ax + bx) / 2, 1.95, (az + bz) / 2);
    rail.rotation.y = -Math.atan2(bz - az, bx - ax);
    posts.add(rail);
  }
  inst.castShadow = true;
  posts.add(inst);
  app.campus.add(posts);

  for (const c of CHECKPOINTS) {
    const el = h('div', { class: 'cplabel', html: `${ICONS.shield}<span>${c.label}</span>` });
    const o = new CSS2DObject(el);
    o.position.set(c.x, c.y, c.z);
    o.visible = false;
    app.scene.add(o);
    markers.push(o);
  }

  const toggle = h('input', { type: 'checkbox', id: 'ring-toggle' });
  const set = (v: boolean) => {
    group.visible = v;
    markers.forEach((m) => (m.visible = v));
    toggle.checked = v;
  };
  toggle.addEventListener('change', () => set(toggle.checked));
  let first = true;

  shell.addTab({
    id: 'security',
    label: 'Xavfsizlik',
    icon: 'shield',
    onShow: () => {
      if (first) {
        set(true);
        first = false;
        app.flyTo({ x: 40, y: 330, z: 230 }, { x: 0, y: 0, z: 0 });
      }
    },
    build: (p) => {
      const legend = h('div', { class: 'legend' });
      ([1, 2, 3] as Ring[]).forEach((r) => {
        const info = RING_INFO[r];
        legend.append(
          h('div', { class: 'legend-row' },
            h('i', { style: `background:var(--ring${r})` }),
            h('div', {}, h('b', {}, `${info.name} — ${info.title}`), h('small', {}, info.items.join(' · '))),
          ),
        );
      });
      p.append(
        h('h2', {}, 'Xavfsizlik ringlari'),
        h('p', { class: 'lede' }, 'Markaziy bank uchun uch bosqichli tizim. B layoutda xavfsizlik darajasi kirishdan orqaga qarab oshib boradi.'),
        h('label', { class: 'toggle', for: 'ring-toggle' }, 'Ringlarni ko‘rsatish', toggle),
        legend,
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', {}, String(CHECKPOINTS.length)), h('span', {}, 'nazorat nuqtasi')),
          h('div', { class: 'stat' }, h('b', {}, '0'), h('span', {}, 'Ring 1 oqimining Ring 2 o‘qini kesishi')),
        ),
        h('p', { class: 'note' }, 'Konferensiya kuni 500 mehmon faqat Ring 1 da bo‘ladi: Grand Hall, Conference Centre, Museum va forecourt. Akademik o‘q va Ring 3 ishi to‘xtamaydi (1-taklif). «Odamlar» bo‘limida buni simulyatsiyada ko‘rish mumkin.'),
        h('p', { class: 'note' }, 'Secure Microdata Lab Ring 2 dagi Data Lab’dan ajratilgan va Research Institute bilan bitta Ring 3 to‘sig‘i ichida joylashgan (3-taklif).'),
      );
    },
  });
  return { set };
}
