// Odamlar oqimi simulyatsiyasi: agentlar, kunlik jadvallar, metrikalar.
import * as THREE from 'three';
import { NavGraph } from './nav';
import { rng } from '../core/materials';
import type { Occluders } from '../core/occluders';
import type { Ring } from '../data/campus';

export type AgentType = 'learner' | 'researcher' | 'staff' | 'visitor' | 'delegate' | 'vip';

export const AGENT_TYPES: Record<AgentType, { label: string; color: number; access: Ring }> = {
  learner: { label: 'Tinglovchilar', color: 0x2f7fd0, access: 2 },
  researcher: { label: 'Tadqiqotchilar', color: 0x8a4fc8, access: 3 },
  staff: { label: 'Xodimlar va faculty', color: 0x5f6b70, access: 2 },
  visitor: { label: 'Muzey mehmonlari', color: 0x23a27a, access: 1 },
  delegate: { label: 'Konferensiya delegatlari', color: 0xe07b2a, access: 1 },
  vip: { label: 'VIP mehmonlar', color: 0xd4a72c, access: 1 },
};

export type ScenarioId = 'study' | 'conference';
export const SCENARIOS: Record<ScenarioId, { label: string; note: string }> = {
  study: {
    label: 'Oddiy o‘quv kuni',
    note: '300 tinglovchi, 100 tadqiqotchi, xodimlar va muzey mehmonlari. Darslar, tanaffuslar, tushlik, kechki kutubxona.',
  },
  conference: {
    label: 'Xalqaro konferensiya kuni',
    note: '~480 delegat faqat Ring 1 da: forecourt, Grand Hall, Conference Centre, Museum. Conference–Simulation o‘tish joyi yopiq. Akademik va Ring 3 hayoti davom etadi. Residence’dagi delegatlar shuttle bilan keladi (6-taklif).',
  },
};

interface Step {
  /** Jo‘nash vaqti (daqiqa, 00:00 dan). */
  t: number;
  to: string;
  /** Ochiq havoda turganda tarqalish radiusi. */
  spread?: number;
}

interface Agent {
  type: AgentType;
  access: Ring;
  spawn: string;
  steps: Step[];
  si: number; // keyingi qadam indeksi
  state: 'pending' | 'walking' | 'dwelling' | 'gone';
  node: number;
  path: number[];
  pi: number; // yo‘ldagi joriy segment
  segT: number; // segmentdagi masofa (m)
  speed: number;
  lane: number;
  pos: THREE.Vector3;
  visible: boolean;
  dwellOff: [number, number];
  walked: number;
  shaded: boolean;
  shadeCheck: number;
  exitAfter: boolean;
}

const BUILDING_NODES: Record<string, string> = {
  gh_in: 'grandHall', museum_in: 'museum', conf_in: 'conference', kc_in: 'knowledge', ac_in: 'academic',
  doc_in: 'doctoral', sim_in: 'simulation', dl_in: 'datalab', rs_in: 'research', sec_in: 'secure',
  res_in: 'residence', club_in: 'club', admin_in: 'admin', energy_in: 'energy',
};

export interface SimMetrics {
  present: number;
  outdoors: number;
  shadeShare: number;
  avgWalk: number;
  violations: number;
  checkpoints: number;
  byType: Record<AgentType, number>;
  occupancy: Record<string, number>;
}

export class PeopleSim {
  readonly nav = new NavGraph();
  agents: Agent[] = [];
  time = 7 * 60;
  scenario: ScenarioId = 'study';
  mesh: THREE.InstancedMesh;
  scale = 1.6;
  private walkOut = 0;
  private walkShade = 0;
  private tripDist = 0;
  private trips = 0;
  private violations = 0;
  private checkpoints = 0;
  private frame = 0;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(private occ: Occluders, private sunDir: () => THREE.Vector3) {
    const g = new THREE.CapsuleGeometry(0.28, 1.05, 3, 8);
    g.translate(0, 0.83, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    this.mesh = new THREE.InstancedMesh(g, mat, 1200);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'people';
  }

  reset(scenario: ScenarioId) {
    this.scenario = scenario;
    this.time = 7 * 60;
    this.walkOut = this.walkShade = this.tripDist = this.trips = this.violations = this.checkpoints = 0;
    this.agents = this.generate(scenario);
    this.mesh.count = this.agents.length;
    const col = new THREE.Color();
    this.agents.forEach((a, i) => {
      col.setHex(AGENT_TYPES[a.type].color);
      this.mesh.setColorAt(i, col);
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.writeMatrices();
  }

  // ---------------- jadval generatori ----------------
  private generate(sc: ScenarioId): Agent[] {
    const R = rng(sc === 'study' ? 7 : 11);
    const U = (a: number, b: number) => a + R() * (b - a);
    const pick = <T,>(arr: [T, number][]): T => {
      const r = R();
      let acc = 0;
      for (const [v, w] of arr) {
        acc += w;
        if (r <= acc) return v;
      }
      return arr[arr.length - 1][0];
    };
    const outdoorCourt = ['c_s', 'c_ax_ws', 'c_ax_es', 'c_ew_w', 'c_ew_e', 'c_ax_wn', 'c_ax_en'];
    const list: Agent[] = [];
    const make = (type: AgentType, spawn: string, steps: Step[]): Agent => ({
      type,
      access: AGENT_TYPES[type].access,
      spawn,
      steps,
      si: 0,
      state: 'pending',
      node: this.nav.idx(spawn),
      path: [],
      pi: 0,
      segT: 0,
      speed: U(1.15, 1.5),
      lane: U(-1.1, 1.1),
      pos: new THREE.Vector3(),
      visible: false,
      dwellOff: [0, 0],
      walked: 0,
      shaded: false,
      shadeCheck: Math.floor(R() * 8),
      exitAfter: true,
    });
    const conf = sc === 'conference';
    const H = (h: number, m = 0) => h * 60 + m;

    // --- tinglovchilar ---
    const nLearn = conf ? 220 : 300;
    for (let i = 0; i < nLearn; i++) {
      const origin = pick<string>([['res_in', 0.36], ['park_c', 0.4], ['st_c', 0.24]]);
      const cls = pick<string>([['ac_in', 0.6], ['sim_in', 0.12], ['dl_in', 0.13], ['doc_in', 0.05], ['kc_in', 0.1]]);
      const steps: Step[] = [{ t: U(H(7, 50), H(8, 40)), to: cls }];
      if (R() < 0.55) {
        steps.push({ t: U(H(10, 30), H(10, 34)), to: outdoorCourt[Math.floor(R() * outdoorCourt.length)], spread: 4 });
        steps.push({ t: U(H(10, 48), H(10, 55)), to: cls });
      }
      const lunch = pick<[string, number]>([[['club_in', 0], 0.45], [['c_s', 6], 0.3], [['kc_in', 0], 0.25]]);
      steps.push({ t: U(H(12, 30), H(12, 40)), to: lunch[0], spread: lunch[1] || undefined });
      const cls2 = R() < 0.7 ? cls : pick<string>([['ac_in', 0.5], ['sim_in', 0.25], ['dl_in', 0.25]]);
      steps.push({ t: U(H(13, 25), H(13, 35)), to: cls2 });
      if (R() < 0.35) {
        steps.push({ t: U(H(15, 0), H(15, 5)), to: outdoorCourt[Math.floor(R() * outdoorCourt.length)], spread: 4 });
        steps.push({ t: U(H(15, 18), H(15, 25)), to: cls2 });
      }
      const library = R() < 0.3;
      if (library) steps.push({ t: U(H(16, 30), H(16, 50)), to: 'kc_in' });
      const leave = library ? U(H(17, 20), H(18, 40)) : U(H(16, 35), H(17, 45));
      steps.push({ t: leave, to: origin });
      if (origin === 'res_in' && R() < 0.45) {
        steps.push({ t: U(H(18, 40), H(19, 20)), to: 'club_in' });
        steps.push({ t: U(H(19, 40), H(20, 30)), to: 'res_in' });
      }
      list.push(make('learner', origin, steps));
    }

    // --- tadqiqotchilar ---
    for (let i = 0; i < 100; i++) {
      const origin = pick<string>([['park_c', 0.6], ['res_in', 0.25], ['st_c', 0.15]]);
      const work = R() < 0.8 ? 'rs_in' : 'sec_in';
      const steps: Step[] = [{ t: U(H(8, 20), H(9, 30)), to: work }];
      const lunch = pick<[string, number]>([[['commons', 5], 0.3], [['club_in', 0], 0.3], [['kc_in', 0], 0.2], [[work, 0], 0.2]]);
      if (lunch[0] !== work) {
        steps.push({ t: U(H(12, 30), H(12, 50)), to: lunch[0], spread: lunch[1] || undefined });
        steps.push({ t: U(H(13, 20), H(13, 40)), to: work });
      }
      if (R() < 0.22) {
        const loopNode = `loop${[30, 60, 90, 120, 150, 180, 210, 240, 270][Math.floor(R() * 9)]}`;
        steps.push({ t: U(H(15, 0), H(15, 30)), to: loopNode, spread: 3 });
        steps.push({ t: U(H(15, 40), H(16, 0)), to: work });
      }
      if (R() < 0.15) {
        steps.push({ t: U(H(11, 0), H(11, 15)), to: 'sim_in' });
        steps.push({ t: U(H(12, 0), H(12, 15)), to: work });
        steps.sort((a, b) => a.t - b.t);
      }
      steps.push({ t: U(H(17, 30), H(19, 0)), to: origin });
      list.push(make('researcher', origin, steps));
    }

    // --- xodimlar ---
    const nStaff = conf ? 90 : 80;
    for (let i = 0; i < nStaff; i++) {
      const role = pick<string>([['admin_in', 0.38], ['ac_in', 0.22], ['kc_in', 0.14], ['energy_in', 0.1], ['gh_in', 0.1], ['club_in', 0.06]]);
      const origin = role === 'energy_in' ? 'svc_road' : R() < 0.8 ? 'park_c' : 'st_c';
      const steps: Step[] = [{ t: U(H(7, 40), H(8, 30)), to: role }];
      if (R() < 0.4 && role !== 'club_in') {
        steps.push({ t: U(H(12, 45), H(13, 0)), to: 'club_in' });
        steps.push({ t: U(H(13, 40), H(13, 55)), to: role });
      }
      steps.push({ t: U(H(17, 0), H(18, 15)), to: origin });
      list.push(make('staff', origin, steps));
    }

    // --- muzey mehmonlari ---
    const nVis = conf ? 40 : 70;
    for (let i = 0; i < nVis; i++) {
      const origin = R() < 0.7 ? 'st_c' : 'park_c';
      const t0 = U(H(10, 0), H(17, 0));
      const steps: Step[] = [{ t: t0, to: 'museum_in' }];
      let t = t0 + U(40, 90);
      if (R() < 0.4) {
        steps.push({ t, to: 'gh_in' });
        t += U(15, 30);
      }
      if (R() < 0.3) {
        steps.push({ t, to: 'fc_c', spread: 8 });
        t += U(8, 15);
      }
      steps.push({ t, to: origin });
      list.push(make('visitor', origin, steps));
    }

    // --- delegatlar ---
    if (conf) {
      for (let i = 0; i < 480; i++) {
        const vip = i < 18;
        const origin = vip ? 'vip_drop' : pick<string>([['st_c', 0.35], ['conf_drop', 0.35], ['conf_in', 0.3]]);
        const steps: Step[] = [{ t: U(H(8, 10), H(9, 5)), to: 'conf_in' }];
        if (R() < 0.7) {
          const brk = pick<[string, number]>([[['gh_in', 0], 0.35], [['prom_e1', 7], 0.2], [['fc_c', 9], 0.15], [['museum_in', 0], 0.15], [['prom_w1', 6], 0.15]]);
          steps.push({ t: U(H(10, 45), H(10, 50)), to: brk[0], spread: brk[1] || undefined });
          steps.push({ t: U(H(11, 10), H(11, 18)), to: 'conf_in' });
        }
        steps.push({ t: U(H(13, 0), H(13, 5)), to: R() < 0.55 ? 'gh_in' : 'conf_in' });
        steps.push({ t: U(H(13, 55), H(14, 5)), to: 'conf_in' });
        if (R() < 0.45) {
          steps.push({ t: U(H(15, 30), H(15, 35)), to: R() < 0.5 ? 'prom_e1' : 'gh_in', spread: 7 });
          steps.push({ t: U(H(15, 52), H(16, 0)), to: 'conf_in' });
        }
        steps.push({ t: U(H(17, 0), H(17, 40)), to: origin });
        list.push(make(vip ? 'vip' : 'delegate', origin, steps));
      }
    }
    return list;
  }

  // ---------------- qadam ----------------
  step(dtMin: number, opts: { metrics?: boolean } = {}) {
    const metrics = opts.metrics ?? true;
    this.time += dtMin;
    const dtSec = dtMin * 60;
    const confClosed = this.scenario === 'conference';
    this.frame++;
    const sun = this.sunDir();
    for (const a of this.agents) {
      if (a.state === 'gone') continue;
      // jo‘nash vaqti keldimi
      if ((a.state === 'pending' || a.state === 'dwelling') && a.si < a.steps.length && this.time >= a.steps[a.si].t) {
        const st = a.steps[a.si];
        const target = this.nav.idx(st.to);
        const p = this.nav.path(a.node, target, a.access, confClosed);
        a.si++;
        if (p && p.length > 1) {
          a.path = p;
          a.pi = 0;
          a.segT = 0;
          a.state = 'walking';
          a.dwellOff = st.spread ? [(Math.random() - 0.5) * 2 * st.spread, (Math.random() - 0.5) * 2 * st.spread] : [0, 0];
        } else if (p && p.length === 1) {
          a.state = a.si >= a.steps.length && this.nav.id(a.node) === a.spawn ? 'gone' : 'dwelling';
        } else {
          a.state = 'dwelling'; // yo‘l yo‘q — joyida qoladi
        }
      }
      if (a.state === 'walking') {
        let move = a.speed * dtSec;
        while (move > 0 && a.state === 'walking') {
          const A = this.nav.nodes[a.path[a.pi]];
          const B = this.nav.nodes[a.path[a.pi + 1]];
          const len = Math.hypot(B.x - A.x, B.z - A.z) || 0.01;
          const rem = len - a.segT;
          if (move < rem) {
            a.segT += move;
            a.walked += move;
            move = 0;
          } else {
            move -= rem;
            a.walked += rem;
            a.pi++;
            a.segT = 0;
            const reached = this.nav.nodes[a.path[a.pi]];
            if (reached.checkpoint) this.checkpoints++;
            if (reached.ring > a.access) this.violations++;
            if (a.pi >= a.path.length - 1) {
              a.node = a.path[a.path.length - 1];
              this.trips++;
              this.tripDist += a.walked;
              a.walked = 0;
              const last = a.si >= a.steps.length;
              if (last && this.nav.id(a.node) === a.spawn && a.exitAfter) a.state = 'gone';
              else a.state = 'dwelling';
            }
          }
        }
      }
      // pozitsiya va ko‘rinish
      if (a.state === 'walking') {
        const A = this.nav.nodes[a.path[a.pi]];
        const B = this.nav.nodes[a.path[a.pi + 1]];
        const len = Math.hypot(B.x - A.x, B.z - A.z) || 0.01;
        const t = a.segT / len;
        const nx = -(B.z - A.z) / len;
        const nz = (B.x - A.x) / len;
        const insideSeg = !!(A.inside && B.inside);
        a.visible = !insideSeg && !(A.inside && t < 0.25) && !(B.inside && t > 0.75);
        a.pos.set(A.x + (B.x - A.x) * t + nx * a.lane, 0, A.z + (B.z - A.z) * t + nz * a.lane);
        if (metrics && a.visible) {
          const covered = !!(A.covered && B.covered);
          if (covered) a.shaded = true;
          else if ((this.frame + a.shadeCheck) % 8 === 0) a.shaded = this.occ.isShaded(a.pos.x, 1.2, a.pos.z, sun);
          this.walkOut += dtSec;
          if (a.shaded || sun.y <= 0.02) this.walkShade += dtSec;
        }
      } else if (a.state === 'dwelling' || a.state === 'pending') {
        const n = this.nav.nodes[a.node];
        a.visible = a.state === 'dwelling' && !n.inside;
        a.pos.set(n.x + a.dwellOff[0], 0, n.z + a.dwellOff[1]);
      } else {
        a.visible = false;
      }
    }
  }

  /** Vaqtni tez oldinga surish (render qilmasdan). */
  fastForward(toMin: number) {
    while (this.time < toMin - 1e-6) {
      const d = Math.min(0.1, toMin - this.time);
      this.step(d, { metrics: false });
    }
    this.writeMatrices();
  }

  writeMatrices() {
    const zero = new THREE.Vector3(0, 0, 0);
    this.agents.forEach((a, i) => {
      if (a.visible) {
        this.s.setScalar(this.scale);
        this.m4.compose(a.pos, this.q, this.s);
      } else {
        this.m4.compose(a.pos, this.q, zero);
      }
      this.mesh.setMatrixAt(i, this.m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  metrics(): SimMetrics {
    const byType = { learner: 0, researcher: 0, staff: 0, visitor: 0, delegate: 0, vip: 0 } as Record<AgentType, number>;
    const occupancy: Record<string, number> = {};
    let present = 0;
    let outdoors = 0;
    for (const a of this.agents) {
      if (a.state === 'gone') continue;
      if (a.state === 'pending') {
        // hali kelmagan — lekin Residence’da yashovchilar kampusda
        if (this.nav.id(a.node) !== 'res_in') continue;
      }
      present++;
      byType[a.type]++;
      if (a.visible) outdoors++;
      const nodeId = this.nav.id(a.node);
      if ((a.state === 'dwelling' || a.state === 'pending') && BUILDING_NODES[nodeId]) {
        const b = BUILDING_NODES[nodeId];
        occupancy[b] = (occupancy[b] ?? 0) + 1;
      }
    }
    return {
      present,
      outdoors,
      shadeShare: this.walkOut > 0 ? this.walkShade / this.walkOut : 0,
      avgWalk: this.trips ? this.tripDist / this.trips : 0,
      violations: this.violations,
      checkpoints: this.checkpoints,
      byType,
      occupancy,
    };
  }
}
