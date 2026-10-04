// Piyoda rejim: ko‘z balandligida (1.7 m) yurish — W/A/S/D yoki strelkalar, sichqoncha bilan qarash.
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { App } from '../app';
import { toast } from '../ui/dom';

export class Walk {
  active = false;
  private plc: PointerLockControls;
  private keys = new Set<string>();
  private saved: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  onChange: ((active: boolean) => void) | null = null;
  /** Interyer sahnasida yurganda chegaralar. */
  bounds: { x0: number; x1: number; z0: number; z1: number } | null = null;
  eye = 1.7;
  collide = true;

  constructor(private app: App) {
    this.plc = new PointerLockControls(app.camera, document.body);
    this.plc.addEventListener('unlock', () => {
      if (this.active) this.exit();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    app.onFrame((dt) => this.tick(dt));
  }

  setCamera(cam: THREE.PerspectiveCamera) {
    // PointerLockControls kamerani konstruktorda oladi — interyer uchun almashtiramiz
    (this.plc as unknown as { object: THREE.Camera }).object = cam;
  }

  enter(start?: THREE.Vector3, lookAt?: THREE.Vector3) {
    const cam = (this.plc as unknown as { object: THREE.PerspectiveCamera }).object;
    if (cam === this.app.camera) {
      this.saved = { pos: this.app.camera.position.clone(), target: this.app.controls.target.clone() };
      this.app.controls.enabled = false;
      this.app.cancelFlight();
    }
    const p = start ?? new THREE.Vector3(0, this.eye, 140);
    cam.position.set(p.x, this.eye, p.z);
    cam.lookAt(lookAt ?? new THREE.Vector3(0, 8, 60));
    this.active = true;
    try {
      this.plc.lock();
    } catch {
      /* pointer lock bo‘lmasa ham klaviatura bilan yurish mumkin */
    }
    toast('Piyoda rejim: W A S D — yurish, sichqoncha — qarash, Shift — tezroq, Esc — chiqish', 5000);
    this.onChange?.(true);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    if (this.plc.isLocked) this.plc.unlock();
    const cam = (this.plc as unknown as { object: THREE.PerspectiveCamera }).object;
    if (cam === this.app.camera && this.saved) {
      this.app.camera.position.copy(this.saved.pos);
      this.app.controls.target.copy(this.saved.target);
      this.app.controls.enabled = true;
    }
    this.onChange?.(false);
  }

  private tick(dt: number) {
    if (!this.active) return;
    const cam = (this.plc as unknown as { object: THREE.PerspectiveCamera }).object;
    const k = this.keys;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 9 : 3.2) * dt;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (!f && !r) return;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    const next = cam.position.clone().addScaledVector(dir, f * speed).addScaledVector(right, r * speed);
    if (this.bounds) {
      next.x = Math.min(this.bounds.x1, Math.max(this.bounds.x0, next.x));
      next.z = Math.min(this.bounds.z1, Math.max(this.bounds.z0, next.z));
    } else if (this.collide && this.app.occluders.insideBuilding(next.x, next.z)) {
      // devorga urilganda sirpanish: faqat bitta o‘q bo‘yicha harakat
      const nx = new THREE.Vector3(next.x, cam.position.y, cam.position.z);
      const nz = new THREE.Vector3(cam.position.x, cam.position.y, next.z);
      if (!this.app.occluders.insideBuilding(nx.x, nx.z)) next.copy(nx);
      else if (!this.app.occluders.insideBuilding(nz.x, nz.z)) next.copy(nz);
      else return;
    }
    cam.position.set(next.x, cam.position.y, next.z);
  }
}
