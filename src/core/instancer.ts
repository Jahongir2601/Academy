// Takrorlanuvchi obyektlar (daraxtlar, panellar, chiroqlar...) uchun InstancedMesh registri.
import * as THREE from 'three';

interface Entry {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
  castShadow: boolean;
  receiveShadow: boolean;
}

const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

export class Instancer {
  private entries = new Map<string, Entry>();

  define(
    key: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    opts: { castShadow?: boolean; receiveShadow?: boolean } = {},
  ) {
    this.entries.set(key, {
      geometry,
      material,
      matrices: [],
      colors: [],
      castShadow: opts.castShadow ?? true,
      receiveShadow: opts.receiveShadow ?? true,
    });
  }

  has(key: string) {
    return this.entries.has(key);
  }

  add(
    key: string,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rotY = 0,
    color?: THREE.Color,
    rotX = 0,
    rotZ = 0,
  ) {
    const en = this.entries.get(key);
    if (!en) throw new Error(`Instancer: ${key} aniqlanmagan`);
    e.set(rotX, rotY, rotZ, 'YXZ');
    q.setFromEuler(e);
    v.set(x, y, z);
    s.set(sx, sy, sz);
    en.matrices.push(new THREE.Matrix4().compose(v, q, s));
    en.colors.push(color ?? new THREE.Color(1, 1, 1));
  }

  count(key: string) {
    return this.entries.get(key)?.matrices.length ?? 0;
  }

  build(): THREE.Group {
    const g = new THREE.Group();
    for (const [key, en] of this.entries) {
      if (!en.matrices.length) continue;
      const mesh = new THREE.InstancedMesh(en.geometry, en.material, en.matrices.length);
      en.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      const useColor = en.colors.some((c) => c.r !== 1 || c.g !== 1 || c.b !== 1);
      if (useColor) en.colors.forEach((c, i) => mesh.setColorAt(i, c));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = en.castShadow;
      mesh.receiveShadow = en.receiveShadow;
      mesh.computeBoundingSphere();
      mesh.name = key;
      g.add(mesh);
    }
    return g;
  }
}
