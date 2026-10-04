// Avtomatik tur: kamera kampus bo‘ylab uchib o‘tadi, har bir to‘xtashda izoh.
import * as THREE from 'three';
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h, icon } from '../ui/dom';

interface Stop {
  pos: [number, number, number];
  target: [number, number, number];
  title: string;
  text: string;
  hold?: number;
}

export const TOUR: Stop[] = [
  {
    pos: [250, 200, 320], target: [0, 0, -10],
    title: 'Kampus umumiy ko‘rinishi',
    text: '11,4 ga uchastka, ~52 ming m² qurilish. Past va keng, yashil, piyodalar uchun qulay kampus. Xavfsizlik darajasi old tomondan orqaga qarab oshib boradi.',
  },
  {
    pos: [0, 7, 196], target: [0, 11, 92],
    title: 'Ceremonial Entrance',
    text: 'Simmetrik kirish, oval suv havzasi va drop-off halqasi. Chapda Museum, o‘ngda Conference Centre: ikkalasi Ring 1 da, alohida kirishlari bor (1-taklif).',
  },
  {
    pos: [-24, 6, 122], target: [0, 10, 94],
    title: 'Grand Academy Hall',
    text: 'Sakkiz ustunli portik va bronza girih panjara. Ichkarida 20 metrli atrium bor, Knowledge Stair shimolga, Knowledge Centre’ga ko‘tariladi.',
  },
  {
    pos: [0, 62, 120], target: [0, 4, 10],
    title: 'Knowledge Centre bosh o‘qda',
    text: 'Kutubxona Grand Hall bilan hovli orasida joylashgan, kampusning eng ko‘rinadigan bilim makoni (2-taklif).',
  },
  {
    pos: [-7, 4.5, 26], target: [2, 3.5, -30], hold: 5.5,
    title: 'Academy Courtyard — chorbog‘',
    text: '80 × 60 m hovli: xoch shaklidagi suv havzasi, to‘rt bo‘lakda chinorlar, perimetr bo‘ylab ravoqlar. Soya tahlilini «Quyosh» bo‘limida ko‘rish mumkin (4-taklif).',
  },
  {
    pos: [8, 22, 6], target: [52, 6, -2],
    title: 'Simulation Centre va Data, AI & Innovation',
    text: 'MPC va Crisis xonalari, Data Lab, AI Lab, Fintech & CBDC Lab — barchasi Ring 2 da. MPC xonasining interyerini «Interyer» bo‘limida ko‘ring.',
  },
  {
    pos: [-5, 48, -20], target: [-22, 2, -82],
    title: 'Secure Research Zone — Ring 3',
    text: 'Research Institute va Secure Data Lab bitta to‘siq ichida. Maxfiy ma’lumotlar bilan ishlash Ring 2 laboratoriyalaridan ajratilgan (3-taklif).',
  },
  {
    pos: [-40, 9, -100], target: [-90, 3, -130],
    title: 'Scholars’ Garden',
    text: 'Ariq, pavilonlar va zich daraxtzor — tadqiqotchilar uchun sokin bog‘. Bosh o‘q shu yerdagi pavilon bilan yakunlanadi.',
  },
  {
    pos: [92, 26, -82], target: [100, 6, -128],
    title: 'Academy Residence va Club',
    text: '~140 xona, restoran, basseyn, tennis va padel kortlari. Mehmonlar shimoli-sharqdagi alohida yo‘ldan keladi (6-taklif).',
  },
  {
    pos: [76.5, 2.2, -8], target: [76.5, 3, -80], hold: 5,
    title: 'Soyali ravoqlar tarmog‘i',
    text: 'Barcha bloklar yopiq ravoqlar bilan bog‘langan, shuning uchun yozgi 40 °C issiqda ham piyoda yurish qulay (5-taklif).',
  },
  {
    pos: [-100, 30, 120], target: [-152, 2, 50],
    title: 'Solar parking',
    text: '~265 joy quyosh panelli soyabonlar ostida (~0,75 MWp), ~150 joy esa Conference Centre ostida, yer osti qavatida (7-taklif). Kampus markaziga avtomobil kirmaydi.',
  },
  {
    pos: [-230, 170, -230], target: [0, 0, 0],
    title: 'Bilim → Tahlil → Qaror',
    text: 'Ta’lim, tadqiqot, simulyatsiya, konferensiya va yashash bitta kampusda: Central Asia’s Centre for Central Banking Knowledge.',
  },
];

export class Tour {
  running = false;
  private i = 0;
  private phase: 'fly' | 'hold' = 'fly';
  private t = 0;
  private flyDur = 3.6;
  private holdBase = 4.6;
  private from = new THREE.Vector3();
  private fromT = new THREE.Vector3();
  private stepEl = h('div', { class: 'cap-step' });
  private titleEl = h('h4');
  private textEl = h('p');
  private bar = h('i');
  onStop: (() => void) | null = null;

  constructor(private app: App, private shell: Shell) {
    app.onFrame((dt) => this.tick(dt));
    app.renderer.domElement.addEventListener('pointerdown', () => {
      if (this.running) this.stop();
    });
    app.renderer.domElement.addEventListener('wheel', () => {
      if (this.running) this.stop();
    }, { passive: true });
  }

  start() {
    this.running = true;
    this.i = 0;
    this.beginStop();
    const cap = this.shell.caption;
    cap.replaceChildren(
      h('div', { class: 'cap-text' }, this.stepEl, this.titleEl, this.textEl, h('div', { class: 'cap-progress' }, this.bar)),
      h('button', { class: 'icon-btn', 'aria-label': 'Turni to‘xtatish', title: 'To‘xtatish', onclick: () => this.stop() }, icon('stop')),
    );
    cap.hidden = false;
    this.shell.hint.hidden = true;
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.shell.caption.hidden = true;
    this.app.controls.enabled = true;
    this.onStop?.();
  }

  private beginStop() {
    const s = TOUR[this.i];
    this.phase = 'fly';
    this.t = 0;
    this.from.copy(this.app.camera.position);
    this.fromT.copy(this.app.controls.target);
    this.stepEl.textContent = `${String(this.i + 1).padStart(2, '0')} / ${String(TOUR.length).padStart(2, '0')}`;
    this.titleEl.textContent = s.title;
    this.textEl.textContent = s.text;
  }

  private tick(dt: number) {
    if (!this.running) return;
    const s = TOUR[this.i];
    this.t += dt;
    const to = new THREE.Vector3(...s.pos);
    const toT = new THREE.Vector3(...s.target);
    if (this.phase === 'fly') {
      const k = Math.min(1, this.t / this.flyDur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const lift = Math.sin(Math.PI * e) * Math.min(60, this.from.distanceTo(to) * 0.2);
      this.app.camera.position.lerpVectors(this.from, to, e).y += lift;
      this.app.controls.target.lerpVectors(this.fromT, toT, e);
      if (k >= 1) {
        this.phase = 'hold';
        this.t = 0;
      }
    } else {
      const hold = s.hold ?? this.holdBase;
      // sekin siljish: kamera nishonga tomon biroz yaqinlashadi
      const dir = toT.clone().sub(to).normalize();
      this.app.camera.position.copy(to).addScaledVector(dir, this.t * 0.9);
      this.app.controls.target.copy(toT);
      if (this.t >= hold) {
        this.i++;
        if (this.i >= TOUR.length) {
          this.stop();
          return;
        }
        this.beginStop();
      }
    }
    const total = TOUR.length;
    const frac = (this.i + (this.phase === 'fly' ? 0 : 0.5) + 0.5 * Math.min(1, this.t / (this.phase === 'fly' ? this.flyDur : s.hold ?? this.holdBase))) / total;
    this.bar.style.width = `${(frac * 100).toFixed(1)}%`;
  }
}
