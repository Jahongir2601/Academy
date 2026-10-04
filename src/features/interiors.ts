// «Interyer» bo‘limi: Grand Hall atriumi va MPC Simulation Room, pul-kredit siyosati o‘yini.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import type { Selection } from './selection';
import type { Walk } from './walk';
import { h, icon } from '../ui/dom';
import { buildGrandHall, type InteriorBuild } from '../interiors/grandHall';
import { buildMpcRoom, type MpcBuild } from '../interiors/mpcRoom';
import { SHOCKS, MODEL, runPolicy, drawPolicyChart, type ShockId, type PolicyResult, type ChartTheme } from '../interiors/policy';

type Kind = 'grandHall' | 'mpc';

const TITLES: Record<Kind, string> = {
  grandHall: 'Grand Academy Hall — atrium va Knowledge Stair',
  mpc: 'Monetary Policy Committee Simulation Room',
};

function isDark(): boolean {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function panelTheme(): ChartTheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const dark = isDark();
  return {
    surface: v('--surface-solid') || '#f8f8f4',
    ink: v('--ink') || '#1b2528',
    ink2: v('--ink-2') || '#4f5d61',
    grid: v('--line') || 'rgba(0,0,0,.12)',
    inflation: dark ? '#d95926' : '#eb6834',
    rate: dark ? '#3987e5' : '#2a78d6',
    gap: dark ? '#199e70' : '#1baf7a',
    target: v('--ink-3') || '#7b878a',
    font: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  };
}

const WALL_THEME: ChartTheme = {
  surface: '#0d1517',
  ink: '#ece8df',
  ink2: '#9aa6a8',
  grid: '#26363a',
  inflation: '#d95926',
  rate: '#3987e5',
  gap: '#199e70',
  target: '#829093',
  font: '"IBM Plex Sans", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
};

export function mountInteriors(app: App, shell: Shell, sel: Selection, walk: Walk) {
  const built: Partial<Record<Kind, InteriorBuild>> = {};
  const cam = new THREE.PerspectiveCamera(55, app.camera.aspect, 0.05, 400);
  const controls = new OrbitControls(cam, app.renderer.domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  let current: Kind | null = null;
  let active: InteriorBuild | null = null;
  let result: PolicyResult | null = null;
  let hover: number | null = null;
  let walkEndedAt = 0;

  // --- interyer satri ---
  const title = h('b');
  const walkBtn = h('button', { class: 'btn' }, icon('walk'), 'Piyoda');
  const backBtn = h('button', { class: 'btn primary' }, icon('back'), 'Kampusga qaytish');
  const bar = h('div', { class: 'interior-bar card', hidden: true }, title, walkBtn, backBtn);
  if (app.isMobile) walkBtn.hidden = true;

  // --- MPC paneli ---
  const shockSel = h('select', { id: 'mpc-shock', 'aria-label': 'Shok turi' },
    ...(Object.keys(SHOCKS) as ShockId[]).map((k) => h('option', { value: k }, SHOCKS[k].label)));
  const sizes: [string, number][] = [['Kichik', 0.5], ['O‘rta', 1], ['Katta', 1.6]];
  let size = 1;
  const sizeChips = h('div', { class: 'chips' });
  sizes.forEach(([l, v]) => {
    const b = h('button', { class: 'chip', 'aria-pressed': String(v === size) }, l);
    b.addEventListener('click', () => {
      size = v;
      sizeChips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      run();
    });
    sizeChips.append(b);
  });
  const rateIn = h('input', { type: 'range', id: 'mpc-rate', min: 8, max: 22, step: 0.25, value: MODEL.i0 });
  const rateOut = h('output', { for: 'mpc-rate' }, `${MODEL.i0.toFixed(2)}%`);
  const decideBtn = h('button', { class: 'btn primary' }, 'Qaror qabul qilish');
  const taylorBtn = h('button', { class: 'btn' }, 'Taylor tavsiyasini qo‘llash');
  const chart = h('canvas', { class: 'chart', width: 640, height: 400, role: 'img', 'aria-label': 'Inflyatsiya, asosiy stavka va ishlab chiqarish uzilishi prognozi' });
  const resultBox = h('div', { class: 'result' });
  const tableBody = h('tbody');
  const details = h('details', {},
    h('summary', { style: 'cursor:pointer;font-size:var(--fs-s);color:var(--ink-2)' }, 'Jadval ko‘rinishi'),
    h('div', { class: 'table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Chorak'), h('th', { class: 'num' }, 'Infl.'), h('th', { class: 'num' }, 'Stavka'), h('th', { class: 'num' }, 'Uzilish'))),
        tableBody,
      )),
  );
  const mpcPanel = h('aside', { class: 'mpc-panel card', hidden: true },
    h('h3', {}, 'Pul-kredit siyosati qarori'),
    h('p', { style: 'margin:0;font-size:var(--fs-s);color:var(--ink-2)' },
      `O‘quv modeli: boshlang‘ich holat (namuna) — inflyatsiya ${MODEL.pi0}%, stavka ${MODEL.i0}%, maqsad ${MODEL.target}%. Real prognoz emas.`),
    h('div', { class: 'field' }, h('label', { for: 'mpc-shock' }, 'Shok ssenariysi'), shockSel),
    h('div', { class: 'field' }, h('label', {}, 'Shok kuchi'), sizeChips),
    h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { for: 'mpc-rate' }, 'Asosiy stavka (1-yil)'), rateOut), rateIn),
    h('div', { class: 'btn-row' }, decideBtn, taylorBtn),
    chart,
    h('div', { class: 'legend', style: 'flex-direction:row;flex-wrap:wrap;gap:12px' },
      h('div', { class: 'legend-row' }, h('i', { class: 'lg-infl' }), 'Inflyatsiya'),
      h('div', { class: 'legend-row' }, h('i', { class: 'lg-rate' }), 'Asosiy stavka'),
      h('div', { class: 'legend-row' }, h('i', { class: 'lg-gap' }), 'Ishlab chiqarish uzilishi'),
    ),
    resultBox,
    details,
  );
  shell.ui.append(bar, mpcPanel);

  const paintLegend = () => {
    const th = panelTheme();
    (mpcPanel.querySelector('.lg-infl') as HTMLElement).style.background = th.inflation;
    (mpcPanel.querySelector('.lg-rate') as HTMLElement).style.background = th.rate;
    (mpcPanel.querySelector('.lg-gap') as HTMLElement).style.background = th.gap;
  };

  const drawCharts = () => {
    if (!result) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = chart.clientWidth || 308;
    const cssH = Math.round(cssW * 0.62);
    if (chart.width !== Math.round(cssW * dpr)) {
      chart.width = Math.round(cssW * dpr);
      chart.height = Math.round(cssH * dpr);
    }
    const ctx = chart.getContext('2d')!;
    drawPolicyChart(ctx, chart.width, chart.height, result, panelTheme(), { scale: dpr * 0.95, hover });
    const mpc = built.mpc as MpcBuild | undefined;
    if (mpc) {
      const wctx = mpc.wallCanvas.getContext('2d')!;
      drawPolicyChart(wctx, mpc.wallCanvas.width, mpc.wallCanvas.height, result, WALL_THEME, {
        scale: 2.6,
        title: `${SHOCKS[shockSel.value as ShockId].label} · stavka ${Number(rateIn.value).toFixed(2)}% · 12 chorak prognozi (o‘quv modeli)`,
      });
      mpc.wallTex.needsUpdate = true;
    }
  };

  const run = () => {
    const rate = Number(rateIn.value);
    result = runPolicy(shockSel.value as ShockId, size, rate);
    const r = result;
    resultBox.replaceChildren(
      h('div', {}, `4-chorakda inflyatsiya: `, h('b', {}, `${r.pi[4].toFixed(1)}%`), ` · 8-chorakda: `, h('b', {}, `${r.pi[8].toFixed(1)}%`)),
      h('div', {}, `Eng chuqur uzilish: `, h('b', {}, `${Math.min(...r.y.slice(1)).toFixed(1)}%`), ` · Taylor tavsiyasi: `, h('b', {}, `${r.taylorRate.toFixed(2)}%`)),
      h('div', {}, `Yo‘qotish funksiyasi: `, h('b', {}, r.loss.toFixed(1)), ` (Taylor qoidasi: ${r.taylorLoss.toFixed(1)})`),
      h('div', { style: 'margin-top:6px;font-weight:600' }, r.verdict),
    );
    tableBody.replaceChildren(
      ...r.q.map((q) => h('tr', {},
        h('td', {}, q === 0 ? 'hozir' : `${q}`),
        h('td', { class: 'num' }, r.pi[q].toFixed(1)),
        h('td', { class: 'num' }, r.i[q].toFixed(2)),
        h('td', { class: 'num' }, r.y[q].toFixed(2)))),
    );
    drawCharts();
  };

  rateIn.addEventListener('input', () => {
    rateOut.textContent = `${Number(rateIn.value).toFixed(2)}%`;
  });
  rateIn.addEventListener('change', run);
  shockSel.addEventListener('change', run);
  decideBtn.addEventListener('click', run);
  taylorBtn.addEventListener('click', () => {
    const r = runPolicy(shockSel.value as ShockId, size, Number(rateIn.value));
    const v = Math.round(r.taylorRate * 4) / 4;
    rateIn.value = String(Math.min(22, Math.max(8, v)));
    rateOut.textContent = `${Number(rateIn.value).toFixed(2)}%`;
    run();
  });
  chart.addEventListener('pointermove', (e) => {
    if (!result) return;
    const rect = chart.getBoundingClientRect();
    const k = 0.95;
    const padL = 44 * k;
    const padR = 122 * k;
    const x = e.clientX - rect.left;
    const w = rect.width;
    const q = Math.round(((x - padL) / (w - padL - padR)) * (result.q.length - 1));
    const nq = q < 0 || q > result.q.length - 1 ? null : q;
    if (nq !== hover) {
      hover = nq;
      drawCharts();
    }
  });
  chart.addEventListener('pointerleave', () => {
    hover = null;
    drawCharts();
  });

  const enter = (kind: Kind) => {
    if (walk.active) walk.exit();
    if (!built[kind]) built[kind] = kind === 'grandHall' ? buildGrandHall(app.renderer) : buildMpcRoom(app.renderer);
    const b = built[kind]!;
    current = kind;
    active = b;
    cam.aspect = app.renderer.domElement.clientWidth / app.renderer.domElement.clientHeight;
    cam.updateProjectionMatrix();
    cam.position.copy(b.start.pos);
    controls.target.copy(b.start.target);
    controls.minDistance = 0.5;
    controls.maxDistance = kind === 'mpc' ? 9 : 34;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.update();
    app.controls.enabled = false;
    controls.enabled = true;
    app.activeScene = b.scene;
    app.activeCamera = cam;
    app.labelRenderer.domElement.style.display = 'none';
    sel.enabled = false;
    shell.setVisible(false);
    title.textContent = TITLES[kind];
    bar.hidden = false;
    mpcPanel.hidden = kind !== 'mpc';
    if (kind === 'mpc') {
      paintLegend();
      requestAnimationFrame(run);
    }
  };

  const exit = () => {
    if (!current) return;
    if (walk.active) walk.exit();
    walk.setCamera(app.camera);
    walk.bounds = null;
    current = null;
    active = null;
    controls.enabled = false;
    app.controls.enabled = true;
    app.activeScene = app.scene;
    app.activeCamera = app.camera;
    app.labelRenderer.domElement.style.display = '';
    sel.enabled = true;
    shell.setVisible(true);
    bar.hidden = true;
    mpcPanel.hidden = true;
  };

  walkBtn.addEventListener('click', () => {
    if (!active) return;
    walk.setCamera(cam);
    walk.bounds = active.bounds;
    controls.enabled = false;
    const p = cam.position.clone();
    walk.enter(new THREE.Vector3(p.x, 1.7, p.z), controls.target.clone());
    walk.onChange = (on) => {
      if (!on) {
        walkEndedAt = performance.now();
        controls.enabled = !!current;
        if (current) {
          // orbit nishonini kamera oldiga qo‘yamiz
          const d = new THREE.Vector3();
          cam.getWorldDirection(d);
          controls.target.copy(cam.position).addScaledVector(d, 4);
        }
        walk.onChange = (o) => shell.setVisible(!o);
        if (!current) shell.setVisible(true);
      }
    };
  });
  backBtn.addEventListener('click', exit);
  window.addEventListener('keydown', (e) => {
    // Esc avval piyoda rejimdan chiqaradi; interyerdan faqat keyingi bosishda
    if (e.key === 'Escape' && current && !walk.active && performance.now() - walkEndedAt > 500) exit();
  });
  window.addEventListener('resize', () => {
    cam.aspect = app.renderer.domElement.clientWidth / app.renderer.domElement.clientHeight;
    cam.updateProjectionMatrix();
    if (current === 'mpc') drawCharts();
  });

  app.onFrame((dt, t) => {
    if (!active) return;
    if (controls.enabled) {
      controls.update();
      const bd = active.bounds;
      cam.position.x = Math.min(bd.x1, Math.max(bd.x0, cam.position.x));
      cam.position.y = Math.min(bd.y1, Math.max(bd.y0, cam.position.y));
      cam.position.z = Math.min(bd.z1, Math.max(bd.z0, cam.position.z));
    }
    active.update(dt, t);
  });

  shell.addTab({
    id: 'interior',
    label: 'Interyer',
    icon: 'door',
    build: (p) => {
      p.append(
        h('h2', {}, 'Interyerlar'),
        h('p', { class: 'lede' }, 'Konsepsiyadagi ikki ramziy makon. Ichkarida sichqoncha bilan aylantiring yoki «Piyoda» rejimida yuring.'),
        h('div', { class: 'section' },
          h('h3', {}, '1 · Grand Academy Hall'),
          h('p', {}, '20 metrli atrium, janubiy girih panjara orqali tushadigan quyosh naqshi, Knowledge Stair, «Bilim → Tahlil → Qaror» yozuvi, digital wall va pul tarixi vitrinalari.'),
          h('button', { class: 'btn primary', onclick: () => enter('grandHall') }, icon('enter'), 'Atriumga kirish'),
        ),
        h('div', { class: 'section' },
          h('h3', {}, '4 · MPC Simulation Room'),
          h('p', {}, 'Oval stol, har bir ishtirokchi uchun monitor, vizualizatsiya devori va control room. Shok tanlang, stavka bo‘yicha qaror qabul qiling — model 12 chorakni hisoblaydi.'),
          h('button', { class: 'btn primary', onclick: () => enter('mpc') }, icon('enter'), 'MPC xonasiga kirish'),
        ),
      );
    },
  });

  return { enter, exit };
}
