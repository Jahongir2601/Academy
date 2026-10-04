import './style.css';
import * as THREE from 'three';
import { App, VIEWS } from './app';
import { Shell } from './ui/shell';
import { h } from './ui/dom';
import { Selection } from './features/selection';
import { Walk } from './features/walk';
import { mountViews, exportGLBBuffer } from './features/views';
import { mountSun } from './features/sun';
import { mountSecurity } from './features/security';
import { mountNumbers } from './features/numbers';
import { mountHud } from './features/hud';
import { mountPeople } from './features/people';
import { mountInteriors } from './features/interiors';

async function waitFonts() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 40px "Marcellus"'),
        document.fonts.load('400 14px "IBM Plex Sans"'),
        document.fonts.load('400 14px "IBM Plex Mono"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* shrift yuklanmasa ham davom etamiz — zaxira shriftlar bor */
  }
}

async function boot() {
  const root = document.getElementById('app')!;
  const stage = h('div', { class: 'stage' });
  const loading = h(
    'div',
    { class: 'loading' },
    h('div', { class: 'inner' },
      h('h1', {}, 'Markaziy Bank Akademiyasi'),
      h('p', {}, 'Kampus maketi yuklanmoqda'),
      h('div', { class: 'bar' }, h('i')),
    ),
  );
  root.append(stage, loading);
  await waitFonts();
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const app = new App(stage);
  app.build();
  const shell = new Shell(root);
  const sel = new Selection(app, shell);
  const walk = new Walk(app);
  walk.onChange = (on) => shell.setVisible(!on);

  const { tour } = mountViews(app, shell, sel, walk);
  const sun = mountSun(app, shell);
  const security = mountSecurity(app, shell);
  const people = mountPeople(app, shell, sel);
  const interiors = mountInteriors(app, shell, sel, walk);
  sel.onEnterInterior = (k) => interiors.enter(k);

  const view = (id: string) => {
    const v = VIEWS.find((x) => x.id === id)!;
    app.flyTo({ x: v.pos[0], y: v.pos[1], z: v.pos[2] }, { x: v.target[0], y: v.target[1], z: v.target[2] });
  };
  mountNumbers(app, shell, {
    showEntrance: () => {
      tour.stop();
      sel.select('conference', false);
      view('entrance');
    },
    showKnowledge: () => {
      tour.stop();
      sel.select('knowledge', false);
      app.flyTo({ x: 0, y: 62, z: 120 }, { x: 0, y: 4, z: 10 });
    },
    showSecure: () => {
      tour.stop();
      security.set(true);
      sel.select('secure', false);
      app.flyTo({ x: 60, y: 120, z: 40 }, { x: 0, y: 0, z: -70 });
    },
    showShade: () => {
      tour.stop();
      sun.setNoonSummer();
      shell.select('sun');
      view('courtyard');
    },
    showArcades: () => {
      tour.stop();
      app.flyTo({ x: 120, y: 70, z: 40 }, { x: 40, y: 0, z: -40 });
    },
    showResidence: () => {
      tour.stop();
      sel.select('residence', false);
      app.flyTo({ x: 230, y: 70, z: -60 }, { x: 140, y: 0, z: -130 });
    },
    showParking: () => {
      tour.stop();
      sel.select('parking', false);
      view('parking');
    },
  });
  mountHud(app, shell);
  void people;

  if (!app.isMobile && window.innerWidth > 760) {
    shell.select('view');
    // chap panel kampusni to‘smasligi uchun kamerani ekran bo‘yicha chapga suramiz
    const fwd = app.controls.target.clone().sub(app.camera.position).normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
    const shift = right.multiplyScalar(-Math.min(110, 85 * (1440 / Math.max(900, window.innerWidth))));
    app.camera.position.add(shift);
    app.controls.target.add(shift);
    app.controls.update();
  }
  app.start();
  loading.style.opacity = '0';
  setTimeout(() => loading.remove(), 600);
  (window as unknown as Record<string, unknown>).app = app;
  (window as unknown as Record<string, unknown>).ui = { shell, sel, walk, tour, security, people, interiors, exportGLB: () => exportGLBBuffer(app) };
}

boot();
