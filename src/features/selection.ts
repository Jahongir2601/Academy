// Bino/zona tanlash: 3D yorliqlar, raycast, kontur va ma’lumot kartasi.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h, icon, fmt } from '../ui/dom';
import {
  BUILDINGS, ZONES, AREA_TARGETS, buildingGFA, buildingHeight, rectArea, rectCenter,
  type BuildingDef, type ZoneDef,
} from '../data/campus';

const SHORT: Record<string, string> = {
  grandHall: 'Grand Academy Hall',
  knowledge: 'Knowledge Centre',
  academic: 'Academic Core',
  doctoral: 'Doctoral Centre',
  simulation: 'Simulation Centre',
  datalab: 'Data, AI & Innovation',
  secure: 'Secure Data Lab',
  research: 'Research Institute',
  conference: 'Conference Centre',
  museum: 'Central Bank Museum',
  residence: 'Academy Residence',
  club: 'Academy Club',
  admin: 'Administration',
  energy: 'Technical Centre',
  courtyard: 'Academy Courtyard',
  scholars: 'Scholars’ Garden',
  parking: 'Parking',
};

type Item = { kind: 'building'; def: BuildingDef } | { kind: 'zone'; def: ZoneDef };

export class Selection {
  selected: string | null = null;
  readonly labels = new Map<string, { obj: CSS2DObject; el: HTMLElement; count: HTMLElement }>();
  private outline: THREE.LineSegments | null = null;
  private items = new Map<string, Item>();
  private zonePicks: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private down: { x: number; y: number; t: number } | null = null;
  labelsVisible = true;
  enabled = true;
  onEnterInterior: ((kind: 'grandHall' | 'mpc') => void) | null = null;
  private labelGroup = new THREE.Group();

  constructor(private app: App, private shell: Shell) {
    for (const b of BUILDINGS) this.items.set(b.id, { kind: 'building', def: b });
    for (const z of ZONES) this.items.set(z.id, { kind: 'zone', def: z });
    this.labelGroup.name = 'labels';
    app.scene.add(this.labelGroup);
    this.makeLabels();
    this.makeZonePicks();
    this.bindPointer();
    app.onFrame(() => this.updateLabelDensity());
  }

  private makeLabels() {
    const add = (id: string, no: number, x: number, y: number, z: number, zone: boolean) => {
      const count = h('span', { class: 'count' });
      const el = h(
        'div',
        { class: `blabel${zone ? ' zone' : ''}`, title: SHORT[id] },
        h('span', { class: 'numchip' }, String(no)),
        h('span', { class: 'lname' }, SHORT[id] ?? id),
        count,
      );
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(id, true);
      });
      const obj = new CSS2DObject(el);
      obj.position.set(x, y, z);
      this.labelGroup.add(obj);
      this.labels.set(id, { obj, el, count });
    };
    for (const b of BUILDINGS) {
      const [cx, cz] = rectCenter(b.rect);
      let y = buildingHeight(b) + 2;
      if (b.id === 'grandHall') y = 29;
      if (b.id === 'conference') y = 26;
      add(b.id, b.no, cx, y, cz, false);
    }
    for (const z of ZONES) {
      const [cx, cz] = rectCenter(z.rect);
      add(z.id, z.no, cx, 2, z.id === 'courtyard' ? cz + 8 : cz, true);
    }
  }

  private makeZonePicks() {
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    for (const z of ZONES) {
      const [x0, x1, z0, z1] = z.rect;
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set((x0 + x1) / 2, 0.1, (z0 + z1) / 2);
      m.userData.zoneId = z.id;
      this.zonePicks.push(m);
    }
  }

  private bindPointer() {
    const el = this.app.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.down || !this.enabled) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      const quick = performance.now() - this.down.t < 600;
      this.down = null;
      if (moved > 6 || !quick) return;
      if (this.app.activeScene !== this.app.scene) return;
      const id = this.pick(e.clientX, e.clientY);
      if (id) this.select(id, false);
      else this.clear();
    });
  }

  pick(cx: number, cy: number): string | null {
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.app.camera);
    const hits = this.raycaster.intersectObject(this.app.buildings.group, true);
    for (const hit of hits) {
      const id = hit.object.userData.buildingId as string | undefined;
      if (id) return id;
    }
    const zh = this.raycaster.intersectObjects(this.zonePicks, false);
    if (zh.length) return zh[0].object.userData.zoneId as string;
    return null;
  }

  private setOutline(id: string | null) {
    if (this.outline) {
      this.app.overlays.remove(this.outline);
      this.outline.geometry.dispose();
      this.outline = null;
    }
    if (!id) return;
    const it = this.items.get(id);
    if (!it) return;
    const [x0, x1, z0, z1] = it.def.rect;
    const hgt = it.kind === 'building' ? (id === 'grandHall' ? 27 : id === 'conference' ? 24.5 : buildingHeight(it.def) + 0.5) : 0.6;
    const pad = 1.2;
    const box = new THREE.BoxGeometry(x1 - x0 + pad * 2, hgt + 0.4, z1 - z0 + pad * 2);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xd19a4e, transparent: true, opacity: 0.95, depthTest: false }),
    );
    line.position.set((x0 + x1) / 2, hgt / 2, (z0 + z1) / 2);
    line.renderOrder = 10;
    this.outline = line;
    this.app.overlays.add(line);
  }

  clear() {
    this.selected = null;
    this.setOutline(null);
    this.labels.forEach((l) => l.el.classList.remove('sel'));
    this.shell.hideInfo();
  }

  select(id: string, fly: boolean) {
    const it = this.items.get(id);
    if (!it) return;
    this.selected = id;
    this.setOutline(id);
    this.labels.forEach((l, k) => l.el.classList.toggle('sel', k === id));
    this.shell.showInfo(this.card(it), () => {
      this.selected = null;
      this.setOutline(null);
      this.labels.forEach((l) => l.el.classList.remove('sel'));
    });
    if (fly) this.flyTo(id);
  }

  flyTo(id: string) {
    const it = this.items.get(id);
    if (!it) return;
    const [x0, x1, z0, z1] = it.def.rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const size = Math.max(x1 - x0, z1 - z0);
    const d = Math.max(45, size * 1.35);
    const hgt = it.kind === 'building' ? buildingHeight(it.def) : 0;
    this.app.flyTo({ x: cx + d * 0.55, y: hgt + d * 0.55, z: cz + d * 0.85 }, { x: cx, y: hgt * 0.4, z: cz });
  }

  private card(it: Item): HTMLElement {
    const d = it.def;
    const wrap = h('div', { style: 'display:contents' });
    const ringChip = h('span', { class: `ring-chip r${d.ring}` }, `Ring ${d.ring}`);
    wrap.append(
      h('div', { class: 'info-head' }, h('span', { class: 'numchip', title: 'Konsepsiyadagi zona raqami' }, String(d.no)), ringChip),
      h('h2', {}, d.name),
      h('p', { class: 'sub' }, d.nameUz),
      h('p', {}, d.summary),
    );
    if (it.kind === 'building') {
      const b = it.def;
      const gfa = buildingGFA(b);
      const target = AREA_TARGETS[b.category];
      wrap.append(
        h(
          'div',
          { class: 'stats' },
          h('div', { class: 'stat' }, h('b', {}, String(b.floors)), h('span', {}, b.floors === 1 ? 'qavat (baland zal)' : 'qavat')),
          h('div', { class: 'stat' }, h('b', {}, `${fmt(b.id === 'grandHall' ? 27 : b.id === 'conference' ? 24 : buildingHeight(b), 0)} m`), h('span', {}, 'balandlik')),
          h('div', { class: 'stat' }, h('b', {}, `${fmt(gfa)} m²`), h('span', {}, 'umumiy maydon (model)')),
          h('div', { class: 'stat' }, h('b', {}, `${fmt(rectArea(b.rect))} m²`), h('span', {}, 'bino izi')),
          b.capacity ? h('div', { class: 'stat wide' }, h('b', { style: `font-family:var(--body);font-size:var(--fs-m)` }, b.capacity), h('span', {}, 'sig‘im')) : null,
        ),
        h('p', {}, `Toifa: ${target.label} — konsepsiyada ${fmt(target.min / 1000)}–${fmt(target.max / 1000)} ming m².`),
      );
    } else {
      wrap.append(
        h('div', { class: 'stats' }, h('div', { class: 'stat wide' }, h('b', {}, `${fmt(rectArea(d.rect) / 10000, 2)} ga`), h('span', {}, 'hudud maydoni'))),
      );
    }
    wrap.append(h('h3', { style: 'margin:2px 0 -4px;font-size:var(--fs-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)' }, 'Tarkibi'));
    wrap.append(h('ul', {}, ...d.items.map((x) => h('li', {}, x))));
    const actions = h('div', { class: 'btn-row' });
    actions.append(h('button', { class: 'btn', onclick: () => this.flyTo(d.id) }, icon('target'), 'Yaqinlashish'));
    if (it.kind === 'building' && it.def.interior) {
      const kind = it.def.interior;
      actions.append(
        h('button', { class: 'btn primary', onclick: () => this.onEnterInterior?.(kind) }, icon('enter'),
          kind === 'grandHall' ? 'Ichkariga kirish' : 'MPC xonasiga kirish'),
      );
    }
    wrap.append(actions);
    return wrap;
  }

  setLabelsVisible(v: boolean) {
    this.labelsVisible = v;
    // CSS2DRenderer faqat obyektning o‘z `visible` qiymatini tekshiradi (ota guruhni emas)
    this.labels.forEach((l) => (l.obj.visible = v));
  }

  setCount(id: string, n: number | null) {
    const l = this.labels.get(id);
    if (!l) return;
    l.count.textContent = n === null || n === 0 ? '' : `· ${n}`;
  }

  private declutterAt = 0;

  /** Yorliqlarni tartiblash: ustma-ust tushganlari faqat raqamga qisqaradi yoki yashiriladi. */
  private updateLabelDensity() {
    if (!this.labelsVisible || this.app.activeScene !== this.app.scene) return;
    const now = performance.now();
    if (now - this.declutterAt < 220) return;
    this.declutterAt = now;
    const dist = this.app.camera.position.distanceTo(this.app.controls.target);
    const forceCompact = dist > 620 || window.innerWidth < 760;
    // ustuvorlik: tanlangan → binolar (yaqinroq) → zonalar → nazorat nuqtalari
    const cam = this.app.camera.position;
    const items = [...this.labels.entries()].map(([id, l]) => ({
      id, el: l.el, zone: this.items.get(id)?.kind === 'zone', d: l.obj.position.distanceTo(cam),
    }));
    items.sort((a, b) => (a.id === this.selected ? -1 : b.id === this.selected ? 1 : 0) || Number(a.zone) - Number(b.zone) || a.d - b.d);
    const placed: DOMRect[] = [];
    const overlaps = (r: DOMRect) => placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 1 && r.bottom > p.top - 1);
    for (const it of items) {
      it.el.classList.remove('hidden-lbl');
      it.el.classList.toggle('compact', forceCompact && it.id !== this.selected);
      if (it.el.style.display === 'none') continue;
      let r = it.el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (overlaps(r) && it.id !== this.selected) {
        it.el.classList.add('compact');
        r = it.el.getBoundingClientRect();
        if (overlaps(r)) {
          it.el.classList.add('hidden-lbl');
          continue;
        }
      }
      placed.push(r);
    }
    document.querySelectorAll<HTMLElement>('.cplabel').forEach((el) => {
      el.classList.remove('hidden-lbl');
      if (el.style.display === 'none') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (overlaps(r)) el.classList.add('hidden-lbl');
      else placed.push(r);
    });
  }
}
