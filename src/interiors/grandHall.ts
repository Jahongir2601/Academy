// Grand Academy Hall interyeri: 20 m atrium, girih panjara orqali quyosh naqshi,
// Knowledge Stair, «Bilim → Tahlil → Qaror» yozuvi, digital wall, pul tarixi vitrinalari.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GeoBuilder } from '../core/geo';
import { getMaterials, textTexture, rng } from '../core/materials';

const X0 = -26.8;
const X1 = 26.8;
const Z0 = 51.2; // shimol (Knowledge Centre tomoni)
const Z1 = 88.8; // janub (kirish)
const HGT = 20.5;

export interface InteriorBuild {
  scene: THREE.Scene;
  start: { pos: THREE.Vector3; target: THREE.Vector3 };
  bounds: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
  update: (dt: number, t: number) => void;
}

function floorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9e2d4';
  g.fillRect(0, 0, 1024, 1024);
  const r = rng(5);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const tone = 228 + Math.floor(r() * 14);
      g.fillStyle = `rgb(${tone},${tone - 7},${tone - 18})`;
      g.fillRect(i * 256 + 2, j * 256 + 2, 252, 252);
    }
  }
  g.strokeStyle = 'rgba(120,100,70,0.35)';
  g.lineWidth = 3;
  for (let k = 0; k <= 4; k++) {
    g.beginPath();
    g.moveTo(k * 256, 0);
    g.lineTo(k * 256, 1024);
    g.moveTo(0, k * 256);
    g.lineTo(1024, k * 256);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 6, 1 / 6); // 1 plitka = 1.5 m
  t.anisotropy = 8;
  return t;
}

function inlayTexture(): THREE.CanvasTexture {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, s, s);
  const cx = s / 2;
  g.strokeStyle = '#9a7444';
  g.lineWidth = 10;
  for (const R of [500, 470]) {
    g.beginPath();
    g.arc(cx, cx, R, 0, Math.PI * 2);
    g.stroke();
  }
  // 16 nurli girih rozetka
  g.lineWidth = 7;
  const star = (n: number, step: number, R: number, rot: number) => {
    g.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = (k * step * Math.PI * 2) / n + rot;
      const x = cx + Math.cos(a) * R;
      const y = cx + Math.sin(a) * R;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  star(16, 7, 440, 0);
  star(8, 3, 300, Math.PI / 8);
  star(8, 3, 160, 0);
  g.fillStyle = '#1d5b75';
  g.beginPath();
  g.arc(cx, cx, 60, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Digital wall — namunaviy iqtisodiy ko‘rsatkichlar paneli (har soniyada yangilanadi). */
class DigitalWall {
  canvas = document.createElement('canvas');
  tex: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private series: number[] = [];
  private tick = 0;
  constructor() {
    this.canvas.width = 1600;
    this.canvas.height = 700;
    this.g = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const r = rng(8);
    let v = 8.9;
    for (let i = 0; i < 36; i++) {
      v += (r() - 0.62) * 0.18;
      this.series.push(v);
    }
    this.draw(0);
  }
  draw(t: number) {
    const g = this.g;
    const W = 1600;
    const H = 700;
    g.fillStyle = '#0d1517';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#d6a868';
    g.font = '600 34px "IBM Plex Sans", sans-serif';
    g.textBaseline = 'top';
    g.fillText('IQTISODIY KO‘RSATKICHLAR', 48, 36);
    g.fillStyle = '#829093';
    g.font = '24px "IBM Plex Sans", sans-serif';
    g.fillText('Namunaviy ma’lumotlar · real vaqt rejimidagi ekran konsepsiyasi', 48, 82);
    const tiles: [string, string, string][] = [
      ['Inflyatsiya, y/y', '8,4%', '−0,2 p.p.'],
      ['Asosiy stavka', '14,0%', 'o‘zgarishsiz'],
      ['Kredit qoldig‘i o‘sishi', '17,8%', '+0,6 p.p.'],
      ['Inflyatsiya kutilmalari', '9,6%', '−0,3 p.p.'],
    ];
    tiles.forEach(([a, b, c], i) => {
      const x = 48 + i * 380;
      const y = 140;
      g.fillStyle = '#152124';
      g.beginPath();
      g.roundRect(x, y, 350, 170, 14);
      g.fill();
      g.fillStyle = '#b2bbbd';
      g.font = '24px "IBM Plex Sans", sans-serif';
      g.fillText(a, x + 22, y + 20);
      g.fillStyle = '#ece8df';
      g.font = '500 64px "IBM Plex Mono", monospace';
      g.fillText(b, x + 22, y + 58);
      g.fillStyle = '#7dbdd6';
      g.font = '22px "IBM Plex Mono", monospace';
      g.fillText(c, x + 22, y + 132);
    });
    // inflyatsiya trayektoriyasi (namuna)
    const px = 48;
    const py = 350;
    const pw = 1500;
    const ph = 250;
    g.strokeStyle = '#26363a';
    g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      g.beginPath();
      g.moveTo(px, py + (k * ph) / 4);
      g.lineTo(px + pw, py + (k * ph) / 4);
      g.stroke();
    }
    const lo = 7.5;
    const hi = 10;
    const yOf = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph;
    g.strokeStyle = '#d95926';
    g.lineWidth = 5;
    g.beginPath();
    this.series.forEach((v, i) => {
      const x = px + (i / (this.series.length - 1)) * pw;
      if (i === 0) g.moveTo(x, yOf(v));
      else g.lineTo(x, yOf(v));
    });
    g.stroke();
    g.fillStyle = '#829093';
    g.font = '22px "IBM Plex Sans", sans-serif';
    g.fillText('Inflyatsiya, oylik dinamika (namuna)', px, py - 34);
    // pastki yuguruvchi satr
    const ticker =
      'BILIM → TAHLIL → QAROR  ·  Markaziy bank akademiyasi  ·  MPC simulyatsiyasi: Simulation Centre, 1-qavat  ·  Knowledge Centre 24/7  ·  ';
    g.fillStyle = '#152124';
    g.fillRect(0, 632, W, 68);
    g.fillStyle = '#d6a868';
    g.font = '500 28px "IBM Plex Sans", sans-serif';
    const tw = g.measureText(ticker).width;
    const off = (t * 90) % tw;
    g.fillText(ticker + ticker + ticker, -off, 650);
    this.tex.needsUpdate = true;
  }
  update(t: number) {
    if (Math.floor(t * 8) !== this.tick) {
      this.tick = Math.floor(t * 8);
      this.draw(t);
    }
  }
}

export function buildGrandHall(renderer: THREE.WebGLRenderer): InteriorBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d4ca);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  const m = getMaterials();
  const B = new GeoBuilder();
  const UV = { su: 1, sv: 1 };

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.22, metalness: 0.0, envMapIntensity: 1 });
  // pol
  B.box('floor', X0 - 1, X1 + 1, -0.3, 0, Z0 - 1, Z1 + 1, { su: 1, sv: 1 });
  // devorlar
  const wallT = 1.2;
  B.box('stone', X0 - wallT, X0, 0, HGT, Z0 - 1, Z1 + 1, UV); // g‘arb
  B.box('stone', X1, X1 + wallT, 0, HGT, Z0 - 1, Z1 + 1, UV); // sharq
  // shimol: Knowledge Centre portali (6 m balandlikda)
  B.box('stone', X0, X1, 0, 6, Z0 - wallT, Z0, UV);
  B.box('stone', X0, -8, 6, HGT, Z0 - wallT, Z0, UV);
  B.box('stone', 8, X1, 6, HGT, Z0 - wallT, Z0, UV);
  B.box('stone', -8, 8, 14.5, HGT, Z0 - wallT, Z0, UV);
  B.box('glassPlain', -8, 8, 6, 14.5, Z0 - 0.7, Z0 - 0.6, UV);
  B.box('bronze', -8.4, 8.4, 14.3, 14.7, Z0 - 0.2, Z0 + 0.2, UV);
  B.box('bronze', -8.4, -8, 6, 14.7, Z0 - 0.2, Z0 + 0.2, UV);
  B.box('bronze', 8, 8.4, 6, 14.7, Z0 - 0.2, Z0 + 0.2, UV);
  // janub: katta deraza (girih panjara)
  B.box('stone', X0, -14, 0, HGT, Z1, Z1 + wallT, UV);
  B.box('stone', 14, X1, 0, HGT, Z1, Z1 + wallT, UV);
  B.box('stone', -14, 14, 16, HGT, Z1, Z1 + wallT, UV);
  B.box('bronze', -14.3, 14.3, 15.8, 16.2, Z1 - 0.2, Z1 + 0.3, UV);
  // eshiklar (pastki qism)
  for (const x of [-9, 0, 9]) B.box('darkMetal', x - 2.2, x + 2.2, 0, 4.2, Z1 + 0.5, Z1 + 0.6, UV);
  // pilasterlar va tor derazalar (sharq/g‘arb)
  for (let z = Z0 + 3; z < Z1 - 2; z += 4.2) {
    B.box('stoneWarm', X0, X0 + 0.7, 0, HGT - 1, z - 0.6, z + 0.6, UV);
    B.box('stoneWarm', X1 - 0.7, X1, 0, HGT - 1, z - 0.6, z + 0.6, UV);
  }
  // shift: yog‘och kassetalar, markazda fonar teshigi
  const LX = 12;
  const LZ0 = 58;
  const LZ1 = 82;
  B.box('wood', X0, X1, HGT, HGT + 0.6, Z0 - 1, LZ0, UV);
  B.box('wood', X0, X1, HGT, HGT + 0.6, LZ1, Z1 + 1, UV);
  B.box('wood', X0, -LX, HGT, HGT + 0.6, LZ0, LZ1, UV);
  B.box('wood', LX, X1, HGT, HGT + 0.6, LZ0, LZ1, UV);
  for (let x = X0 + 4; x < X1; x += 4) B.box('stoneWarm', x - 0.25, x + 0.25, HGT - 1.2, HGT, Z0, Z1, UV);
  // fonar: shisha yon devorlar va bronza qovurg‘alar
  for (let x = -LX; x <= LX; x += 2) {
    B.box('bronze', x - 0.08, x + 0.08, HGT + 0.6, HGT + 5, LZ0, LZ0 + 0.2, UV);
    B.box('bronze', x - 0.08, x + 0.08, HGT + 0.6, HGT + 5, LZ1 - 0.2, LZ1, UV);
  }
  B.box('wood', -LX - 0.5, LX + 0.5, HGT + 5, HGT + 5.6, LZ0 - 0.5, LZ1 + 0.5, UV);

  // --- Knowledge Stair: markazda zina, yonlarida o‘tirish terrasalari ---
  const zBot = 78;
  const zTop = 60;
  const steps = 20;
  const sd = (zBot - zTop) / steps;
  for (let s = 0; s < steps; s++) {
    const y = (s + 1) * 0.3;
    const z = zBot - s * sd;
    B.box('stoneWarm', -5, 5, 0, y, z - sd, z, UV);
  }
  const tiers = 10;
  const td = (zBot - zTop) / tiers;
  for (let s = 0; s < tiers; s++) {
    const y = (s + 1) * 0.6;
    const z = zBot - s * td;
    B.box('stoneWarm', -13, -5, 0, y - 0.08, z - td, z, UV);
    B.box('stoneWarm', 5, 13, 0, y - 0.08, z - td, z, UV);
    B.box('wood', -13, -5.2, y - 0.08, y, z - td, z - td * 0.35, UV);
    B.box('wood', 5.2, 13, y - 0.08, y, z - td, z - td * 0.35, UV);
  }
  // mezzanina (6 m)
  B.box('stoneWarm', X0, X1, 0, 6, Z0, zTop, UV);
  // balyustrada
  B.box('glassPlain', X0, -5, 6, 7.1, zTop - 0.05, zTop + 0.05, UV);
  B.box('glassPlain', 5, X1, 6, 7.1, zTop - 0.05, zTop + 0.05, UV);
  B.box('bronze', X0, -5, 7.05, 7.15, zTop - 0.08, zTop + 0.08, UV);
  B.box('bronze', 5, X1, 7.05, 7.15, zTop - 0.08, zTop + 0.08, UV);
  // turniketlar (Ring 1 → 2)
  for (let x = -4.5; x <= 4.6; x += 1.5) B.box('bronze', x - 0.12, x + 0.12, 6, 7.0, zTop - 1.6, zTop - 0.6, UV);

  // --- vitrinalar (g‘arbiy devor bo‘ylab) ---
  for (let k = 0; k < 5; k++) {
    const z = 64 + k * 4.4;
    B.box('stoneDark', X0 + 1.5, X0 + 3.3, 0, 0.95, z - 0.9, z + 0.9, UV);
    B.box('glassPlain', X0 + 1.55, X0 + 3.25, 0.95, 1.9, z - 0.85, z + 0.85, UV);
    B.box('lamp', X0 + 1.9, X0 + 2.9, 0.96, 1.0, z - 0.5, z + 0.5, UV);
  }
  // reception va ma’lumot stoli
  B.box('stone', 13, 22, 0, 1.1, 81.5, 83.2, UV);
  B.box('bronze', 13, 22, 0.15, 1.0, 83.2, 83.3, UV);
  B.box('stone', -22, -13, 0, 1.1, 81.5, 83.2, UV);
  B.box('bronze', -22, -13, 0.15, 1.0, 83.2, 83.3, UV);
  // dam olish o‘rindiqlari (digital wall qarshisida)
  for (const z of [65, 70.5, 76]) {
    B.box('fabric', 16, 19, 0, 0.45, z - 1.6, z + 1.6, UV);
    B.box('fabric', 18.6, 19, 0.45, 0.9, z - 1.6, z + 1.6, UV);
  }
  // xona o‘simliklari
  for (const [x, z] of [[-22, 56], [22, 56], [-22, 86], [22, 86]]) {
    B.box('stoneDark', x - 1, x + 1, z < 60 ? 6 : 0, (z < 60 ? 6 : 0) + 0.8, z - 1, z + 1, UV);
  }

  const mats = { ...(m as unknown as Record<string, THREE.Material>), floor: floorMat };
  const built = B.build(mats);
  built.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(built);

  // o‘simliklar
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x5b8a3c, roughness: 0.9 });
  for (const [x, z] of [[-22, 56], [22, 56], [-22, 86], [22, 86]]) {
    const y0 = z < 60 ? 6.8 : 0.8;
    const t = new THREE.Mesh(crown, leaf);
    t.scale.set(1.3, 1.8, 1.3);
    t.position.set(x, y0 + 1.8, z);
    t.castShadow = true;
    scene.add(t);
  }

  // pol inkrustatsiyasi
  const inlay = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({ map: inlayTexture(), transparent: true, roughness: 0.3, metalness: 0.5 }),
  );
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(0, 0.01, 83.5);
  inlay.receiveShadow = true;
  scene.add(inlay);

  // janubiy deraza: shisha + girih panjara (soyasi polga tushadi)
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 16),
    new THREE.MeshStandardMaterial({ color: 0xbfd6df, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2 }),
  );
  win.position.set(0, 8, Z1 + 0.6);
  win.rotation.y = Math.PI;
  scene.add(win);
  const scrGeo = new THREE.PlaneGeometry(28, 16);
  const uv = scrGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (28 / 2.4), uv.getY(i) * (16 / 2.4));
  const scr = new THREE.Mesh(scrGeo, m.screen);
  scr.position.set(0, 8, Z1 - 0.1);
  scr.castShadow = true;
  scene.add(scr);

  // yozuv: BILIM → TAHLIL → QAROR
  const motto = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 2.6),
    new THREE.MeshStandardMaterial({
      map: textTexture('BILIM  →  TAHLIL  →  QAROR', { w: 2048, h: 180, color: '#b58a4c', spacing: 0.18 }),
      transparent: true, metalness: 0.75, roughness: 0.3,
    }),
  );
  motto.position.set(0, 16.8, Z0 + 0.05);
  scene.add(motto);
  const kc = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.9),
    new THREE.MeshStandardMaterial({ map: textTexture('KNOWLEDGE CENTRE', { w: 1024, h: 90, color: '#b58a4c' }), transparent: true, metalness: 0.7, roughness: 0.35 }),
  );
  kc.position.set(0, 15.4, Z0 + 0.25);
  scene.add(kc);
  const hist = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 1.1),
    new THREE.MeshStandardMaterial({ map: textTexture('O‘ZBEKISTON PULI VA MARKAZIY BANK TARIXI', { w: 2048, h: 120, color: '#9a7444' }), transparent: true, roughness: 0.5 }),
  );
  hist.position.set(X0 + 0.75, 4.2, 73);
  hist.rotation.y = Math.PI / 2;
  scene.add(hist);

  // digital wall (sharqiy devor)
  const dw = new DigitalWall();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshBasicMaterial({ map: dw.tex, toneMapped: false }));
  wall.position.set(X1 - 0.75, 7, 70.5);
  wall.rotation.y = -Math.PI / 2;
  scene.add(wall);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.6, 16.6), m.darkMetal);
  frame.position.set(X1 - 0.6, 7, 70.5);
  scene.add(frame);

  // fonar osmoni
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xeaf3fb, toneMapped: false }));
  sky.rotation.x = Math.PI / 2;
  sky.position.set(0, HGT + 4.9, 70);
  scene.add(sky);

  // odamlar (statik)
  const r = rng(31);
  const pg = new THREE.CapsuleGeometry(0.25, 1.1, 3, 8);
  pg.translate(0, 0.8, 0);
  const pcols = [0x2d3a40, 0x5c4a3d, 0x7a8a90, 0x1d5b75, 0x8f6230, 0x3f4a2f, 0xb8b0a0];
  const pg2 = pg.clone().scale(0.85, 0.95, 0.85);
  const pm = new THREE.InstancedMesh(pg2, new THREE.MeshStandardMaterial({ roughness: 0.7 }), 46);
  const mx = new THREE.Matrix4();
  for (let i = 0; i < 46; i++) {
    let x: number;
    let z: number;
    let y = 0;
    const zone = r();
    if (zone < 0.35) {
      // Knowledge Stair terrasalarida o‘tirganlar
      const tier = Math.floor(r() * 9);
      x = (r() > 0.5 ? 1 : -1) * (6 + r() * 6.5);
      z = zBot - tier * td - td * 0.6;
      y = (tier + 1) * 0.6 - 0.35;
    } else if (zone < 0.5) {
      x = -3 + r() * 6;
      const s = Math.floor(r() * 18);
      z = zBot - s * sd - sd / 2;
      y = (s + 1) * 0.3;
    } else {
      x = -21 + r() * 42;
      z = 62 + r() * 22;
      if (Math.abs(x) < 14 && z < 79) z = 79.5 + r() * 4;
      if (Math.abs(x) < 6) x += x < 0 ? -6 : 6; // kirish o‘qini ochiq qoldiramiz
    }
    mx.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    pm.setMatrixAt(i, mx);
    pm.setColorAt(i, new THREE.Color(pcols[Math.floor(r() * pcols.length)]));
  }
  pm.castShadow = true;
  scene.add(pm);

  // yorug‘lik
  scene.add(new THREE.HemisphereLight(0xf3efe6, 0x8c7f6a, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sun.position.set(14, 34, 128);
  sun.target.position.set(0, 0, 72);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 5; sc.far = 140;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const top = new THREE.DirectionalLight(0xeef5ff, 1.6);
  top.position.set(2, 60, 72);
  top.target.position.set(0, 0, 70);
  top.castShadow = true;
  top.shadow.mapSize.set(1024, 1024);
  const tc = top.shadow.camera;
  tc.left = -32; tc.right = 32; tc.top = 32; tc.bottom = -32; tc.near = 10; tc.far = 80;
  top.shadow.bias = -0.0005;
  scene.add(top, top.target);
  const warm = new THREE.PointLight(0xffd29a, 40, 30, 1.6);
  warm.position.set(-20, 4, 73);
  scene.add(warm);

  return {
    scene,
    start: { pos: new THREE.Vector3(-3, 3.4, 88), target: new THREE.Vector3(0, 8, 62) },
    bounds: { x0: X0 + 0.6, x1: X1 - 0.6, y0: 0.8, y1: HGT - 1, z0: Z0 + 0.6, z1: Z1 - 0.4 },
    update: (_dt, t) => dw.update(t),
  };
}
