// Ilova yadrosi: renderer, kamera, boshqaruv, sahna qatlamlari, vaqt holati.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Environment } from './core/environment';
import { Instancer } from './core/instancer';
import { getMaterials } from './core/materials';
import { buildBuildings, getOccluders, type BuildingsResult } from './scene/buildings';
import { buildLandscape, type LandscapeResult } from './scene/landscape';
import { buildArcades } from './scene/arcades';

export type Listener = (dt: number, t: number) => void;

export interface ViewPreset {
  id: string;
  label: string;
  pos: [number, number, number];
  target: [number, number, number];
}

export const VIEWS: ViewPreset[] = [
  { id: 'overview', label: 'Umumiy ko‘rinish', pos: [260, 210, 330], target: [0, 0, -5] },
  { id: 'entrance', label: 'Ceremonial kirish', pos: [0, 9, 205], target: [0, 12, 80] },
  { id: 'courtyard', label: 'Academy Courtyard', pos: [-7, 4.5, 27], target: [2, 3.5, -30] },
  { id: 'research', label: 'Research va Scholars’ Garden', pos: [-150, 70, -10], target: [-60, 0, -105] },
  { id: 'residence', label: 'Residence va Club', pos: [150, 60, -40], target: [100, 0, -125] },
  { id: 'parking', label: 'Solar parking', pos: [-95, 55, 135], target: [-152, 0, 40] },
  { id: 'plan', label: 'Reja (yuqoridan)', pos: [0, 520, 0.01], target: [0, 0, 0] },
];

export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly env: Environment;
  readonly campus = new THREE.Group();
  readonly overlays = new THREE.Group();
  buildings!: BuildingsResult;
  landscape!: LandscapeResult;
  readonly occluders = getOccluders();

  /** Yil kuni (1–365) va mahalliy soat. */
  doy = 172;
  hours = 11.5;
  timeListeners: (() => void)[] = [];
  resizeListeners: ((w: number, h: number) => void)[] = [];
  /** Asosiy sahnani o‘zi chizadigan bosqich (masalan, post-processing). true qaytarsa, oddiy render o‘tkaziladi. */
  renderHook: ((dt: number) => boolean) | null = null;
  /** GLB eksportidan oldin chaqiriladi; qaytgan funksiya eksportdan keyin holatni tiklaydi. */
  exportHooks: (() => () => void)[] = [];
  private listeners: Listener[] = [];
  private timer = new THREE.Timer();
  private flight: {
    from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number;
  } | null = null;
  /** Interyer rejimida boshqa sahna chiziladi. */
  activeScene: THREE.Scene;
  activeCamera: THREE.PerspectiveCamera;
  readonly isMobile: boolean;

  constructor(private container: HTMLElement) {
    this.isMobile = Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.6;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.3, 24000);
    const v = VIEWS[0];
    this.camera.position.set(...v.pos);
    // tik ekranda (telefon) kampus to‘liq sig‘ishi uchun uzoqroqdan
    const aspect = container.clientWidth / container.clientHeight;
    if (aspect < 0.85) this.camera.position.sub(new THREE.Vector3(...v.target)).multiplyScalar(1.75).add(new THREE.Vector3(...v.target));
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...v.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 1400;
    this.controls.screenSpacePanning = false;
    this.controls.update();

    this.env = new Environment(this.scene, this.renderer, this.isMobile ? 2048 : 4096);
    this.activeScene = this.scene;
    this.activeCamera = this.camera;

    this.campus.name = 'campus';
    this.scene.add(this.campus);
    this.overlays.name = 'overlays';
    this.scene.add(this.overlays);

    window.addEventListener('resize', () => this.resize());
  }

  build() {
    getMaterials();
    const I = new Instancer();
    this.buildings = buildBuildings(I);
    this.landscape = buildLandscape(I);
    const arcades = buildArcades();
    const inst = I.build();
    inst.name = 'instanced';
    this.campus.add(this.buildings.group, this.landscape.group, arcades, inst);
    // tungi fasad yoritgichlari: Grand Hall portigi va Conference kirishi
    const flood = (x: number, z: number, tx: number, ty: number, tz: number, power: number) => {
      const l = new THREE.SpotLight(0xffd9a8, 0, 120, Math.PI / 7, 0.6, 1.2);
      l.position.set(x, 0.6, z);
      l.target.position.set(tx, ty, tz);
      this.scene.add(l, l.target);
      this.timeListeners.push(() => (l.intensity = power * this.env.state.night));
    };
    flood(-16, 112, -4, 12, 96, 900);
    flood(16, 112, 4, 12, 96, 900);
    flood(76, 118, 76, 6, 98, 350);
    this.setTime(this.doy, this.hours);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    for (const cam of new Set([this.camera, this.activeCamera])) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    this.resizeListeners.forEach((f) => f(w, h));
  }

  setTime(doy: number, hours: number) {
    this.doy = Math.max(1, Math.min(365, Math.round(doy)));
    this.hours = Math.max(0, Math.min(23.99, hours));
    this.env.update(this.doy, this.hours);
    this.timeListeners.forEach((f) => f());
  }

  onFrame(f: Listener) {
    this.listeners.push(f);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== f);
    };
  }

  flyTo(pos: THREE.Vector3Like, target: THREE.Vector3Like, dur = 1.6) {
    this.flight = {
      from: this.camera.position.clone(),
      to: new THREE.Vector3(pos.x, pos.y, pos.z),
      tFrom: this.controls.target.clone(),
      tTo: new THREE.Vector3(target.x, target.y, target.z),
      t: 0,
      dur,
    };
  }

  cancelFlight() {
    this.flight = null;
  }

  /** Bitta kadr: asosiy sahnada renderHook (post-processing) bo‘lsa, o‘sha orqali. */
  renderFrame(dt = 0) {
    if (!(this.activeScene === this.scene && this.renderHook?.(dt))) this.renderer.render(this.activeScene, this.activeCamera);
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.timer.update();
      const dt = Math.min(0.1, this.timer.getDelta());
      const t = this.timer.getElapsed();
      if (this.flight) {
        const f = this.flight;
        f.t += dt / f.dur;
        const k = Math.min(1, f.t);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        // yoy bo‘ylab: o‘rtada biroz balandroq
        const lift = Math.sin(Math.PI * e) * Math.min(80, f.from.distanceTo(f.to) * 0.25);
        this.camera.position.lerpVectors(f.from, f.to, e).y += lift;
        this.controls.target.lerpVectors(f.tFrom, f.tTo, e);
        if (f.t >= 1) this.flight = null;
      }
      for (const l of this.listeners) l(dt, t);
      if (this.activeScene === this.scene) this.controls.update();
      const wn = getMaterials().waterNormal;
      wn.offset.x = t * 0.004;
      wn.offset.y = t * 0.0025;
      this.renderFrame(dt);
      if (this.activeScene === this.scene) this.labelRenderer.render(this.scene, this.camera);
    };
    loop();
  }
}
