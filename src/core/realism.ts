// «Realistik» rejim: maketning o‘zini real vaqtda fotorealistikka yaqinlashtiradi.
//  - fotoskanerlangan PBR teksturalar (Poly Haven, CC0): rang, normal, AO va g‘adir-budurlik;
//  - daraxt tojlari barg to‘dasi rasmli kartochkalardan (Blender’da render qilingan sprayt);
//  - ambient occlusion (N8AO), AgX rang boshqaruvi, kechasi yorug‘lik yoyilishi (bloom), SMAA;
//  - kamera atrofiga moslashadigan yumshoq soyalar.
// Hamma narsa qaytariladi: rejim o‘chirilsa, maket asl holiga qaytadi.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { N8AOPass } from 'n8ao';
import type { App } from '../app';
import { getMaterials, rng, type Materials } from './materials';

const TEX_BASE = 'tex/';

interface PbrSpec {
  tex: string;
  /** Teksturaning haqiqiy o‘lchami, m. */
  size: number;
  /** Geometriyada 1 UV birligi necha metr (GeoBuilder’da 1 m). */
  uvUnit?: number;
  /** Aniq takrorlanish (silindr UV’lari uchun). */
  repeat?: [number, number];
  /** Chiziqli rang ko‘paytmasi: teksturaning o‘rtacha rangini maket palitrasiga (real albedo) keltiradi. */
  tint?: [number, number, number];
  normal?: number;
  antiTile?: boolean;
}

type MatKey = { [K in keyof Materials]: Materials[K] extends THREE.MeshStandardMaterial ? K : never }[keyof Materials];

// tint — scripts/fetch_textures.py bilan olingan teksturalarning o‘rtacha chiziqli rangidan hisoblangan
const PBR: Partial<Record<MatKey, PbrSpec>> = {
  stone: { tex: 'stone', size: 3, tint: [1.45, 1.7, 2.19] },
  stoneWarm: { tex: 'stone', size: 3, tint: [1.53, 1.66, 1.87] },
  stoneDark: { tex: 'stone', size: 3, tint: [0.95, 1.05, 1.3] },
  paving: { tex: 'paving', size: 3, tint: [1.6, 1.62, 1.7] },
  pavingWarm: { tex: 'pavingWarm', size: 2.15, tint: [0.95, 1.45, 2.28] },
  asphalt: { tex: 'asphalt', size: 2.1, tint: [1.22, 1.27, 1.34] },
  grass: { tex: 'grass', size: 2.5, tint: [0.95, 2.14, 1.21], antiTile: true },
  roof: { tex: 'roof', size: 2.1, tint: [0.91, 1.13, 1.35] },
  wood: { tex: 'wood', size: 0.6, tint: [5.0, 4.76, 3.86] },
  trunk: { tex: 'bark', size: 1, repeat: [1, 5], tint: [1.23, 1.15, 1.34], normal: 1.4 },
};

/** Teksturasiz, faqat rangi o‘zgaradigan materiallar (atrofdagi yer — xira bo‘lmasin). */
const TINT_ONLY: Partial<Record<MatKey, [number, number, number]>> = {
  ground: [0.72, 0.74, 0.62],
  context: [0.86, 0.85, 0.82],
};

const ANTI_TILE = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  vec4 sampled2 = texture2D( map, vMapUv * -0.37 + vec2( 0.23, 0.61 ) );
  float macro = texture2D( map, vMapUv * 0.041 + vec2( 0.5 ) ).g;
  sampledDiffuseColor = mix( sampledDiffuseColor, sampled2, 0.5 );
  sampledDiffuseColor.rgb *= 0.8 + 0.4 * smoothstep( 0.15, 0.55, macro );
  diffuseColor *= sampledDiffuseColor;
#endif
`;

interface Saved {
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  color: THREE.Color;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  normalScale: THREE.Vector2;
  onBeforeCompile: THREE.Material['onBeforeCompile'];
  customProgramCacheKey: THREE.Material['customProgramCacheKey'];
}

/** AgX’ning bazaviy kontrasti tekis — Blender’dagi «Medium High Contrast» ga yaqinlashtirish. */
const GRADE = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.14 }, saturation: { value: 1.15 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      float l = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
      c.rgb = mix( vec3( l ), c.rgb, saturation );
      c.rgb = ( c.rgb - 0.5 ) * contrast + 0.5;
      gl_FragColor = vec4( clamp( c.rgb, 0.0, 1.0 ), c.a );
    }`,
};

// ---------------------------------------------------------------- barg kartochkalari
/** Birlik tojdagi kartochkalar bulut: markaz (position), burchak siljishi (cardOffset), «sharsimon» normal. */
function cardCloud(count: number, seed: number, shell = 0.55): THREE.BufferGeometry {
  const r = rng(seed);
  const pos: number[] = [];
  const off: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    // yo‘nalish — sferada tekis; radius — tashqi qobiqqa yaqinroq
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    d.set(s * Math.cos(a), u, s * Math.sin(a));
    const rad = shell + (1 - shell) * Math.sqrt(r());
    const c = d.clone().multiplyScalar(rad);
    if (c.y < -0.3) c.y *= 0.8;
    // kartochka asosan tashqariga qaraydi, lekin tasodifiy og‘ish bilan
    n.copy(d).add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6)).normalize();
    t.crossVectors(Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, n).normalize();
    b.crossVectors(n, t);
    const roll = r() * Math.PI * 2;
    const tr = t.clone().multiplyScalar(Math.cos(roll)).addScaledVector(b, Math.sin(roll));
    const br = new THREE.Vector3().crossVectors(n, tr);
    // yorug‘lik uchun normal: tojning markazidan tashqariga (hajmli soya), biroz kartochkaniki
    const sn = n.clone().multiplyScalar(0.35).addScaledVector(d, 0.65).normalize();
    const base = pos.length / 3;
    const flip = r() > 0.5;
    for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      pos.push(c.x, c.y, c.z);
      const o = tr.clone().multiplyScalar(cx).addScaledVector(br, cy);
      off.push(o.x, o.y, o.z);
      nor.push(sn.x, sn.y, sn.z);
      uv.push(flip ? 0.5 - cx : cx + 0.5, cy + 0.5);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('cardOffset', new THREE.Float32BufferAttribute(off, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.8);
  return g;
}

/** Birlik toj ichidagi shoxlar: tana uchidan tashqariga va yuqoriga. */
function branchGeometry(seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.Vector3(0, -0.42, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r() * 0.6;
    const tip = new THREE.Vector3(Math.cos(a) * (0.5 + r() * 0.3), -0.1 + r() * 0.55, Math.sin(a) * (0.5 + r() * 0.3));
    const dir = tip.clone().sub(base);
    const len = dir.length();
    const c = new THREE.CylinderGeometry(0.012, 0.03, len, 5, 1, true);
    c.translate(0, len / 2, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    c.translate(base.x, base.y, base.z);
    parts.push(c);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Kartochka o‘lchamini teralik (instance) masshtabidan mustaqil qiladi — tor teraklarda ham barg cho‘zilmaydi. */
function patchCards(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 cardOffset;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 instScale = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
      #else
        vec3 instScale = vec3( 1.0 );
      #endif
      float cardSize = clamp( 0.62 * sqrt( min( instScale.x, instScale.z ) ), 0.55, 1.7 );
      transformed += cardOffset * cardSize / instScale;`,
    );
}

// ---------------------------------------------------------------- asosiy sinf
export class Realism {
  enabled = false;
  onChange: ((on: boolean) => void) | null = null;
  private loader = new THREE.TextureLoader();
  private images = new Map<string, Promise<THREE.Texture | null>>();
  private saved = new Map<THREE.MeshStandardMaterial, Saved>();
  private composer: EffectComposer | null = null;
  private aoPass: N8AOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private smaa: SMAAPass | null = null;
  private trees: {
    mesh: THREE.InstancedMesh;
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    depth: THREE.Material | undefined;
    cards: THREE.BufferGeometry;
  }[] = [];
  private leafMat: THREE.MeshStandardMaterial | null = null;
  private leafDepth: THREE.MeshDepthMaterial | null = null;
  private branches: THREE.InstancedMesh | null = null;
  private baseToneMapping: THREE.ToneMapping;
  private basePixelRatio: number;
  private quality = 0;
  private perf = { frames: 0, time: 0, cooldown: 3 };
  private tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), f: new THREE.Vector3() };

  constructor(private app: App) {
    this.baseToneMapping = app.renderer.toneMapping;
    this.basePixelRatio = app.renderer.getPixelRatio();
    app.onFrame((dt) => this.frame(dt));
    app.resizeListeners.push((w, h) => this.resize(w, h));
  }

  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.enable();
    else this.disable();
    this.onChange?.(on);
  }

  // ---------------------------------------------------------------- yoqish / o‘chirish
  private enable() {
    const { app } = this;
    const r = app.renderer;
    r.toneMapping = THREE.AgXToneMapping;
    app.env.exposureScale = 1.0;
    app.env.sunLight.shadow.radius = 3;
    this.upgradeMaterials();
    this.upgradeTrees();
    this.setupPost();
    app.renderHook = (dt) => this.render(dt);
    app.setTime(app.doy, app.hours);
  }

  private disable() {
    const { app } = this;
    app.renderHook = null;
    app.renderer.toneMapping = this.baseToneMapping;
    app.renderer.setPixelRatio(this.basePixelRatio);
    app.env.exposureScale = 1;
    const sh = app.env.sunLight.shadow;
    sh.radius = 1;
    const cam = sh.camera;
    cam.left = cam.bottom = -235;
    cam.right = cam.top = 235;
    cam.updateProjectionMatrix();
    this.restoreMaterials();
    this.restoreTrees();
    this.quality = 0;
    app.setTime(app.doy, app.hours);
  }

  // ---------------------------------------------------------------- teksturalar
  private image(file: string, srgb: boolean): Promise<THREE.Texture | null> {
    const key = file;
    let p = this.images.get(key);
    if (!p) {
      p = new Promise((resolve) => {
        this.loader.load(
          TEX_BASE + file,
          (t) => {
            t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = Math.min(8, this.app.renderer.capabilities.getMaxAnisotropy());
            resolve(t);
          },
          undefined,
          () => resolve(null), // fayl yo‘q (masalan, bitta HTML nusxa) — protsedural tekstura qoladi
        );
      });
      this.images.set(key, p);
    }
    return p;
  }

  private async pbr(spec: PbrSpec): Promise<{ map: THREE.Texture; normal: THREE.Texture | null; arm: THREE.Texture | null } | null> {
    const [d, n, a] = await Promise.all([
      this.image(`${spec.tex}_diff.jpg`, true),
      this.image(`${spec.tex}_nor.jpg`, false),
      this.image(`${spec.tex}_arm.jpg`, false),
    ]);
    if (!d) return null;
    const rep = spec.repeat ?? [(spec.uvUnit ?? 1) / spec.size, (spec.uvUnit ?? 1) / spec.size];
    const set = (t: THREE.Texture | null) => {
      if (!t) return null;
      const c = t.clone();
      c.repeat.set(rep[0], rep[1]);
      c.needsUpdate = true;
      return c;
    };
    return { map: set(d)!, normal: set(n), arm: set(a) };
  }

  private snapshot(mat: THREE.MeshStandardMaterial): Saved {
    return {
      map: mat.map,
      normalMap: mat.normalMap,
      aoMap: mat.aoMap,
      roughnessMap: mat.roughnessMap,
      color: mat.color.clone(),
      roughness: mat.roughness,
      metalness: mat.metalness,
      envMapIntensity: mat.envMapIntensity,
      normalScale: mat.normalScale.clone(),
      onBeforeCompile: mat.onBeforeCompile,
      customProgramCacheKey: mat.customProgramCacheKey,
    };
  }

  private upgradeMaterials() {
    const m = getMaterials();
    for (const [key, spec] of Object.entries(PBR) as [MatKey, PbrSpec][]) {
      const mat = m[key];
      if (!this.saved.has(mat)) this.saved.set(mat, this.snapshot(mat));
      void this.pbr(spec).then((t) => {
        if (!t || !this.enabled) return;
        mat.map = t.map;
        mat.normalMap = t.normal;
        mat.normalScale.setScalar(spec.normal ?? 1);
        mat.aoMap = t.arm;
        mat.aoMapIntensity = 1;
        mat.roughnessMap = t.arm;
        mat.roughness = 1;
        mat.metalness = 0;
        if (spec.tint) mat.color.setRGB(...spec.tint);
        if (spec.antiTile) {
          mat.onBeforeCompile = (sh) => {
            sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', ANTI_TILE);
          };
          mat.customProgramCacheKey = () => 'antitile';
        }
        mat.needsUpdate = true;
      });
    }
    for (const [key, tint] of Object.entries(TINT_ONLY) as [MatKey, [number, number, number]][]) {
      const mat = m[key];
      if (!this.saved.has(mat)) this.saved.set(mat, this.snapshot(mat));
      mat.color.multiply(new THREE.Color().setRGB(...tint));
    }
    // shisha va suv: aniqroq aks
    for (const [mat, rough, env] of [[m.glass, 0.04, 1.5], [m.glassPlain, 0.03, 1.6], [m.water, 0.02, 1.2]] as const) {
      if (!this.saved.has(mat)) this.saved.set(mat, this.snapshot(mat));
      mat.roughness = rough;
      mat.envMapIntensity = env;
    }
  }

  private restoreMaterials() {
    for (const [mat, s] of this.saved) {
      mat.map = s.map;
      mat.normalMap = s.normalMap;
      mat.aoMap = s.aoMap;
      mat.roughnessMap = s.roughnessMap;
      mat.color.copy(s.color);
      mat.roughness = s.roughness;
      mat.metalness = s.metalness;
      mat.envMapIntensity = s.envMapIntensity;
      mat.normalScale.copy(s.normalScale);
      mat.onBeforeCompile = s.onBeforeCompile;
      mat.customProgramCacheKey = s.customProgramCacheKey;
      mat.needsUpdate = true;
    }
    this.saved.clear();
  }

  // ---------------------------------------------------------------- daraxtlar
  private upgradeTrees() {
    const inst = this.app.campus.getObjectByName('instanced');
    if (!inst) return;
    if (!this.leafMat) {
      const leafMat = new THREE.MeshStandardMaterial({
        name: 'leafCards',
        color: 0xffffff,
        roughness: 0.75,
        metalness: 0,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
      });
      leafMat.onBeforeCompile = (sh) => {
        patchCards(sh);
        // teralik rangi (tur va tus) spraytning o‘z rangini to‘liq bosmasin
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <color_fragment>',
          `#if defined( USE_COLOR )
            diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb * 1.9, 0.6 );
          #endif`,
        );
      };
      leafMat.customProgramCacheKey = () => 'leafCards';
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.45 });
      depth.onBeforeCompile = (sh) => patchCards(sh);
      depth.customProgramCacheKey = () => 'leafCardsDepth';
      this.leafMat = leafMat;
      this.leafDepth = depth;
    }
    // sprayt yuklanmasa (masalan, teksturasiz bitta HTML nusxa) maket daraxtlari qoladi
    void this.image('leaves.png', true).then((t) => {
      if (!t || !this.enabled || this.trees.length) return;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      const leafMat = this.leafMat!;
      const depth = this.leafDepth!;
      if (leafMat.map !== t) {
        leafMat.map = t;
        depth.map = t;
        leafMat.needsUpdate = depth.needsUpdate = true;
      }
      this.swapTrees(inst);
    });
  }

  private swapTrees(inst: THREE.Object3D) {
    const swap = (name: string, cards: THREE.BufferGeometry) => {
      const mesh = inst.getObjectByName(name) as THREE.InstancedMesh | undefined;
      if (!mesh) return null;
      this.trees.push({ mesh, geometry: mesh.geometry, material: mesh.material, depth: mesh.customDepthMaterial, cards });
      mesh.geometry = cards;
      mesh.material = this.leafMat!;
      mesh.customDepthMaterial = this.leafDepth!;
      mesh.computeBoundingSphere();
      return mesh;
    };
    const crown = swap('crown', cardCloud(230, 11));
    swap('shrub', cardCloud(40, 23, 0.4));
    // shoxlar: toj bilan bir xil matritsalar, po‘stloq materiali
    if (crown) {
      const br = new THREE.InstancedMesh(branchGeometry(5), getMaterials().trunk, crown.count);
      br.instanceMatrix.copy(crown.instanceMatrix);
      br.instanceMatrix.needsUpdate = true;
      br.castShadow = true;
      br.receiveShadow = true;
      br.name = 'branches';
      br.computeBoundingSphere();
      inst.add(br);
      this.branches = br;
    }
  }

  private restoreTrees() {
    for (const t of this.trees) {
      t.mesh.geometry = t.geometry;
      t.mesh.material = t.material;
      t.mesh.customDepthMaterial = t.depth;
      t.mesh.computeBoundingSphere();
      t.cards.dispose();
    }
    this.trees = [];
    if (this.branches) {
      this.branches.removeFromParent();
      this.branches.geometry.dispose();
      this.branches.dispose();
      this.branches = null;
    }
  }

  // ---------------------------------------------------------------- post-processing
  private setupPost() {
    if (this.composer) return;
    const { renderer, scene, camera } = this.app;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const composer = new EffectComposer(renderer);
    const ao = new N8AOPass(scene, camera, size.x, size.y);
    const c = ao.configuration;
    c.aoRadius = 4;
    c.distanceFalloff = 1;
    c.intensity = 2.2;
    c.gammaCorrection = false;
    ao.setQualityMode('Medium');
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.35, 2.2);
    bloom.enabled = false;
    const smaa = new SMAAPass();
    composer.addPass(ao);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GRADE));
    composer.addPass(smaa);
    this.composer = composer;
    this.aoPass = ao;
    this.bloom = bloom;
    this.smaa = smaa;
  }

  private resize(w: number, h: number) {
    this.composer?.setPixelRatio(this.app.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
  }

  private render(dt: number): boolean {
    if (!this.enabled || !this.composer || !this.aoPass) return false;
    const { app } = this;
    // AO radiusi kamera masofasiga moslashadi: yaqinda mayda tutashuvlar, uzoqda binolar orasi
    const dist = app.camera.position.distanceTo(app.controls.target);
    const radius = THREE.MathUtils.clamp(dist * 0.012, 1.2, 6);
    if (Math.abs(this.aoPass.configuration.aoRadius - radius) > 0.25) this.aoPass.configuration.aoRadius = radius;
    if (this.bloom) {
      const night = app.env.state.night;
      this.bloom.enabled = night > 0.25;
      this.bloom.strength = 0.15 + 0.25 * night;
    }
    this.composer.render(dt);
    return true;
  }

  // ---------------------------------------------------------------- har kadr: soya va unumdorlik
  private frame(dt: number) {
    if (!this.enabled) return;
    // interyerlar maket rang boshqaruvi (ACES) bilan sozlangan
    const main = this.app.activeScene === this.app.scene;
    const tm = main ? THREE.AgXToneMapping : this.baseToneMapping;
    if (this.app.renderer.toneMapping !== tm) this.app.renderer.toneMapping = tm;
    if (!main) return;
    this.fitShadow();
    this.adapt(dt);
  }

  /** Soya kamerasini ko‘rinayotgan joyga yaqinlashtiradi: yaqin kadrlarda soyalar tiniqroq. */
  private fitShadow() {
    const { app } = this;
    const env = app.env;
    const light = env.sunLight;
    if (!light.castShadow) return;
    const cam = app.camera;
    const { v, w, f } = this.tmp;
    cam.getWorldDirection(f);
    const dist = cam.position.distanceTo(app.controls.target);
    const walking = !app.controls.enabled;
    const span = walking ? 70 : dist * 0.95;
    // yarim o‘lchamni pog‘onalab o‘zgartiramiz — har kadr qayta hisoblanib, soya «titramasin»
    const half = Math.min(235, Math.max(45, 45 * Math.pow(1.25, Math.ceil(Math.log(Math.max(span, 45) / 45) / Math.log(1.25)))));
    // markaz: yurganda — oldinga; aylanishda — nishon nuqta
    if (walking) v.copy(cam.position).addScaledVector(f.setY(0).normalize(), half * 0.45);
    else v.copy(app.controls.target);
    v.y = 0;
    // yorug‘lik fazosida tekstura katagiga moslab siljitish (soya chetlari sirpanmasin)
    const dir = env.state.sun.dir;
    const right = w.set(-dir.z, 0, dir.x);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const upL = new THREE.Vector3().crossVectors(dir, right).normalize();
    const texel = (2 * half) / light.shadow.mapSize.x;
    const pr = Math.round(v.dot(right) / texel) * texel;
    const pu = Math.round(v.dot(upL) / texel) * texel;
    const pd = v.dot(dir);
    v.copy(right).multiplyScalar(pr).addScaledVector(upL, pu).addScaledVector(dir, pd);
    light.target.position.copy(v);
    light.position.copy(v).addScaledVector(dir, 600);
    const sc = light.shadow.camera;
    if (sc.right !== half) {
      sc.left = sc.bottom = -half;
      sc.right = sc.top = half;
      sc.updateProjectionMatrix();
    }
    light.target.updateMatrixWorld();
  }

  /** Kadr tezligi past bo‘lsa, sifatni pog‘onama-pog‘ona pasaytiradi. */
  private adapt(dt: number) {
    if (navigator.webdriver) return; // avtomatik skrinshotlarda (sekin dasturiy GPU) to‘liq sifat
    const p = this.perf;
    p.frames++;
    p.time += dt;
    if (p.time < 2) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (p.cooldown > 0) {
      p.cooldown--;
      return;
    }
    if (fps >= 30 || this.quality >= 3) return;
    this.quality++;
    p.cooldown = 2;
    const r = this.app.renderer;
    if (this.quality === 1 && r.getPixelRatio() > 1) {
      r.setPixelRatio(1);
      this.app.resize();
    } else if (this.quality <= 2 && this.aoPass) {
      this.aoPass.configuration.halfRes = true;
      this.aoPass.setQualityMode('Performance');
      this.quality = Math.max(this.quality, 2);
    } else if (this.smaa) {
      this.smaa.enabled = false;
      this.app.env.sunLight.shadow.radius = 1;
    }
  }
}
