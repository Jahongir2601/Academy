// Monetary Policy Committee Simulation Room: oval stol, monitorlar, vizualizatsiya devori, control room.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GeoBuilder } from '../core/geo';
import { getMaterials, textTexture } from '../core/materials';
import type { InteriorBuild } from './grandHall';

export interface MpcBuild extends InteriorBuild {
  wallCanvas: HTMLCanvasElement;
  wallTex: THREE.CanvasTexture;
}

const X0 = -9;
const X1 = 9;
const Z0 = -6;
const Z1 = 6;
const HGT = 5.4;

function monitorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d1517';
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = '#26363a';
  for (let k = 1; k < 4; k++) {
    g.beginPath();
    g.moveTo(14, 20 + k * 30);
    g.lineTo(242, 20 + k * 30);
    g.stroke();
  }
  g.strokeStyle = '#d95926';
  g.lineWidth = 3;
  g.beginPath();
  [70, 64, 70, 60, 52, 56, 48, 44, 46, 40].forEach((v, i) => (i ? g.lineTo(14 + i * 25, v + 40) : g.moveTo(14, v + 40)));
  g.stroke();
  g.strokeStyle = '#3987e5';
  g.beginPath();
  [60, 60, 56, 56, 56, 58, 58, 60, 62, 62].forEach((v, i) => (i ? g.lineTo(14 + i * 25, v + 40) : g.moveTo(14, v + 40)));
  g.stroke();
  g.fillStyle = '#b2bbbd';
  g.font = '16px "IBM Plex Sans", sans-serif';
  g.fillText('MPC · ma’lumotlar', 14, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildMpcRoom(renderer: THREE.WebGLRenderer): MpcBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101517);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  const m = getMaterials();
  const B = new GeoBuilder();
  const UV = { su: 1, sv: 1 };

  const carpet = new THREE.MeshStandardMaterial({ color: 0x2c3438, roughness: 1 });
  const walnut = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.35, metalness: 0.05 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x23282b, roughness: 0.55 });
  const acoustic = new THREE.MeshStandardMaterial({ color: 0x8d6a4a, roughness: 0.8 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x1c2224, roughness: 0.9 });
  const strip = new THREE.MeshBasicMaterial({ color: 0xfff3dc, toneMapped: false });

  B.box('carpet', X0 - 0.5, X1 + 0.5, -0.2, 0, Z0 - 0.5, Z1 + 4, UV);
  B.box('ceiling', X0 - 0.5, X1 + 0.5, HGT, HGT + 0.3, Z0 - 0.5, Z1 + 4, UV);
  // devorlar
  B.box('stoneDark', X0 - 0.4, X0, 0, HGT, Z0, Z1, UV);
  B.box('stoneDark', X1, X1 + 0.4, 0, HGT, Z0, Z1, UV);
  B.box('stoneDark', X0, X1, 0, HGT, Z0 - 0.4, Z0, UV);
  // janub devori: control room oynasi
  B.box('stoneDark', X0, -4.5, 0, HGT, Z1, Z1 + 0.3, UV);
  B.box('stoneDark', 4.5, X1, 0, HGT, Z1, Z1 + 0.3, UV);
  B.box('stoneDark', -4.5, 4.5, 0, 1.0, Z1, Z1 + 0.3, UV);
  B.box('stoneDark', -4.5, 4.5, 3.2, HGT, Z1, Z1 + 0.3, UV);
  B.box('darkMetal', -4.5, 4.5, 3.15, 3.25, Z1 - 0.05, Z1 + 0.35, UV);
  // akustik yog‘och reykalar (sharq va g‘arb devorlari)
  for (let z = Z0 + 0.4; z < Z1 - 0.2; z += 0.32) {
    B.box('acoustic', X0, X0 + 0.12, 0.3, HGT - 0.3, z - 0.07, z + 0.07, UV);
    B.box('acoustic', X1 - 0.12, X1, 0.3, HGT - 0.3, z - 0.07, z + 0.07, UV);
  }
  // shiftdagi chiziqli yorug‘lik
  for (const x of [-6, -2, 2, 6]) B.box('strip', x - 0.05, x + 0.05, HGT - 0.04, HGT, Z0 + 1, Z1 - 1, UV);
  // control room ichi
  B.box('stoneDark', X0, X1, 0, HGT, Z1 + 3.8, Z1 + 4, UV);
  B.box('walnut', -4, 4, 0.72, 0.78, Z1 + 1.2, Z1 + 2.1, UV);
  B.box('darkMetal', -3.9, 3.9, 0, 0.72, Z1 + 1.9, Z1 + 2.05, UV);

  // oval stol (halqa)
  const outer = new THREE.Shape();
  outer.absellipse(0, 0, 4.3, 1.95, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 2.9, 0.75, 0, Math.PI * 2, true, 0);
  outer.holes.push(hole);
  const top = new THREE.ExtrudeGeometry(outer, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, curveSegments: 48 });
  top.rotateX(-Math.PI / 2);
  top.translate(0, 0.74, -0.5);
  B.add('walnut', top, UV);
  const base = new THREE.Shape();
  base.absellipse(0, 0, 3.7, 1.45, 0, Math.PI * 2, false, 0);
  const bh = new THREE.Path();
  bh.absellipse(0, 0, 3.4, 1.15, 0, Math.PI * 2, true, 0);
  base.holes.push(bh);
  const baseG = new THREE.ExtrudeGeometry(base, { depth: 0.72, bevelEnabled: false, curveSegments: 40 });
  baseG.rotateX(-Math.PI / 2);
  baseG.translate(0, 0, -0.5);
  B.add('darkMetal', baseG, UV);

  const mats = {
    ...(m as unknown as Record<string, THREE.Material>),
    carpet, walnut, leather, acoustic, ceiling, strip,
  };
  const built = B.build(mats);
  built.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(built);

  // o‘rindiqlar va monitorlar
  const seat = new THREE.BoxGeometry(0.56, 0.1, 0.52);
  const back = new THREE.BoxGeometry(0.56, 0.7, 0.08);
  const mon = new THREE.BoxGeometry(0.5, 0.32, 0.03);
  const monMat = new THREE.MeshBasicMaterial({ map: monitorTexture(), toneMapped: false });
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.PI / n;
    const ex = Math.cos(a);
    const ez = Math.sin(a);
    const sx = ex * 5.0;
    const sz = ez * 2.65 - 0.5;
    // stul −z tomonga qaraydi: aylantirib stol markaziga yo‘naltiramiz; monitor esa stulga qaraydi
    const yaw = Math.atan2(ex * 5.0, ez * 2.65);
    const g = new THREE.Group();
    const s = new THREE.Mesh(seat, leather);
    s.position.y = 0.5;
    const b = new THREE.Mesh(back, leather);
    b.position.set(0, 0.9, 0.26);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), m.darkMetal);
    leg.position.y = 0.23;
    g.add(s, b, leg);
    g.position.set(sx, 0, sz);
    g.rotation.y = yaw;
    g.traverse((o) => (o.castShadow = true));
    scene.add(g);
    const mm = new THREE.Mesh(mon, monMat);
    const mx = ex * 3.75;
    const mz = ez * 1.62 - 0.5;
    mm.position.set(mx, 0.98, mz);
    mm.rotation.y = yaw;
    mm.rotation.x = -0.2;
    scene.add(mm);
  }
  // control room monitorlari
  for (let x = -3; x <= 3; x += 1.5) {
    const mm = new THREE.Mesh(mon, monMat);
    mm.scale.set(1.4, 1.4, 1);
    mm.position.set(x, 1.12, Z1 + 1.55);
    mm.rotation.y = Math.PI;
    scene.add(mm);
  }

  // vizualizatsiya devori
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 2048;
  wallCanvas.height = 760;
  const wallTex = new THREE.CanvasTexture(wallCanvas);
  wallTex.colorSpace = THREE.SRGBColorSpace;
  wallTex.anisotropy = 8;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 4.27), new THREE.MeshBasicMaterial({ map: wallTex, toneMapped: false }));
  wall.position.set(0, 2.75, Z0 + 0.06);
  scene.add(wall);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(11.8, 4.5, 0.1), m.darkMetal);
  bezel.position.set(0, 2.75, Z0 + 0.0);
  scene.add(bezel);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.4),
    new THREE.MeshBasicMaterial({ map: textTexture('MONETARY POLICY COMMITTEE · SIMULATION ROOM', { w: 2048, h: 130, color: '#d6a868' }), transparent: true, toneMapped: false }),
  );
  sign.position.set(0, 5.05, Z0 + 0.07);
  scene.add(sign);

  // yorug‘lik
  scene.add(new THREE.HemisphereLight(0xe8e2d6, 0x2a2622, 0.5));
  const spot = new THREE.SpotLight(0xfff1dc, 60, 14, Math.PI / 4, 0.5, 1.2);
  spot.position.set(0, HGT - 0.2, -0.5);
  spot.target.position.set(0, 0.7, -0.5);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  scene.add(spot, spot.target);
  for (const x of [-6, 6]) {
    const p = new THREE.PointLight(0xffe2bd, 10, 9, 1.5);
    p.position.set(x, HGT - 0.6, 0);
    scene.add(p);
  }
  const wallGlow = new THREE.PointLight(0x9cc8ff, 6, 8, 1.5);
  wallGlow.position.set(0, 2.5, Z0 + 1.2);
  scene.add(wallGlow);

  return {
    scene,
    start: { pos: new THREE.Vector3(8.0, 2.7, 5.4), target: new THREE.Vector3(-1.2, 1.7, -2.6) },
    bounds: { x0: X0 + 0.5, x1: X1 - 0.5, y0: 0.8, y1: HGT - 0.4, z0: Z0 + 0.6, z1: Z1 - 0.3 },
    update: () => {},
    wallCanvas,
    wallTex,
  };
}
