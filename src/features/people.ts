// «Odamlar» bo‘limi: odamlar oqimi simulyatsiyasi boshqaruvi va jonli ko‘rsatkichlar.
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import type { Selection } from './selection';
import { h, icon, fmt } from '../ui/dom';
import { formatTime } from '../core/sun';
import { PeopleSim, AGENT_TYPES, SCENARIOS, type AgentType, type ScenarioId } from '../sim/people';
import { BUILDINGS } from '../data/campus';

const SPEEDS = [30, 60, 180, 600];
const JUMPS: { label: string; t: number }[] = [
  { label: '08:15 kelish', t: 8 * 60 + 15 },
  { label: '10:50 tanaffus', t: 10 * 60 + 50 },
  { label: '12:40 tushlik', t: 12 * 60 + 40 },
  { label: '17:10 ketish', t: 17 * 60 + 10 },
];

export function mountPeople(app: App, shell: Shell, sel: Selection) {
  const sim = new PeopleSim(app.occluders, () => app.env.state.sun.dir);
  app.scene.add(sim.mesh);
  sim.mesh.visible = false;
  let running = false;
  let started = false;
  let speed = 60;
  let uiTimer = 0;

  const scenarioSel = h('select', { id: 'sim-scenario', 'aria-label': 'Ssenariy' },
    ...(Object.keys(SCENARIOS) as ScenarioId[]).map((k) => h('option', { value: k }, SCENARIOS[k].label)));
  const note = h('p', { class: 'note' }, SCENARIOS.study.note);
  const playBtn = h('button', { class: 'btn primary' }, icon('play'), 'Boshlash');
  const resetBtn = h('button', { class: 'btn' }, 'Qaytadan');
  const clock = h('b', {}, '07:00');
  const speedChips = h('div', { class: 'chips' });
  const jumpChips = h('div', { class: 'chips' });
  const legend = h('div', { class: 'legend' });
  const legendCounts = new Map<AgentType, HTMLElement>();
  const st = {
    present: h('b', {}, '0'),
    outdoors: h('b', {}, '0'),
    shade: h('b', {}, '—'),
    walk: h('b', {}, '—'),
    viol: h('b', {}, '0'),
    cps: h('b', {}, '0'),
  };

  (Object.keys(AGENT_TYPES) as AgentType[]).forEach((t) => {
    const c = h('small', {}, '0');
    legendCounts.set(t, c);
    const hex = `#${AGENT_TYPES[t].color.toString(16).padStart(6, '0')}`;
    legend.append(h('div', { class: 'legend-row' }, h('i', { style: `background:${hex};border-radius:50%` }),
      h('div', {}, h('b', {}, AGENT_TYPES[t].label), c)));
  });

  SPEEDS.forEach((s) => {
    const b = h('button', { class: 'chip', 'aria-pressed': String(s === speed) }, `×${s}`);
    b.addEventListener('click', () => {
      speed = s;
      speedChips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    speedChips.append(b);
  });

  const setPlaying = (v: boolean) => {
    running = v;
    playBtn.replaceChildren(icon(v ? 'pause' : 'play'), v ? 'Pauza' : started ? 'Davom ettirish' : 'Boshlash');
  };

  const begin = () => {
    sim.reset(scenarioSel.value as ScenarioId);
    started = true;
    sim.mesh.visible = true;
    app.setTime(app.doy, sim.time / 60);
    updateUI();
  };

  JUMPS.forEach((j) => {
    const b = h('button', { class: 'chip' }, j.label);
    b.addEventListener('click', () => {
      if (!started || sim.time > j.t) begin();
      sim.fastForward(j.t);
      app.setTime(app.doy, sim.time / 60);
      updateUI();
    });
    jumpChips.append(b);
  });

  scenarioSel.addEventListener('change', () => {
    note.textContent = SCENARIOS[scenarioSel.value as ScenarioId].note;
    if (started) {
      begin();
    }
  });
  playBtn.addEventListener('click', () => {
    if (!started) begin();
    setPlaying(!running);
    if (running && app.camera.position.y > 260) app.flyTo({ x: 150, y: 170, z: 210 }, { x: 0, y: 0, z: 10 });
  });
  resetBtn.addEventListener('click', () => {
    begin();
    setPlaying(false);
  });

  const updateUI = () => {
    const m = sim.metrics();
    clock.textContent = formatTime(sim.time / 60);
    st.present.textContent = fmt(m.present);
    st.outdoors.textContent = fmt(m.outdoors);
    st.shade.textContent = m.shadeShare > 0 ? `${Math.round(m.shadeShare * 100)}%` : '—';
    st.walk.textContent = m.avgWalk > 0 ? `${fmt(m.avgWalk)} m` : '—';
    st.viol.textContent = String(m.violations);
    st.cps.textContent = fmt(m.checkpoints);
    legendCounts.forEach((el, t) => (el.textContent = `${fmt(m.byType[t])} kishi kampusda`));
    for (const b of BUILDINGS) sel.setCount(b.id, m.occupancy[b.id] ?? 0);
  };

  app.onFrame((dt) => {
    if (!started) return;
    if (running) {
      const dtMin = (dt * speed) / 60;
      // katta tezlikda qadamni bo‘laklaymiz
      const n = Math.max(1, Math.ceil(dtMin / 0.25));
      for (let i = 0; i < n; i++) sim.step(dtMin / n);
      if (sim.time >= 20.5 * 60) setPlaying(false);
      app.setTime(app.doy, Math.min(23.9, sim.time / 60));
      sim.writeMatrices();
    }
    uiTimer += dt;
    if (uiTimer > 0.4) {
      uiTimer = 0;
      updateUI();
    }
  });

  shell.addTab({
    id: 'people',
    label: 'Odamlar',
    icon: 'people',
    build: (p) => {
      p.append(
        h('h2', {}, 'Odamlar oqimi'),
        h('p', { class: 'lede' }, 'Har bir rangli figura — bitta odam. Ular kunlik jadval bo‘yicha yuradi va faqat o‘z ringiga ruxsat etilgan yo‘llardan foydalanadi.'),
        h('div', { class: 'section' },
          h('div', { class: 'field' }, h('label', { for: 'sim-scenario' }, 'Ssenariy'), scenarioSel),
          note,
        ),
        h('div', { class: 'section' },
          h('div', { class: 'field-head' }, h('h3', {}, 'Simulyatsiya vaqti'), clock),
          h('div', { class: 'btn-row' }, playBtn, resetBtn),
          h('h3', {}, 'Tezlik'),
          speedChips,
          h('h3', {}, 'Vaqtga o‘tish'),
          jumpChips,
        ),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, st.present, h('span', {}, 'kampusda')),
          h('div', { class: 'stat' }, st.outdoors, h('span', {}, 'ochiq havoda')),
          h('div', { class: 'stat' }, st.shade, h('span', {}, 'piyoda yo‘lning soyadagi ulushi')),
          h('div', { class: 'stat' }, st.walk, h('span', {}, 'o‘rtacha bitta yurish')),
          h('div', { class: 'stat' }, st.viol, h('span', {}, 'ring buzilishlari')),
          h('div', { class: 'stat' }, st.cps, h('span', {}, 'nazorat nuqtasidan o‘tish')),
        ),
        h('div', { class: 'section' }, h('h3', {}, 'Guruhlar'), legend),
        h('p', {}, 'Bino yorliqlaridagi raqam — hozir binoda turgan odamlar soni. Quyosh holati simulyatsiya vaqtiga bog‘langan.'),
      );
    },
  });

  return { sim, begin, setPlaying };
}
