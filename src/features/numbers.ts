// «Raqamlar» bo‘limi: maydon jadvali (model vs konsepsiya), asosiy ko‘rsatkichlar, 7 ta taklif.
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h, icon, fmt } from '../ui/dom';
import { BUILDINGS, AREA_TARGETS, SITE, buildingGFA, rectArea, type AreaCategory } from '../data/campus';
import { ARCADES } from '../scene/arcades';

export interface ProposalActions {
  showEntrance: () => void;
  showKnowledge: () => void;
  showSecure: () => void;
  showShade: () => void;
  showArcades: () => void;
  showResidence: () => void;
  showParking: () => void;
}

export function mountNumbers(app: App, shell: Shell, act: ProposalActions) {
  shell.addTab({
    id: 'numbers',
    label: 'Raqamlar',
    icon: 'numbers',
    build: (p) => {
      const siteArea = rectArea(SITE.rect);
      const totals = new Map<AreaCategory, number>();
      let gfa = 0;
      let foot = 0;
      for (const b of BUILDINGS) {
        const g = buildingGFA(b);
        gfa += g;
        foot += rectArea(b.rect) - (b.court ? rectArea(b.court) : 0);
        totals.set(b.category, (totals.get(b.category) ?? 0) + g);
      }
      const inst = app.campus.getObjectByName('instanced');
      const count = (name: string) => {
        const o = inst?.getObjectByName(name) as unknown as { count?: number } | undefined;
        return o?.count ?? 0;
      };
      const trees = count('crown');
      const roofPanels = count('roofPanel');
      const carport = count('canopyPanel') * 5.6 * 7.4;
      const solarArea = roofPanels * 1.9 + carport;
      let arcadeLen = 0;
      for (const a of ARCADES) arcadeLen += Math.max(a.rect[1] - a.rect[0], a.rect[3] - a.rect[2]);

      p.append(
        h('h2', {}, 'Raqamlar'),
        h('p', { class: 'lede' }, 'Model geometriyasidan hisoblangan qiymatlar, konsepsiyadagi 24-bo‘lim maqsadlari bilan taqqoslangan.'),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', {}, `${fmt(siteArea / 10000, 1)} ga`), h('span', {}, 'uchastka (380 × 300 m)')),
          h('div', { class: 'stat' }, h('b', {}, `${fmt(gfa / 1000, 1)} ming m²`), h('span', {}, 'umumiy qurilish maydoni')),
          h('div', { class: 'stat' }, h('b', {}, `${fmt((foot / siteArea) * 100, 1)}%`), h('span', {}, `qurilish izi (${fmt(foot)} m²)`)),
          h('div', { class: 'stat' }, h('b', {}, '~445'), h('span', {}, 'parking joyi (265 + 150 + 30)')),
          h('div', { class: 'stat' }, h('b', {}, fmt(trees)), h('span', {}, 'daraxt (maketda)')),
          h('div', { class: 'stat' }, h('b', {}, `${fmt(arcadeLen)} m`), h('span', {}, 'yopiq ravoqlar')),
          h('div', { class: 'stat wide' }, h('b', {}, `${fmt(solarArea)} m²`), h('span', {}, `quyosh panellari: tomlarda ${fmt(roofPanels * 1.9)} m², carport ${fmt(carport)} m² (≈ ${fmt(solarArea * 0.2 / 1000, 1)} MWp)`)),
        ),
      );

      const tbody = h('tbody');
      (Object.keys(AREA_TARGETS) as AreaCategory[]).forEach((c) => {
        const t = AREA_TARGETS[c];
        const v = totals.get(c) ?? 0;
        const st = v < t.min ? ['lo', 'past'] : v > t.max ? ['hi', 'yuqori'] : ['ok', 'mos'];
        tbody.append(
          h('tr', {},
            h('td', {}, t.label),
            h('td', { class: 'num' }, fmt(v)),
            h('td', { class: 'num' }, `${fmt(t.min / 1000)}–${fmt(t.max / 1000)}k`),
            h('td', {}, h('span', { class: `status ${st[0]}` }, st[1])),
          ),
        );
      });
      tbody.append(
        h('tr', {},
          h('td', {}, h('b', {}, 'Jami')),
          h('td', { class: 'num' }, h('b', {}, fmt(gfa))),
          h('td', { class: 'num' }, '45–55k'),
          h('td', {}, h('span', { class: `status ${gfa >= 45000 && gfa <= 55000 ? 'ok' : 'hi'}` }, gfa >= 45000 && gfa <= 55000 ? 'mos' : 'farq')),
        ),
      );
      p.append(
        h('div', { class: 'section' },
          h('h3', {}, 'Maydon taqsimoti, m²'),
          h('div', { class: 'table-wrap' },
            h('table', {},
              h('thead', {}, h('tr', {}, h('th', {}, 'Blok'), h('th', { class: 'num' }, 'Model'), h('th', { class: 'num' }, 'Maqsad'), h('th', {}, ''))),
              tbody,
            ),
          ),
          h('p', {}, 'Grand Academy Hall «Support» toifasiga kiritilgan. Ichki hovlilar maydondan ayirilgan.'),
        ),
      );

      const props: [string, string, () => void][] = [
        ['Conference va Museum Grand Hall yonida', 'Ikkalasi Ring 1 da, alohida kirishlar bilan. Bosh o‘q konferensiya oqimidan xoli.', act.showEntrance],
        ['Knowledge Centre bosh o‘qda', 'Knowledge Stair Grand Hall’dan to‘g‘ridan-to‘g‘ri kutubxonaga olib chiqadi.', act.showKnowledge],
        ['Secure Data Lab Ring 3 ga ko‘chirildi', 'Ochiq laboratoriyalar Ring 2 da, maxfiy ma’lumotlar Research yonida.', act.showSecure],
        ['Hovli uchun soya yechimi', 'Ravoqlar va chinorlar. Natijani 21-iyun soat 13:00 holatida ko‘ring.', act.showShade],
        ['Yopiq ravoqlar tarmog‘i', `Kampus bo‘ylab ${fmt(arcadeLen)} m soyali yo‘l.`, act.showArcades],
        ['Residence’ga alohida kirish', 'Mehmonlar shimoli-sharqdagi yo‘ldan keladi, kampus ichidan o‘tmaydi.', act.showResidence],
        ['Gibrid parking', '~265 joy solar carport ostida, ~150 joy yer ostida.', act.showParking],
      ];
      const list = h('ol', { class: 'proposals' });
      props.forEach(([title, text, fn], i) => {
        list.append(
          h('li', {},
            h('span', { class: 'numchip' }, String(i + 1)),
            h('b', {}, title),
            h('p', {}, text),
            h('button', { class: 'btn', onclick: fn }, icon('target'), 'Maketda ko‘rsatish'),
          ),
        );
      });
      p.append(h('div', { class: 'section' }, h('h3', {}, 'Konsepsiyaga kiritilgan 7 ta o‘zgartirish'), list));
    },
  });
}
