// Osmon, quyosh, yorug‘lik, tuman, uzoqdagi tog‘lar, yulduzlar.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { getMaterials, rng } from './materials';
import { sunPosition, type SunState } from './sun';

export interface EnvState {
  sun: SunState;
  /** 0 — kunduz, 1 — to‘liq tun. */
  night: number;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export class Environment {
  readonly sky: Sky;
  readonly sunLight: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly moon: THREE.DirectionalLight;
  readonly stars: THREE.Points;
  state: EnvState;
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envMat: THREE.ShaderMaterial;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private lastEnvKey = '';
  private fog: THREE.FogExp2;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    shadowSize: number,
  ) {
    this.sky = new Sky();
    this.sky.scale.setScalar(18000);
    scene.add(this.sky);

    // Atrof-muhit xaritasi: boshqariladigan gradient (Sky shader’i HDR qiymatlari juda yorqin)
    this.envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        bottom: { value: new THREE.Color() },
        sunColor: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.35));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 6.0) * 0.6 + pow(s, 64.0) * 1.5);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.envMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);

    const su = this.sky.material.uniforms;
    su['turbidity'].value = 5.5;
    su['rayleigh'].value = 1.4;
    su['mieCoefficient'].value = 0.004;
    su['mieDirectionalG'].value = 0.8;
    su['cloudCoverage'].value = 0.0;

    this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sunLight.shadow.camera;
    cam.left = -235;
    cam.right = 235;
    cam.top = 235;
    cam.bottom = -235;
    cam.near = 10;
    cam.far = 1400;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.35;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.moon = new THREE.DirectionalLight(0x9fb4ff, 0);
    this.moon.position.set(-300, 500, -200);
    scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0xdfe9f5, 0x9c8f72, 0.15);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0xc9d6e0, 0.00011);
    scene.fog = this.fog;

    this.stars = this.makeStars();
    scene.add(this.stars);

    scene.add(this.makeGround());
    scene.add(this.makeMountains());

    this.state = { sun: sunPosition(172, 12), night: 0 };
  }

  private makeStars(): THREE.Points {
    const r = rng(404);
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r();
      const v = r() * 0.95 + 0.05;
      const th = u * Math.PI * 2;
      const ph = Math.acos(1 - v); // faqat yuqori yarim shar
      const R = 12000;
      pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = R * Math.cos(ph);
      pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }

  private makeGround(): THREE.Object3D {
    const m = getMaterials();
    const g = new THREE.PlaneGeometry(9000, 9000);
    g.rotateX(-Math.PI / 2);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 150, uv.getY(i) * 150);
    const mesh = new THREE.Mesh(g, m.ground);
    mesh.position.y = -0.05;
    mesh.receiveShadow = true;
    mesh.name = 'context-ground';
    return mesh;
  }

  /** Shimoli-sharqdagi tog‘ tizmasi (G‘arbiy Tyan-Shan etaklari, ~7–10 km). */
  private makeMountains(): THREE.Object3D {
    const m = getMaterials();
    const r = rng(1234);
    const seg = 90;
    const pos: number[] = [];
    const idx: number[] = [];
    const rows = 4;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= seg; i++) {
        const a = (-10 + (i / seg) * 110) * (Math.PI / 180); // azimut 350°..100°
        const dist = 7500 + j * 900;
        const ridge =
          Math.max(0, Math.sin(i * 0.21) * 0.5 + Math.sin(i * 0.067 + 1) * 0.8 + Math.sin(i * 0.53) * 0.25 + 0.7);
        const h = j === 0 ? 0 : (300 + ridge * 650 + r() * 120) * (j / rows) ** 0.6 * (0.6 + 0.4 * Math.sin((i / seg) * Math.PI));
        pos.push(Math.sin(a) * dist, h - 20, -Math.cos(a) * dist);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i;
        const b = a + 1;
        const c = a + seg + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m.mountain);
    mesh.name = 'mountains';
    return mesh;
  }

  update(doy: number, hours: number) {
    const sun = sunPosition(doy, hours);
    const alt = sun.altitude;
    const night = smooth(3, -8, alt);
    this.state = { sun, night };

    const dir = sun.dir;
    const skyDir = dir.clone();
    if (skyDir.y < -0.25) skyDir.y = -0.25;
    this.sky.material.uniforms['sunPosition'].value.copy(skyDir);
    const day = smooth(-2, 8, alt);
    const low = 1 - smooth(5, 35, alt);
    const eu = this.envMat.uniforms;
    const dusk = low * day;
    (eu.top.value as THREE.Color).setRGB(0.22, 0.42, 0.78).lerp(new THREE.Color(0.2, 0.25, 0.45), dusk).lerp(new THREE.Color(0.01, 0.015, 0.04), night);
    (eu.horizon.value as THREE.Color).setRGB(0.78, 0.84, 0.9).lerp(new THREE.Color(0.95, 0.62, 0.4), dusk).lerp(new THREE.Color(0.03, 0.04, 0.08), night);
    (eu.bottom.value as THREE.Color).setRGB(0.36, 0.33, 0.27).lerp(new THREE.Color(0.02, 0.02, 0.025), night);
    (eu.sunColor.value as THREE.Color).setRGB(1, 0.92, 0.8).multiplyScalar(day * (1 - 0.4 * low));
    (eu.sunDir.value as THREE.Vector3).copy(dir);

    // quyosh nuri
    const sc = new THREE.Color(1, 0.97, 0.92).lerp(new THREE.Color(1, 0.62, 0.36), low * 0.9);
    this.sunLight.color.copy(sc);
    this.sunLight.intensity = 2.7 * day;
    this.sunLight.castShadow = alt > -1;
    this.sunLight.position.copy(dir.clone().multiplyScalar(600));
    this.sunLight.target.position.set(0, 0, 0);

    this.hemi.intensity = 0.25 * night + 0.12 * day;
    this.hemi.color.set(0xdfe9f5).lerp(new THREE.Color(0x26324d), night);
    this.hemi.groundColor.set(0x9c8f72).lerp(new THREE.Color(0x1b1a20), night);
    this.moon.intensity = 0.35 * night;

    (this.stars.material as THREE.PointsMaterial).opacity = night * 0.9;

    const fogDay = new THREE.Color(0xc8d5df).lerp(new THREE.Color(0xe8c9a8), low * 0.6 * day);
    this.fog.color.copy(fogDay.lerp(new THREE.Color(0x0b1020), night));

    this.renderer.toneMappingExposure = 0.8 - 0.08 * low * day + 0.2 * night;

    const m = getMaterials();
    for (const e of m.nightEmissive) e.mat.emissiveIntensity = e.max * smooth(4, -4, alt);

    this.updateEnvMap(alt, sun.azimuth);
  }

  private updateEnvMap(alt: number, az: number) {
    const key = `${Math.round(alt / 3)}:${Math.round(az / 8)}`;
    if (key === this.lastEnvKey) return;
    this.lastEnvKey = key;
    const rt = this.pmrem.fromScene(this.envScene, 0.02);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.6 + 0.6 * smooth(-6, 10, alt);
  }
}
