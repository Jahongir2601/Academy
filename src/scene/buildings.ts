// Binolar generatori: fasad ritmi (vertikal pilasterlar), chuqur derazalar,
// qavat kamarlari, parapet, girih panjaralar va har bir binoning o‘ziga xos elementlari.
import * as THREE from 'three';
import { GeoBuilder, type UVMode } from '../core/geo';
import { getMaterials, textTexture } from '../core/materials';
import { Instancer } from '../core/instancer';
import { Occluders, OCC_BUILDING } from '../core/occluders';
import { BUILDINGS, buildingHeight, type BuildingDef, type Rect } from '../data/campus';

type Side = 'n' | 's' | 'e' | 'w';
type SideSpec = boolean | [number, number][];

interface BlockOpts {
  rect: Rect;
  y0?: number;
  height: number;
  floors: number;
  floorH: number;
  bay: number;
  finW: number;
  inset: number;
  plinth?: number;
  parapet?: number;
  band?: number;
  sides?: Partial<Record<Side, SideSpec>>;
  glass?: 'glass' | 'glassPlain';
  frame?: string;
  fin?: string;
  plinthKey?: string;
  /** Bay to‘liq tosh bilan yopiladimi. */
  solid?: (side: Side, i: number, n: number, floor: number) => boolean;
  /** Bay oldida bronza girih panjara. */
  screen?: (side: Side, i: number, n: number, floor: number) => boolean;
  noBands?: boolean;
  noFins?: Side[];
  roof?: boolean;
}

const STONE_UV: UVMode = { su: 1, sv: 1 };

function sideGeom(r: Rect, side: Side) {
  const [x0, x1, z0, z1] = r;
  switch (side) {
    case 'n': return { fixed: z0, along: 'x' as const, a0: x0, a1: x1, out: -1 };
    case 's': return { fixed: z1, along: 'x' as const, a0: x0, a1: x1, out: 1 };
    case 'w': return { fixed: x0, along: 'z' as const, a0: z0, a1: z1, out: -1 };
    case 'e': return { fixed: x1, along: 'z' as const, a0: z0, a1: z1, out: 1 };
  }
}

/**
 * Fasad tekisligiga nisbatan quti: along — fasad bo‘ylab [a,b], perp — tashqi chiziqdan
 * ichkariga [d0,d1] masofa (musbat — ichkariga), y — [y0,y1].
 */
function sideBox(
  B: GeoBuilder, key: string, sg: ReturnType<typeof sideGeom>,
  a: number, b: number, d0: number, d1: number, y0: number, y1: number, uv: UVMode = STONE_UV,
) {
  const p0 = sg.fixed - sg.out * d0;
  const p1 = sg.fixed - sg.out * d1;
  if (sg.along === 'x') B.box(key, a, b, y0, y1, Math.min(p0, p1), Math.max(p0, p1), uv);
  else B.box(key, Math.min(p0, p1), Math.max(p0, p1), y0, y1, a, b, uv);
}

function sidePlane(
  B: GeoBuilder, key: string, sg: ReturnType<typeof sideGeom>,
  a: number, b: number, d: number, y0: number, y1: number, uv: UVMode,
) {
  const w = b - a;
  const h = y1 - y0;
  if (w <= 0.01 || h <= 0.01) return;
  const g = new THREE.PlaneGeometry(w, h);
  const p = sg.fixed - sg.out * d;
  if (sg.along === 'x') {
    if (sg.out < 0) g.rotateY(Math.PI);
    g.translate((a + b) / 2, (y0 + y1) / 2, p);
  } else {
    g.rotateY(sg.out > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(p, (y0 + y1) / 2, (a + b) / 2);
  }
  B.add(key, g, uv);
}

function intervals(spec: SideSpec | undefined, a0: number, a1: number): [number, number][] {
  if (spec === undefined || spec === true) return [[a0, a1]];
  if (spec === false) return [];
  return spec;
}

export function addBlock(B: GeoBuilder, o: BlockOpts) {
  const [x0, x1, z0, z1] = o.rect;
  const y0 = o.y0 ?? 0;
  const top = y0 + o.height;
  const plinth = o.plinth ?? 1.2;
  const parapet = o.parapet ?? 1.0;
  const band = o.band ?? 0.45;
  const ins = o.inset;
  const frame = o.frame ?? 'stone';
  const finKey = o.fin ?? frame;
  const glassKey = o.glass ?? 'glass';
  const gy0 = y0 + plinth;
  const gy1 = top - parapet;

  // plinth (tagkursi)
  if (plinth > 0) {
    B.box(o.plinthKey ?? 'stoneDark', x0 - 0.12, x1 + 0.12, y0, gy0, z0 - 0.12, z1 + 0.12, STONE_UV);
  }
  // tom plitasi
  if (o.roof !== false) B.box('roof', x0 + 0.25, x1 - 0.25, gy1 - 0.35, gy1 + 0.12, z0 + 0.25, z1 - 0.25, STONE_UV);

  const sides: Side[] = ['n', 's', 'e', 'w'];
  for (const side of sides) {
    const sg = sideGeom(o.rect, side);
    const ivs = intervals(o.sides?.[side], sg.a0, sg.a1);
    for (const [ia, ib] of ivs) {
      const len = ib - ia;
      if (len < 0.5) continue;
      const atStart = Math.abs(ia - sg.a0) < 0.01;
      const atEnd = Math.abs(ib - sg.a1) < 0.01;
      const ga = atStart ? ia + ins : ia;
      const gb = atEnd ? ib - ins : ib;

      // shisha (bay bo‘yicha tekislangan UV)
      const su = glassKey === 'glass' ? o.bay * 8 : 1;
      const sv = glassKey === 'glass' ? o.floorH * 8 : 1;
      const glassUV: UVMode = { su, sv, ou: -sg.a0 / su, ov: -gy0 / sv };
      sidePlane(B, glassKey, sg, ga, gb, ins, gy0, gy1, glassUV);

      // parapet + karniz
      sideBox(B, frame, sg, ia - (atStart ? 0.15 : 0), ib + (atEnd ? 0.15 : 0), -0.15, Math.max(0.5, ins * 0.7), gy1 - 0.15, top);

      const n = Math.max(1, Math.round(len / o.bay));
      const step = len / n;
      // qavat kamarlari
      if (!o.noBands) {
        for (let f = 1; f < o.floors; f++) {
          const y = gy0 + f * o.floorH;
          sideBox(B, frame, sg, ga, gb, 0, ins, y - band / 2, y + band / 2);
        }
      }
      // pilasterlar
      const finsHere = !(o.noFins ?? []).includes(side);
      if (finsHere) {
        for (let k = 0; k <= n; k++) {
          if (k === 0 && atStart) continue;
          if (k === n && atEnd) continue;
          const c = ia + k * step;
          sideBox(B, finKey, sg, c - o.finW / 2, c + o.finW / 2, 0, ins + 0.05, gy0, gy1 - 0.15);
        }
      }
      // yopiq baylar va panjaralar
      for (let k = 0; k < n; k++) {
        const ba = ia + k * step + (finsHere ? o.finW / 2 : 0);
        const bb = ia + (k + 1) * step - (finsHere ? o.finW / 2 : 0);
        const ba2 = k === 0 && atStart ? Math.max(ba, ia + ins) : ba;
        const bb2 = k === n - 1 && atEnd ? Math.min(bb, ib - ins) : bb;
        for (let f = 0; f < o.floors; f++) {
          const fy0 = gy0 + f * o.floorH + (o.noBands ? 0 : band / 2);
          const fy1 = Math.min(gy1 - 0.15, gy0 + (f + 1) * o.floorH - (o.noBands ? 0 : band / 2));
          if (o.solid?.(side, k, n, f)) {
            sideBox(B, frame, sg, ba2, bb2, ins * 0.35, ins + 0.02, fy0, fy1);
          } else if (o.screen?.(side, k, n, f)) {
            sidePlane(B, 'screen', sg, ba2, bb2, ins * 0.35, fy0, fy1, { su: 1.6, sv: 1.6 });
          }
        }
      }
    }
  }

  // burchak pilonlari (ikkala yon ham tashqi bo‘lsa)
  const ext = (s: Side) => o.sides?.[s] === undefined || o.sides?.[s] === true;
  const cw = Math.max(o.finW * 1.5, ins + 0.4);
  const corners: [number, number, Side, Side][] = [
    [x0, z0, 'n', 'w'], [x1, z0, 'n', 'e'], [x0, z1, 's', 'w'], [x1, z1, 's', 'e'],
  ];
  for (const [cx, cz, s1, s2] of corners) {
    if (!(ext(s1) && ext(s2))) continue;
    const sx = cx === x0 ? 1 : -1;
    const sz = cz === z0 ? 1 : -1;
    B.box(frame, cx, cx + sx * cw, gy0, gy1 - 0.15, cz, cz + sz * cw, STONE_UV);
  }
}

/** Tomdagi quyosh panellari (instanced). */
function roofSolar(I: Instancer, x0: number, x1: number, z0: number, z1: number, y: number) {
  const rowStep = 3.2;
  for (let z = z0 + 1.5; z < z1 - 1; z += rowStep) {
    for (let x = x0 + 1.2; x < x1 - 1; x += 1.15) {
      I.add('roofPanel', x, y + 0.55, z, 1, 1, 1, 0, undefined, -0.42);
    }
  }
}

function roofUnits(B: GeoBuilder, x: number, z: number, y: number, w: number, d: number, h = 2.2) {
  B.box('darkMetal', x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2, STONE_UV);
  B.box('roof', x - w / 2 - 0.1, x + w / 2 + 0.1, y + h, y + h + 0.15, z - d / 2 - 0.1, z + d / 2 + 0.1, STONE_UV);
}

/** Kirish soyaboni: yupqa plita + ingichka ustunlar. */
function canopy(B: GeoBuilder, x0: number, x1: number, z0: number, z1: number, y: number, cols: [number, number][]) {
  B.box('bronze', x0, x1, y, y + 0.35, z0, z1, STONE_UV);
  B.box('wood', x0 + 0.1, x1 - 0.1, y - 0.06, y, z0 + 0.1, z1 - 0.1, STONE_UV);
  for (const [cx, cz] of cols) B.box('darkMetal', cx - 0.15, cx + 0.15, 0, y, cz - 0.15, cz + 0.15, STONE_UV);
}

export interface BuiltBuilding {
  def: BuildingDef;
  group: THREE.Group;
  height: number;
  /** Interyer rejimida yashiriladigan qismlar. */
  shell: THREE.Object3D[];
}

const OCC = new Occluders();
export function getOccluders() {
  return OCC;
}

function occ(r: Rect, y0: number, y1: number) {
  OCC.addBox(r[0], r[1], y0, y1, r[2], r[3], OCC_BUILDING);
}

function makeBuilding(def: BuildingDef, I: Instancer, extras: THREE.Group): BuiltBuilding {
  const B = new GeoBuilder();
  const h = buildingHeight(def);
  const [x0, x1, z0, z1] = def.rect;
  const all = () => true;

  switch (def.style) {
    case 'grandHall': {
      // asosiy hajm (portik orqasida)
      const main: Rect = [x0, x1, z0, 90];
      addBlock(B, {
        rect: main, height: 22, floors: 1, floorH: 19.8, bay: 4, finW: 1.5, inset: 1.1,
        glass: 'glassPlain', noBands: true, sides: { s: false },
        solid: (side, i, n) => side === 'n' ? i % 3 === 1 : i % 2 === 0 || i === 0 || i === n - 1,
      });
      occ(main, 0, 22);
      // portik: antalar, ustunlar, antablement
      B.box('stone', x0, x0 + 4, 0, 22, 90, 98, STONE_UV);
      B.box('stone', x1 - 4, x1, 0, 22, 90, 98, STONE_UV);
      occ([x0, x0 + 4, 90, 98], 0, 22);
      occ([x1 - 4, x1, 90, 98], 0, 22);
      B.box('stone', x0 + 4, x1 - 4, 17.2, 22, 90, 98.4, STONE_UV);
      B.box('stoneDark', x0 + 3.8, x1 - 3.8, 16.9, 17.3, 89.8, 98.6, STONE_UV);
      occ([x0, x1, 90, 98.4], 17, 22);
      for (let k = 0; k < 8; k++) {
        const cx = -21 + k * 6;
        B.box('stone', cx - 0.8, cx + 0.8, 1.2, 16.9, 96.0, 97.6, STONE_UV);
        B.box('stoneDark', cx - 1.0, cx + 1.0, 1.2, 1.7, 95.8, 97.8, STONE_UV);
        occ([cx - 0.8, cx + 0.8, 96, 97.6], 0, 17);
      }
      // podium va zinapoyalar
      B.box('stoneDark', x0 + 2, x1 - 2, 0, 1.2, 88, 99, STONE_UV);
      for (let s = 0; s < 6; s++) {
        B.box('stoneWarm', x0 + 2, x1 - 2, 0, 1.2 - s * 0.2, 99 + s * 0.9, 99.9 + s * 0.9, STONE_UV);
      }
      // loggia orqa devori: markazda shisha + girih panjara
      B.box('stone', x0 + 4, -14, 1.2, 17.2, 89.2, 90, STONE_UV);
      B.box('stone', 14, x1 - 4, 1.2, 17.2, 89.2, 90, STONE_UV);
      B.box('glassPlain', -14, 14, 1.2, 17.2, 89.4, 89.6, STONE_UV);
      const scr = new THREE.PlaneGeometry(28, 16);
      scr.translate(0, 9.2, 90.3);
      B.add('screen', scr, { su: 2.4, sv: 2.4 });
      B.box('bronze', -14.4, 14.4, 16.9, 17.3, 89.8, 90.6, STONE_UV);
      B.box('bronze', -14.4, -13.9, 1.2, 17.2, 89.8, 90.6, STONE_UV);
      B.box('bronze', 13.9, 14.4, 1.2, 17.2, 89.8, 90.6, STONE_UV);
      // fonar (yuqori yorug‘lik)
      addBlock(B, {
        rect: [-12, 12, 58, 82], y0: 21.4, height: 5.4, floors: 1, floorH: 4.2, bay: 2, finW: 0.35,
        inset: 0.5, plinth: 0.2, parapet: 0.8, glass: 'glassPlain', fin: 'bronze', noBands: true,
      });
      occ([-12, 12, 58, 82], 21, 26.8);
      // yozuv
      const t = textTexture('O‘ZBEKISTON MARKAZIY BANKI AKADEMIYASI', { w: 2048, h: 128, color: '#c19a5b' });
      const ins = new THREE.Mesh(
        new THREE.PlaneGeometry(36, 2.25),
        new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.7, roughness: 0.35, color: 0xffffff }),
      );
      ins.position.set(0, 19.6, 98.45);
      extras.add(ins);
      break;
    }

    case 'knowledge': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 3, floorH: 5, bay: 3, finW: 0.5, inset: 0.9,
        sides: { s: false }, noFins: ['n'],
        solid: (side, i, n) => (side === 'e' || side === 'w') && i % 2 === 0 && i !== n,
      });
      occ(def.rect, 0, h);
      // shimoliy fasad: yog‘och vertikal jalyuzilar
      for (let x = x0 + 1.2; x < x1 - 1; x += 1.2) {
        B.box('wood', x - 0.09, x + 0.09, 6.2, h - 1.1, z0 + 0.05, z0 + 0.8, STONE_UV);
      }
      // 1-qavat kolonnadasi (coffee terrace oldida)
      for (let x = x0 + 4; x < x1 - 2; x += 6) {
        B.box('stone', x - 0.4, x + 0.4, 1.2, 6.2, z0 - 4.6, z0 - 3.8, STONE_UV);
      }
      B.box('stone', x0 + 1, x1 - 1, 6.0, 6.8, z0 - 5, z0, STONE_UV);
      occ([x0 + 1, x1 - 1, z0 - 5, z0], 6, 6.8);
      // tom bog‘i
      for (let x = x0 + 4; x < x1 - 4; x += 8) B.box('hedge', x - 2, x + 2, h - 1, h - 0.3, z0 + 4, z1 - 4, STONE_UV);
      break;
    }

    case 'academic': {
      const c = def.court!;
      const common = { height: h, floors: 4, floorH: 4.2, bay: 3, finW: 0.55, inset: 0.85 };
      const strips: { rect: Rect; sides: Partial<Record<Side, SideSpec>> }[] = [
        { rect: [x0, x1, z0, c[2]], sides: { s: [[c[0], c[1]]] } },
        { rect: [x0, x1, c[3], z1], sides: { n: [[c[0], c[1]]] } },
        { rect: [x0, c[0], c[2], c[3]], sides: { n: false, s: false } },
        { rect: [c[1], x1, c[2], c[3]], sides: { n: false, s: false } },
      ];
      for (const s of strips) {
        addBlock(B, {
          ...common, rect: s.rect, sides: s.sides,
          solid: (side, i, _n, f) => (side === 'n' || side === 's') && f < 3 && i % 5 === 0,
        });
        occ(s.rect, 0, h);
      }
      roofSolar(I, x0 + 2, x1 - 2, z0 + 2, c[2] - 2, h - 1);
      roofSolar(I, x0 + 2, x1 - 2, c[3] + 2, z1 - 2, h - 1);
      roofUnits(B, -88, -8, h - 1, 5, 6);
      // kirish soyaboni (hovli tomondan)
      canopy(B, x1, x1 + 3.5, -14, -6, 4.2, [[x1 + 3.3, -13.8], [x1 + 3.3, -6.2]]);
      // ichki hovli: daraxtlar landshaftda
      break;
    }

    case 'doctoral': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 2, floorH: 6, bay: 4, finW: 0.7, inset: 1.0,
        solid: (side, i) => side === 'w' && i % 2 === 1,
      });
      occ(def.rect, 0, h);
      // himoya zallari — tomdagi baland hajmlar (clerestory)
      for (const [za, zb] of [[25, 36], [38, 49]] as const) {
        addBlock(B, {
          rect: [x0 + 3, x1 - 3, za, zb], y0: h - 1.2, height: 3.8, floors: 1, floorH: 2.4, bay: 2,
          finW: 0.3, inset: 0.4, plinth: 0.3, parapet: 0.8, glass: 'glassPlain', noBands: true, fin: 'bronze',
        });
        occ([x0 + 3, x1 - 3, za, zb], h - 1, h + 2.6);
      }
      break;
    }

    case 'simulation': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 2, floorH: 6, bay: 3, finW: 0.5, inset: 1.0,
        screen: (side, _i, _n, f) => f === 1 && (side === 'w' || side === 's'),
        solid: (side, i, _n, f) => side === 'e' && f === 1 && i % 2 === 0,
      });
      occ(def.rect, 0, h);
      // "data window" — fasaddan chiqib turgan quti
      B.box('darkMetal', x0 - 2.4, x0, 6.6, 12.2, 6, 18, STONE_UV);
      B.box('glassPlain', x0 - 2.5, x0 - 2.3, 7.2, 11.6, 6.6, 17.4, STONE_UV);
      occ([x0 - 2.4, x0, 6, 18], 6.6, 12.2);
      roofUnits(B, 55, 6, h - 1, 4, 8, 2.6);
      roofUnits(B, 55, 20, h - 1, 4, 5, 2.0);
      break;
    }

    case 'datalab': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 2, floorH: 5, bay: 2.4, finW: 0.25, inset: 0.7,
        frame: 'stone', fin: 'darkMetal',
      });
      occ(def.rect, 0, h);
      roofSolar(I, x0 + 1.5, x1 - 1.5, z0 + 1.5, z1 - 1.5, h - 1);
      break;
    }

    case 'secure': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 2, floorH: 5, bay: 3, finW: 0.6, inset: 0.9,
        frame: 'stoneDark', fin: 'darkMetal',
        screen: (side, i) => !(side === 'w' && i === 4),
      });
      occ(def.rect, 0, h);
      // sovutish qurilmalari
      for (let k = 0; k < 4; k++) {
        const cx = x0 + 5 + k * 6.5;
        const cyl = new THREE.CylinderGeometry(1.4, 1.4, 1.8, 14);
        cyl.translate(cx, h + 0.2, z0 + 6);
        B.add('darkMetal', cyl, STONE_UV);
        const cyl2 = new THREE.CylinderGeometry(1.4, 1.4, 1.8, 14);
        cyl2.translate(cx, h + 0.2, z0 + 11);
        B.add('darkMetal', cyl2, STONE_UV);
      }
      roofUnits(B, x0 + 15, z1 - 6, h - 1, 14, 5, 2.4);
      break;
    }

    case 'research': {
      const c = def.court!;
      const common = {
        height: h, floors: 3, floorH: 4.2, bay: 2.4, finW: 0.3, inset: 0.75, frame: 'stoneWarm', fin: 'wood',
      };
      const strips: { rect: Rect; sides: Partial<Record<Side, SideSpec>> }[] = [
        { rect: [x0, x1, z0, c[2]], sides: { s: [[c[0], c[1]]] } },
        { rect: [x0, x1, c[3], z1], sides: { n: [[c[0], c[1]]] } },
        { rect: [x0, c[0], c[2], c[3]], sides: { n: false, s: false } },
        { rect: [c[1], x1, c[2], c[3]], sides: { n: false, s: false } },
      ];
      for (const s of strips) {
        addBlock(B, { ...common, rect: s.rect, sides: s.sides });
        occ(s.rect, 0, h);
      }
      roofSolar(I, x0 + 2, x1 - 2, z0 + 2, c[2] - 2, h - 1);
      canopy(B, x1, x1 + 3, -84, -76, 3.8, [[x1 + 2.8, -83.8], [x1 + 2.8, -76.2]]);
      break;
    }

    case 'conference': {
      // foye: janubiy va g‘arbiy L-shaklli shishali qism
      const foyerS: Rect = [x0, x1, 86, z1];
      const foyerW: Rect = [x0, 52, z0, 86];
      addBlock(B, {
        rect: foyerS, height: 12.2, floors: 2, floorH: 5.5, bay: 3, finW: 0.4, inset: 1.0, sides: { n: false },
        screen: (side, _i, _n, f) => side === 's' && f === 1,
      });
      addBlock(B, {
        rect: foyerW, height: 12.2, floors: 2, floorH: 5.5, bay: 3, finW: 0.4, inset: 1.0, sides: { s: false, e: false },
      });
      occ(foyerS, 0, 12.2);
      occ(foyerW, 0, 12.2);
      // auditoriya hajmi
      const aud: Rect = [52, 104, 50, 86];
      addBlock(B, {
        rect: aud, height: 19.5, floors: 1, floorH: 17.3, bay: 4, finW: 1.4, inset: 0.8, noBands: true,
        sides: { s: false, w: false, e: false }, solid: all,
      });
      occ(aud, 0, 19.5);
      // sahna minorasi
      const fly: Rect = [66, 92, z0, 56];
      addBlock(B, {
        rect: fly, height: 24, floors: 1, floorH: 21.8, bay: 4, finW: 1.4, inset: 0.8, noBands: true, solid: all,
      });
      occ(fly, 0, 24);
      // sharqiy qism (auditoriya yonida xizmat)
      const eastPart: Rect = [104, x1, z0, 86];
      addBlock(B, {
        rect: eastPart, height: 12.2, floors: 2, floorH: 5.5, bay: 3, finW: 0.4, inset: 0.9, sides: { w: false, s: false },
        solid: (side, i) => side === 'e' && i % 3 !== 1,
      });
      occ(eastPart, 0, 12.2);
      // asosiy kirish soyaboni va VIP soyaboni
      canopy(B, 58, 94, z1, z1 + 7, 6.5, [[59, z1 + 6.6], [76, z1 + 6.6], [93, z1 + 6.6]]);
      occ([58, 94, z1, z1 + 7], 6.4, 6.9);
      canopy(B, x1, x1 + 7, 62, 76, 5.2, [[x1 + 6.6, 62.5], [x1 + 6.6, 75.5]]);
      roofSolar(I, x0 + 2, x1 - 2, 87.5, z1 - 2, 11.2);
      break;
    }

    case 'museum': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 1, floorH: 8.8, bay: 4, finW: 1.2, inset: 1.2,
        glass: 'glassPlain', noBands: true,
        solid: (side, i, n) => {
          if (side === 's') return !(i === Math.floor(n / 2) || i === Math.floor(n / 2) - 1) && i % 3 !== 1;
          return i % 3 !== 1;
        },
      });
      occ(def.rect, 0, h);
      // bronza portal
      B.box('bronze', -72, -60, 0, 8.6, z1 - 0.2, z1 + 1.6, STONE_UV);
      B.box('glassPlain', -70.8, -61.2, 0.2, 7.6, z1 + 1.55, z1 + 1.7, STONE_UV);
      occ([-72, -60, z1 - 0.2, z1 + 1.6], 0, 8.6);
      // tom yorug‘lik yo‘laklari
      for (let z = z0 + 5; z < z1 - 4; z += 7) {
        B.box('glassPlain', x0 + 4, x1 - 4, h - 1, h + 0.6, z, z + 1.6, STONE_UV);
      }
      break;
    }

    case 'residence': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 4, floorH: 3.6, bay: 3.6, finW: 0.35, inset: 0.6,
        frame: 'stoneWarm', fin: 'wood',
      });
      occ(def.rect, 0, h);
      // janubiy balkonlar (bog‘ tomonga)
      const nb = Math.round((x1 - x0) / 3.6);
      const st = (x1 - x0) / nb;
      for (let f = 1; f < 4; f++) {
        const y = 1.2 + f * 3.6;
        for (let k = 0; k < nb; k++) {
          const x = x0 + (k + 0.5) * st;
          B.box('stoneWarm', x - st / 2 + 0.25, x + st / 2 - 0.25, y - 0.2, y, z1, z1 + 1.4, STONE_UV);
          B.box('glassPlain', x - st / 2 + 0.25, x + st / 2 - 0.25, y, y + 1.05, z1 + 1.32, z1 + 1.4, STONE_UV);
        }
      }
      occ([x0, x1, z1, z1 + 1.4], 4.6, 13);
      roofSolar(I, x0 + 2, x1 - 30, z0 + 1.5, z1 - 1.5, h - 1);
      // lobbi soyaboni (sharqiy uch)
      canopy(B, x1 - 14, x1, z0 - 4, z0, 4.0, [[x1 - 13.6, z0 - 3.6]]);
      break;
    }

    case 'club': {
      const main: Rect = [x0, x1, z0, -114];
      addBlock(B, {
        rect: main, height: h, floors: 2, floorH: 5, bay: 3, finW: 0.4, inset: 0.8, frame: 'stoneWarm', fin: 'wood',
      });
      occ(main, 0, h);
      // basseyn zali — shishali pavilon
      const pool: Rect = [x0, x1, -114, z1];
      addBlock(B, {
        rect: pool, height: 8.4, floors: 1, floorH: 6.2, bay: 4, finW: 0.3, inset: 0.4, glass: 'glassPlain',
        fin: 'wood', noBands: true, sides: { n: false }, plinth: 1.0,
      });
      occ(pool, 0, 8.4);
      B.box('pool', x0 + 6, x1 - 6, 1.05, 1.15, -111, z1 - 3, STONE_UV);
      B.box('wood', x0 + 0.4, x1 - 0.4, 7.25, 7.4, -113.6, z1 - 0.4, STONE_UV);
      roofSolar(I, x0 + 2, x1 - 2, z0 + 2, -116, h - 1);
      break;
    }

    case 'admin': {
      addBlock(B, { rect: def.rect, height: h, floors: 3, floorH: 4, bay: 3, finW: 0.5, inset: 0.8 });
      occ(def.rect, 0, h);
      roofUnits(B, (x0 + x1) / 2, (z0 + z1) / 2, h - 1, 8, 6);
      break;
    }

    case 'energy': {
      addBlock(B, {
        rect: def.rect, height: h, floors: 1, floorH: 7, bay: 2, finW: 0.18, inset: 0.4,
        frame: 'stoneDark', fin: 'darkMetal', glass: 'glassPlain', noBands: true,
        solid: (_s, i) => i % 4 !== 0,
      });
      occ(def.rect, 0, h);
      roofSolar(I, x0 + 1.5, x1 - 1.5, z0 + 1.5, z1 - 1.5, h - 1);
      for (let k = 0; k < 3; k++) {
        const cyl = new THREE.CylinderGeometry(2.4, 2.8, 5, 16);
        cyl.translate(x1 + 4, 2.5, z0 + 5 + k * 7);
        B.add('darkMetal', cyl, STONE_UV);
        OCC.addBox(x1 + 1.6, x1 + 6.4, 0, 5, z0 + 2.6 + k * 7, z0 + 7.4 + k * 7);
      }
      break;
    }
  }

  const mats = getMaterials() as unknown as Record<string, THREE.Material>;
  const group = B.build(mats);
  group.name = def.id;
  group.userData.buildingId = def.id;
  group.traverse((o) => (o.userData.buildingId = def.id));
  return { def, group, height: h, shell: [group] };
}

export interface BuildingsResult {
  group: THREE.Group;
  list: BuiltBuilding[];
  byId: Map<string, BuiltBuilding>;
}

export function buildBuildings(I: Instancer): BuildingsResult {
  const m = getMaterials();
  const panel = new THREE.BoxGeometry(1.0, 0.05, 1.9);
  I.define('roofPanel', panel, m.solar);

  const group = new THREE.Group();
  group.name = 'buildings';
  const list: BuiltBuilding[] = [];
  const byId = new Map<string, BuiltBuilding>();
  for (const def of BUILDINGS) {
    const extras = new THREE.Group();
    const b = makeBuilding(def, I, extras);
    if (extras.children.length) {
      extras.traverse((o) => (o.userData.buildingId = def.id));
      b.group.add(extras);
    }
    group.add(b.group);
    list.push(b);
    byId.set(def.id, b);
  }
  return { group, list, byId };
}

