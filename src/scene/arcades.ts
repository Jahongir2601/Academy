// Ravoqlar (yopiq galereyalar): o‘tkir uchli arkalar, tom plitasi va yog‘och shift.
// Toshkent issig‘ida bloklarni soyali piyoda yo‘llari bilan bog‘laydi (5-taklif).
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo';
import { getMaterials } from '../core/materials';
import { getOccluders } from './buildings';
import { OCC_ARCADE } from '../core/occluders';
import type { Rect } from '../data/campus';

type Edge = 'n' | 's' | 'e' | 'w';

export interface ArcadeDef {
  rect: Rect;
  arches: Edge[];
}

export const ARCADES: ArcadeDef[] = [
  // Courtyard perimetri
  { rect: [-40, -35, -32, 26], arches: ['e'] },
  { rect: [35, 40, -32, 26], arches: ['w'] },
  { rect: [-40, 40, -37, -32], arches: ['n', 's'] },
  { rect: [-40, -26, 26, 31], arches: ['n'] },
  { rect: [26, 40, 26, 31], arches: ['n'] },
  // bloklar orasidagi bog‘lovchilar
  { rect: [-40, -28, 76, 81], arches: ['n', 's'] },
  { rect: [28, 40, 76, 81], arches: ['n', 's'] },
  { rect: [-55, -50, 52, 64], arches: ['e', 'w'] },
  { rect: [-124, -96, 17.5, 22.5], arches: ['n', 's'] },
  { rect: [-96, -40, 18, 22], arches: [] },
  { rect: [49.5, 54.5, 30, 46], arches: ['e', 'w'] },
  { rect: [64, 74, -22, -17], arches: ['n', 's'] },
  { rect: [74, 79, -104, -17], arches: ['e', 'w'] },
  { rect: [64, 88, 2, 7], arches: ['n', 's'] },
  { rect: [-62.5, -57.5, -112, -104], arches: ['e', 'w'] },
  { rect: [-2.5, 2.5, -46, -37], arches: ['e', 'w'] },
];

const H = 7.2; // panel balandligi
const BAY = 4;

function archPanelGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const a = 1.45; // ochiq qism yarim eni
  s.moveTo(-BAY / 2, 0);
  s.lineTo(-a, 0);
  s.lineTo(-a, 4.0);
  s.bezierCurveTo(-a, 5.0, -0.55, 5.85, 0, 6.15);
  s.bezierCurveTo(0.55, 5.85, a, 5.0, a, 4.0);
  s.lineTo(a, 0);
  s.lineTo(BAY / 2, 0);
  s.lineTo(BAY / 2, H);
  s.lineTo(-BAY / 2, H);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -0.3);
  return g;
}

export function buildArcades(): THREE.Group {
  const m = getMaterials();
  const B = new GeoBuilder();
  const occ = getOccluders();
  const panel = archPanelGeometry();
  const matrices: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  for (const a of ARCADES) {
    const [x0, x1, z0, z1] = a.rect;
    // tom plitasi va yog‘och shift
    B.box('stone', x0 - 0.3, x1 + 0.3, H, H + 0.55, z0 - 0.3, z1 + 0.3);
    B.box('wood', x0 + 0.3, x1 - 0.3, H - 0.08, H, z0 + 0.3, z1 - 0.3);
    occ.addBox(x0 - 0.3, x1 + 0.3, H, H + 0.55, z0 - 0.3, z1 + 0.3, OCC_ARCADE);
    // poldagi tosh
    B.box('stoneWarm', x0, x1, 0, 0.06, z0, z1);

    for (const e of a.arches) {
      const alongX = e === 'n' || e === 's';
      const len = alongX ? x1 - x0 : z1 - z0;
      const n = Math.max(1, Math.round(len / BAY));
      const step = len / n;
      const fixed = e === 'n' ? z0 + 0.3 : e === 's' ? z1 - 0.3 : e === 'w' ? x0 + 0.3 : x1 - 0.3;
      const rot = alongX ? 0 : Math.PI / 2;
      q.setFromAxisAngle(up, rot);
      for (let k = 0; k < n; k++) {
        const c = (alongX ? x0 : z0) + (k + 0.5) * step;
        const pos = alongX ? new THREE.Vector3(c, 0, fixed) : new THREE.Vector3(fixed, 0, c);
        matrices.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(step / BAY, 1, 1)));
      }
    }
  }

  const group = B.build(m as unknown as Record<string, THREE.Material>);
  const inst = new THREE.InstancedMesh(panel, m.stone, matrices.length);
  matrices.forEach((mx, i) => inst.setMatrixAt(i, mx));
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.name = 'arches';
  // ExtrudeGeometry UV’lari shakl koordinatalarida (metrda) — tosh teksturasiga mos
  group.add(inst);
  group.name = 'arcades';
  return group;
}
