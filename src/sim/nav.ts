// Piyoda navigatsiya grafi: yo‘laklar, ravoqlar, eshiklar, nazorat nuqtalari.
// Har bir tugunning ring darajasi bor — agent faqat o‘z ruxsatidagi tugunlardan yuradi.
import type { Ring } from '../data/campus';

export interface NavNode {
  id: string;
  x: number;
  z: number;
  ring: Ring;
  /** Bino ichida (agent ko‘rinmaydi). */
  inside?: string;
  /** Ravoq/soyabon ostida. */
  covered?: boolean;
  checkpoint?: boolean;
}

type N = [string, number, number, Ring, string?];

// [id, x, z, ring, flags]  flags: 'cov' | 'cp' | 'in:<buildingId>'
const NODES: N[] = [
  // --- Ring 1: ko‘cha, forecourt, kirishlar ---
  ['st_c', 0, 151, 1], ['st_w', -45, 151, 1], ['st_e', 45, 151, 1],
  ['fc_c', 0, 121, 1], ['drop', 0, 113, 1], ['gh_steps', 0, 104, 1],
  ['gh_door', 0, 92, 1, 'cov'], ['gh_in', 0, 70, 1, 'in:grandHall'],
  ['prom_w1', -34, 104, 1], ['prom_w2', -66, 104, 1], ['prom_w3', -100, 104, 1],
  ['museum_door', -66, 99.8, 1, 'cov'], ['museum_in', -66, 80, 1, 'in:museum'],
  ['prom_e1', 34, 104, 1], ['prom_e2', 76, 104, 1, 'cov'], ['conf_door', 76, 99.5, 1, 'cov'],
  ['conf_in', 78, 68, 1, 'in:conference'], ['conf_drop', 76, 114, 1], ['prom_e3', 116, 104, 1],
  ['vip_drop', 122, 69, 1, 'cov'], ['vip_door', 112.6, 69, 1, 'cov'],
  ['park_c', -150, 40, 1], ['park_s', -121, 100, 1], ['park_m', -121, 40, 1], ['park_n', -121, -14, 1],
  ['park_entry', -121, 20, 1, 'cov'],
  ['svc_road', 178, -20, 1],
  // --- Ring 1 → 2 nazorat nuqtalari ---
  ['cp_w', -116, 20, 2, 'cov,cp'], ['cp_stair', 0, 56, 2, 'in:grandHall,cp'],
  ['cp_md', -52.5, 58, 2, 'cov,cp'], ['cp_cs', 52, 38, 2, 'cov,cp'], ['svc', 100, -20, 2, 'cp'],
  // --- Ring 2: hovli va akademik bloklar ---
  ['kc_in', 0, 40, 2, 'in:knowledge'], ['kc_door', 0, 28.8, 2, 'cov'], ['c_s', 0, 25, 2],
  ['c_sw', -37.5, 28.5, 2, 'cov'], ['c_se', 37.5, 28.5, 2, 'cov'],
  ['c_w1', -37.5, 20, 2, 'cov'], ['c_w2', -37.5, -10, 2, 'cov'], ['c_nw', -37.5, -34.5, 2, 'cov'],
  ['c_n', 0, -34.5, 2, 'cov'], ['c_ne', 37.5, -34.5, 2, 'cov'], ['c_e2', 37.5, -19.5, 2, 'cov'], ['c_e1', 37.5, 14, 2, 'cov'],
  ['c_ax_ws', -6, 26, 2], ['c_ax_wm', -6, -5, 2], ['c_ax_wn', -6, -31, 2],
  ['c_ax_es', 6, 26, 2], ['c_ax_em', 6, -5, 2], ['c_ax_en', 6, -31, 2],
  ['c_ew_w', -34, -5, 2], ['c_ew_e', 34, -5, 2],
  ['ac_door', -40.6, -10, 2, 'cov'], ['ac_in', -68, -10, 2, 'in:academic'],
  ['gap_w', -33, 37, 2], ['doc_door', -40.6, 37, 2], ['doc_in', -52, 37, 2, 'in:doctoral'],
  ['wp_1', -70, 20, 2, 'cov'], ['wp_2', -45, 20, 2, 'cov'],
  ['sim_door', 40.6, 14, 2, 'cov'], ['sim_in', 52, 14, 2, 'in:simulation'], ['sim_e', 64.6, 4.5, 2, 'cov'],
  ['dl_door', 40.6, -19.5, 2, 'cov'], ['dl_in', 52, -24, 2, 'in:datalab'], ['el_w', 64.6, -19.5, 2, 'cov'],
  ['pe_a', 76.5, 4.5, 2, 'cov'], ['admin_door', 87.6, 4.5, 2, 'cov'], ['admin_in', 110, 4, 2, 'in:admin'],
  ['admin_n', 110, -6.6, 2], ['tech_door', 99.4, -47, 2], ['energy_in', 120, -47, 2, 'in:energy'],
  ['pe_1', 76.5, -19.5, 2, 'cov'], ['pe_40', 76.5, -40, 2, 'cov'], ['pe_70', 76.5, -70, 2, 'cov'], ['pe_102', 76.5, -102, 2, 'cov'],
  ['ne_path', 50, -40, 2],
  ['rg_ne', 84, -103, 2], ['club_door', 123.6, -103, 2], ['club_in', 148, -124, 2, 'in:club'],
  ['rg_c', 63, -103, 2], ['rg_s', 63, -121, 2], ['res_door', 63, -123.8, 2], ['res_in', 65, -132, 2, 'in:residence'],
  ['rg_w', 14, -121, 2], ['res_lobby', 113, -140.6, 2, 'cov'], ['res_drop', 113, -146, 2],
  ['nw_a', -40, -42, 2], ['nw_b', -75, -42, 2],
  ['wc_1', -108, 16, 2], ['wc_2', -108, -44, 2], ['wc_3', -108, -108, 2],
  ['pav', 0, -114, 2, 'cov'], ['sch_gate', -60, -111, 2, 'cov'],
  // --- Ring 3 ---
  ['gate3', 0, -45, 3, 'cov,cp'], ['r3_s', 0, -58, 3], ['r3_m', 0, -80, 3], ['commons', -15, -52, 3],
  ['rs_door', -29.4, -80, 3, 'cov'], ['rs_in', -60, -80, 3, 'in:research'],
  ['sec_door', 19.4, -77, 3], ['sec_in', 35, -77, 3, 'in:secure'], ['rs_rear', -60, -104.6, 3, 'cov'],
];

// Scholars’ Garden aylana yo‘lagi
const LOOP: N[] = [];
for (let k = 0; k < 12; k++) {
  const a = (k * 30 * Math.PI) / 180;
  LOOP.push([`loop${k * 30}`, -86 + Math.cos(a) * 78, -128 + Math.sin(a) * 15, 2]);
}

type E = [string, string, string?];
const EDGES: E[] = [
  ['st_w', 'st_c'], ['st_c', 'st_e'], ['st_c', 'fc_c'], ['fc_c', 'drop'], ['drop', 'gh_steps'],
  ['gh_steps', 'gh_door'], ['gh_door', 'gh_in'],
  ['gh_steps', 'prom_w1'], ['prom_w1', 'prom_w2'], ['prom_w2', 'museum_door'], ['museum_door', 'museum_in'],
  ['prom_w2', 'prom_w3'], ['prom_w3', 'park_s'],
  ['gh_steps', 'prom_e1'], ['prom_e1', 'prom_e2'], ['prom_e2', 'conf_door'], ['conf_door', 'conf_in'],
  ['conf_drop', 'prom_e2'], ['prom_e2', 'prom_e3'], ['prom_e3', 'vip_drop'], ['vip_drop', 'vip_door'], ['vip_door', 'conf_in'],
  ['st_e', 'conf_drop'], ['st_w', 'prom_w1'],
  ['park_c', 'park_m'], ['park_m', 'park_s'], ['park_m', 'park_n'], ['park_m', 'park_entry'], ['park_entry', 'cp_w'],
  ['gh_in', 'cp_stair'], ['cp_stair', 'kc_in'], ['museum_in', 'cp_md'], ['cp_md', 'doc_in'],
  ['conf_in', 'cp_cs', 'conf-closed'], ['cp_cs', 'sim_in'], ['cp_cs', 'c_se'],
  ['cp_w', 'wp_1'], ['wp_1', 'wp_2'], ['wp_2', 'c_w1'], ['cp_w', 'wc_1'],
  ['kc_in', 'kc_door'], ['kc_door', 'c_s'], ['c_s', 'c_ax_ws'], ['c_s', 'c_ax_es'], ['c_s', 'c_sw'], ['c_s', 'c_se'],
  ['c_sw', 'c_w1'], ['c_w1', 'c_w2'], ['c_w2', 'c_nw'], ['c_nw', 'c_n'], ['c_n', 'c_ne'], ['c_ne', 'c_e2'], ['c_e2', 'c_e1'], ['c_e1', 'c_se'],
  ['c_ax_ws', 'c_ax_wm'], ['c_ax_wm', 'c_ax_wn'], ['c_ax_wn', 'c_n'],
  ['c_ax_es', 'c_ax_em'], ['c_ax_em', 'c_ax_en'], ['c_ax_en', 'c_n'],
  ['c_ew_w', 'c_w2'], ['c_ew_w', 'c_ax_wm'], ['c_ew_e', 'c_e2'], ['c_ew_e', 'c_ax_em'],
  ['c_sw', 'gap_w'], ['gap_w', 'doc_door'], ['doc_door', 'doc_in'],
  ['c_w2', 'ac_door'], ['ac_door', 'ac_in'],
  ['c_e1', 'sim_door'], ['sim_door', 'sim_in'], ['c_e2', 'dl_door'], ['dl_door', 'dl_in'], ['dl_in', 'el_w'], ['el_w', 'pe_1'],
  ['sim_in', 'sim_e'], ['sim_e', 'pe_a'], ['pe_a', 'admin_door'], ['admin_door', 'admin_in'], ['pe_a', 'pe_1'],
  ['pe_1', 'svc'], ['svc', 'svc_road'], ['svc', 'admin_n'], ['admin_n', 'admin_in'], ['svc', 'tech_door'], ['tech_door', 'energy_in'],
  ['pe_1', 'pe_40'], ['pe_40', 'pe_70'], ['pe_70', 'pe_102'], ['c_ne', 'ne_path'], ['ne_path', 'pe_40'],
  ['pe_102', 'rg_ne'], ['rg_ne', 'club_door'], ['club_door', 'club_in'],
  ['pe_102', 'rg_c'], ['rg_c', 'rg_s'], ['rg_s', 'res_door'], ['res_door', 'res_in'], ['rg_s', 'rg_w'],
  ['res_in', 'res_lobby'], ['res_lobby', 'res_drop'], ['res_in', 'club_in'],
  ['c_nw', 'nw_a'], ['nw_a', 'nw_b'], ['nw_b', 'wc_2'], ['wc_1', 'wc_2'], ['wc_2', 'wc_3'], ['wc_3', 'loop120'],
  ['c_n', 'gate3'], ['gate3', 'r3_s'], ['r3_s', 'r3_m'], ['r3_s', 'commons'], ['r3_m', 'rs_door'], ['rs_door', 'rs_in'],
  ['r3_m', 'sec_door'], ['sec_door', 'sec_in'], ['rs_in', 'rs_rear'], ['rs_rear', 'sch_gate'],
  ['sch_gate', 'loop60'], ['sch_gate', 'loop90'], ['loop0', 'rg_w'], ['pav', 'loop0'], ['pav', 'loop30'],
];
for (let k = 0; k < 12; k++) EDGES.push([`loop${k * 30}`, `loop${((k + 1) % 12) * 30}`]);

export class NavGraph {
  nodes: NavNode[] = [];
  index = new Map<string, number>();
  adj: { to: number; len: number; tag?: string }[][] = [];
  private cache = new Map<string, Int32Array>();

  constructor() {
    for (const [id, x, z, ring, flags] of [...NODES, ...LOOP]) {
      const f = (flags ?? '').split(',');
      const node: NavNode = { id, x, z, ring };
      for (const fl of f) {
        if (fl === 'cov') node.covered = true;
        if (fl === 'cp') node.checkpoint = true;
        if (fl.startsWith('in:')) node.inside = fl.slice(3);
      }
      this.index.set(id, this.nodes.length);
      this.nodes.push(node);
    }
    this.adj = this.nodes.map(() => []);
    for (const [a, b, tag] of EDGES) {
      const ia = this.index.get(a);
      const ib = this.index.get(b);
      if (ia === undefined || ib === undefined) throw new Error(`Nav: noma’lum tugun ${a}–${b}`);
      const A = this.nodes[ia];
      const B = this.nodes[ib];
      const len = Math.hypot(A.x - B.x, A.z - B.z) + (A.inside && B.inside ? 0 : 0);
      this.adj[ia].push({ to: ib, len, tag });
      this.adj[ib].push({ to: ia, len, tag });
    }
  }

  id(i: number) {
    return this.nodes[i].id;
  }

  idx(id: string): number {
    const i = this.index.get(id);
    if (i === undefined) throw new Error(`Nav: ${id}`);
    return i;
  }

  /** Dijkstra: `from` dan barcha tugunlarga oldingi-tugun jadvali (kesh bilan). */
  private prevTable(from: number, access: Ring, confClosed: boolean): Int32Array {
    const key = `${from}:${access}:${confClosed ? 1 : 0}`;
    const c = this.cache.get(key);
    if (c) return c;
    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const e of this.adj[u]) {
        if (this.nodes[e.to].ring > access) continue;
        if (confClosed && e.tag === 'conf-closed') continue;
        // bino ichidan o‘tishga biroz jarima — odamlar ochiq yo‘lni afzal ko‘radi
        const w = e.len * (this.nodes[e.to].inside && this.nodes[u].inside ? 1.4 : 1);
        if (dist[u] + w < dist[e.to]) {
          dist[e.to] = dist[u] + w;
          prev[e.to] = u;
        }
      }
    }
    this.cache.set(key, prev);
    return prev;
  }

  path(from: number, to: number, access: Ring, confClosed: boolean): number[] | null {
    if (from === to) return [from];
    const prev = this.prevTable(from, access, confClosed);
    if (prev[to] < 0) return null;
    const p: number[] = [];
    for (let v = to; v !== -1; v = prev[v]) p.push(v);
    p.reverse();
    return p[0] === from ? p : null;
  }
}
