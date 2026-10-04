// «Ko‘rinish» bo‘limi: kamera nuqtalari, yorliqlar, avtomatik tur, piyoda rejim, eksport.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { App } from '../app';
import { VIEWS } from '../app';
import type { Shell } from '../ui/shell';
import type { Selection } from './selection';
import { Tour } from './tour';
import { Walk } from './walk';
import { h, icon, toast } from '../ui/dom';
import { saveFile, makeZip } from '../ui/download';

export function mountViews(app: App, shell: Shell, sel: Selection, walk: Walk) {
  const tour = new Tour(app, shell);
  let tourBtn: HTMLButtonElement;
  tour.onStop = () => tourBtn?.setAttribute('aria-pressed', 'false');

  shell.addTab({
    id: 'view',
    label: 'Ko‘rinish',
    icon: 'view',
    build: (p) => {
      p.append(
        h('h2', {}, 'Kampus maketi'),
        h('p', { class: 'lede' }, 'B layout: public zona oldinda, academy zona markazda, secure zona orqada. Binoni bosing — konsepsiyadagi tarkibi chiqadi.'),
      );
      const views = h('div', { class: 'btn-grid' });
      for (const v of VIEWS) {
        views.append(
          h('button', {
            class: 'btn',
            onclick: () => {
              tour.stop();
              if (walk.active) walk.exit();
              app.flyTo({ x: v.pos[0], y: v.pos[1], z: v.pos[2] }, { x: v.target[0], y: v.target[1], z: v.target[2] });
            },
          }, v.label),
        );
      }
      p.append(h('div', { class: 'section' }, h('h3', {}, 'Kamera nuqtalari'), views));

      tourBtn = h('button', {
        class: 'btn primary',
        'aria-pressed': 'false',
        onclick: () => {
          if (tour.running) {
            tour.stop();
            return;
          }
          if (walk.active) walk.exit();
          sel.clear();
          tourBtn.setAttribute('aria-pressed', 'true');
          tour.start();
        },
      }, icon('tour'), 'Avtomatik tur (≈1,5 daq)');
      const walkBtn = h('button', {
        class: 'btn',
        onclick: () => {
          tour.stop();
          walk.enter(new THREE.Vector3(0, 1.7, 146), new THREE.Vector3(0, 9, 90));
        },
      }, icon('walk'), 'Piyoda rejim');
      if (app.isMobile) walkBtn.hidden = true;
      p.append(h('div', { class: 'section' }, h('h3', {}, 'Sayohat'), h('div', { class: 'btn-row' }, tourBtn, walkBtn)));

      const labels = h('input', { type: 'checkbox', id: 'opt-labels', checked: true });
      labels.addEventListener('change', () => sel.setLabelsVisible(labels.checked));
      const shadows = h('input', { type: 'checkbox', id: 'opt-shadows', checked: true });
      shadows.addEventListener('change', () => {
        app.renderer.shadowMap.enabled = shadows.checked;
        app.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!m) return;
          (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
        });
      });
      const context = h('input', { type: 'checkbox', id: 'opt-context', checked: true });
      context.addEventListener('change', () => {
        const inst = app.campus.getObjectByName('instanced');
        inst?.getObjectByName('context')?.traverse((o) => (o.visible = context.checked));
        const mts = app.scene.getObjectByName('mountains');
        if (mts) mts.visible = context.checked;
      });
      p.append(
        h('div', { class: 'section' },
          h('h3', {}, 'Qatlamlar'),
          h('label', { class: 'toggle', for: 'opt-labels' }, 'Bino yorliqlari', labels),
          h('label', { class: 'toggle', for: 'opt-shadows' }, 'Soyalar', shadows),
          h('label', { class: 'toggle', for: 'opt-context' }, 'Atrofdagi shahar va tog‘lar', context),
        ),
      );

      const shot = h('button', { class: 'btn', onclick: () => screenshot(app) }, icon('camera'), 'Rasm (PNG)');
      const glb = h('button', { class: 'btn', onclick: () => exportGLB(app, glb) }, icon('cube'), '3D model (GLB)');
      p.append(
        h('div', { class: 'section' },
          h('h3', {}, 'Eksport'),
          h('div', { class: 'btn-row' }, shot, glb),
          h('p', {}, 'GLB faylni arxitektorlar Blender, Twinmotion, SketchUp yoki Revit’da ochib, fotorealistik render qilishi mumkin.'),
        ),
      );
    },
  });
  return { tour };
}

async function screenshot(app: App) {
  app.renderFrame();
  const blob = await new Promise<Blob | null>((r) => app.renderer.domElement.toBlob(r, 'image/png'));
  if (!blob) return;
  const res = await saveFile(`akademiya-maket-${Date.now()}.png`, blob);
  toast(res === 'saved' ? 'Rasm saqlandi' : res === 'declined' ? 'Saqlash bekor qilindi' : 'Bu ko‘rinishda fayl saqlab bo‘lmaydi');
}

/** GLB baytlari (eksport skripti ham shu funksiyadan foydalanadi). */
export async function exportGLBBuffer(app: App): Promise<ArrayBuffer> {
  // eksport doim maket holatidan (Blender skripti material va toj geometriyasini nomi bo‘yicha taniydi)
  const restore = app.exportHooks.map((f) => f());
  try {
    const exporter = new GLTFExporter();
    return (await exporter.parseAsync(app.campus, { binary: true, onlyVisible: true, maxTextureSize: 1024 })) as ArrayBuffer;
  } finally {
    restore.forEach((f) => f());
  }
}

async function exportGLB(app: App, btn: HTMLButtonElement) {
  btn.disabled = true;
  const old = btn.innerHTML;
  btn.textContent = 'Tayyorlanmoqda…';
  try {
    const buf = await exportGLBBuffer(app);
    const readme = new TextEncoder().encode(
      [
        'O‘zbekiston Markaziy Banki Akademiyasi — konseptual 3D maket (B layout)',
        '',
        'Fayl: akademiya-kampus.glb (glTF 2.0, binar)',
        'Birlik: metr. Y — yuqoriga, -Z — shimol, +X — sharq.',
        'Uchastka markazi (0,0,0). Ceremonial Entrance janubda (+Z).',
        'Takrorlanuvchi obyektlar (daraxtlar, panellar) EXT_mesh_gpu_instancing bilan.',
        '',
        'Konseptual maket, aniq loyiha hujjati emas.',
      ].join('\n'),
    );
    const zip = makeZip([
      { name: 'akademiya-kampus.glb', data: new Uint8Array(buf) },
      { name: 'README.txt', data: readme },
    ]);
    const res = await saveFile('akademiya-kampus-glb.zip', zip);
    toast(res === 'saved' ? '3D model saqlandi (ZIP ichida GLB)' : res === 'declined' ? 'Saqlash bekor qilindi' : 'Bu ko‘rinishda fayl saqlab bo‘lmaydi');
  } catch (e) {
    console.error(e);
    toast('Eksportda xato yuz berdi');
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}
