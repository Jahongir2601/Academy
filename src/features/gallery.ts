// «Renderlar» bo‘limi: Blender (Cycles) fotorealistik kadrlar galereyasi.
// Rasmlar render/out/*.jpg dan build vaqtida olinadi (render/blender/render_campus.py natijasi).
import type { Shell } from '../ui/shell';
import { h, icon } from '../ui/dom';

const FILES = import.meta.glob('../../render/out/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface Shot {
  id: string;
  title: string;
  when: string;
  text: string;
}

const SHOTS: Shot[] = [
  {
    id: 'aerial',
    title: 'Kampus umumiy ko‘rinishi',
    when: '23-sentabr, 17:00 · janubi-g‘arbdan',
    text: 'B layout: oldinda public zona (Museum, Grand Hall, Conference), markazda chorbog‘ hovlisi, orqada Research va Scholars’ Garden. Chapda solar parking.',
  },
  {
    id: 'entrance',
    title: 'Ceremonial Entrance va Grand Academy Hall',
    when: '23-sentabr, 15:45',
    text: 'Sakkiz ustunli portik, patinali bronza girih panjara, och rang tabiiy tosh. Oldida oval suv havzasi.',
  },
  {
    id: 'courtyard',
    title: 'Academy Courtyard — chorbog‘',
    when: '23-sentabr, 09:18 · Knowledge Centre terrasasidan',
    text: 'Xoch shaklidagi suv havzasi, to‘rt bo‘lakda chinorlar, perimetr bo‘ylab o‘tkir uchli ravoqlar.',
  },
  {
    id: 'arcade',
    title: 'Sharqiy ravoq — soyali promenada',
    when: '23-sentabr, 10:18',
    text: 'Bloklarni bog‘lovchi yopiq ravoqlar tarmog‘i: tosh pilonlar, yog‘och reykali shift, polga tushgan arka naqshi.',
  },
  {
    id: 'garden',
    title: 'Research Institute va Scholars’ Garden',
    when: '21-iyun, 17:30',
    text: 'Ariq, pavilonlar va zich daraxtzor — tadqiqotchilar uchun sokin bog‘. Ortida Research Institute.',
  },
  {
    id: 'dusk',
    title: 'Grand Academy Hall — oqshom',
    when: '21-iyun, 20:43',
    text: 'Ustunlarni pastdan yorituvchi chiroqlar, ichkaridan nur sochayotgan girih panjara, suvdagi aks.',
  },
];

export function mountGallery(shell: Shell) {
  const shots = SHOTS.map((s) => ({ ...s, url: Object.entries(FILES).find(([k]) => k.endsWith(`/${s.id}.jpg`))?.[1] })).filter(
    (s): s is Shot & { url: string } => !!s.url,
  );
  if (!shots.length) return;

  // to‘liq ekranli ko‘rish
  const img = h('img', { alt: '' });
  const cap = h('div', { class: 'lb-cap' });
  const counter = h('span', { class: 'lb-count' });
  let idx = 0;
  const show = (i: number) => {
    idx = (i + shots.length) % shots.length;
    const s = shots[idx];
    img.src = s.url;
    img.alt = s.title;
    counter.textContent = `${idx + 1} / ${shots.length}`;
    cap.replaceChildren(h('b', {}, s.title), h('span', {}, s.when), h('p', {}, s.text));
  };
  const lb = h(
    'div',
    { class: 'lightbox', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Render' },
    h('button', { class: 'lb-close icon-btn', 'aria-label': 'Yopish', onclick: () => (lb.hidden = true) }, icon('close')),
    h('button', { class: 'lb-nav lb-prev icon-btn', 'aria-label': 'Oldingi', onclick: () => show(idx - 1) }, h('span', { html: '&#8249;' })),
    h('figure', {}, img, h('figcaption', {}, counter, cap)),
    h('button', { class: 'lb-nav lb-next icon-btn', 'aria-label': 'Keyingi', onclick: () => show(idx + 1) }, h('span', { html: '&#8250;' })),
  );
  lb.addEventListener('click', (e) => {
    if (e.target === lb) lb.hidden = true;
  });
  window.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') lb.hidden = true;
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'ArrowLeft') show(idx - 1);
  });
  shell.ui.append(lb);

  shell.addTab({
    id: 'renders',
    label: 'Renderlar',
    icon: 'camera',
    build: (p) => {
      const grid = h('div', { class: 'gallery' });
      shots.forEach((s, i) => {
        grid.append(
          h('button', { class: 'thumb', onclick: () => { show(i); lb.hidden = false; } },
            h('img', { src: s.url, alt: s.title, loading: 'lazy' }),
            h('span', {}, s.title)),
        );
      });
      p.append(
        h('h2', {}, 'Fotorealistik renderlar'),
        h('p', { class: 'lede' }, 'Shu maketning o‘zi Blender (Cycles) da render qilingan: PBR materiallar, Toshkent uchun real quyosh va osmon, barg va o‘t geometriyasi.'),
        grid,
        h('p', {}, 'Kadrni bosing — to‘liq ekranda ochiladi (← → bilan almashtiring). Skript: render/blender/render_campus.py.'),
      );
    },
  });
}
