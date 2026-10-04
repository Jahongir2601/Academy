// «Quyosh» bo‘limi: sana/vaqt, Toshkent quyosh holati, hovli soyasi, kunlik quyosh soatlari xaritasi.
import * as THREE from 'three';
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h, icon, fmt } from '../ui/dom';
import { dayOfYear, formatDate, formatTime, sunriseSunset } from '../core/sun';
import { courtyardShade, computeSunHours, heatTexture, mapStats, heatColor, HEAT_RECT, type SunHoursMap } from '../sim/shade';
import { COURTYARD } from '../data/campus';

const PRESETS = [
  { label: '21-mart', doy: dayOfYear(3, 21) },
  { label: '21-iyun', doy: dayOfYear(6, 21) },
  { label: '23-sentabr', doy: dayOfYear(9, 23) },
  { label: '21-dekabr', doy: dayOfYear(12, 21) },
];

function compassWord(az: number): string {
  const names = ['shimol', 'shimoli-sharq', 'sharq', 'janubi-sharq', 'janub', 'janubi-g‘arb', 'g‘arb', 'shimoli-g‘arb'];
  return names[Math.round(az / 45) % 8];
}

export function mountSun(app: App, shell: Shell) {
  let playing = false;
  let heatMesh: THREE.Mesh | null = null;
  let heatMap: SunHoursMap | null = null;
  let computing: { cancelled: boolean } | null = null;
  let shadeTimer = 0;

  const dateIn = h('input', { type: 'range', id: 'sun-date', min: 1, max: 365, step: 1, value: app.doy });
  const timeIn = h('input', { type: 'range', id: 'sun-time', min: 4, max: 22, step: 0.0833, value: app.hours });
  const dateOut = h('output', { for: 'sun-date' });
  const timeOut = h('output', { for: 'sun-time' });
  const chips = h('div', { class: 'chips' });
  const presetBtns = PRESETS.map((p) => {
    const b = h('button', { class: 'chip', 'aria-pressed': 'false' }, p.label);
    b.addEventListener('click', () => app.setTime(p.doy, app.hours));
    chips.append(b);
    return { b, doy: p.doy };
  });
  const playBtn = h('button', { class: 'btn', 'aria-pressed': 'false' }, icon('play'), 'Kun davomida');
  const altOut = h('b');
  const azOut = h('b');
  const azLbl = h('span', {}, 'azimut');
  const riseOut = h('b');
  const setOut = h('b');

  const meterB = h('i', { style: 'width:0' });
  const meterA = h('i', { style: 'width:0' });
  const outB = h('output');
  const outA = h('output');
  const shadeNote = h('p', { class: 'note' });

  const heatToggle = h('input', { type: 'checkbox', id: 'heat-toggle' });
  const heatStatus = h('p', {}, 'Tanlangan kun uchun har bir nuqtaga necha soat to‘g‘ridan-to‘g‘ri quyosh tushishi hisoblanadi (2,5 m katak, 30 daqiqa qadam).');
  const heatLegend = h('div', { class: 'section', hidden: true });
  const heatStats = h('div', { class: 'stats', hidden: true });

  dateIn.addEventListener('input', () => app.setTime(Number(dateIn.value), app.hours));
  timeIn.addEventListener('input', () => app.setTime(app.doy, Number(timeIn.value)));
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.replaceChildren(icon(playing ? 'pause' : 'play'), playing ? 'To‘xtatish' : 'Kun davomida');
  });

  const refreshShade = () => {
    const s = courtyardShade(app.occluders, app.env.state.sun.dir);
    meterB.style.width = `${(s.buildings * 100).toFixed(0)}%`;
    meterA.style.width = `${(s.all * 100).toFixed(0)}%`;
    outB.textContent = `${Math.round(s.buildings * 100)}%`;
    outA.textContent = `${Math.round(s.all * 100)}%`;
    if (app.env.state.sun.altitude <= 0) {
      shadeNote.textContent = 'Quyosh ufqdan past. Hovlida kechki yoritish yoqilgan.';
    } else {
      const gain = Math.round((s.all - s.buildings) * 100);
      shadeNote.textContent =
        gain > 3
          ? `Ravoqlar va chinorlar hovlidagi soyani ${gain} foiz punktga oshiradi. Faqat binolarning o‘zi yetarli soya bermaydi (4-taklif).`
          : 'Bu vaqtda soyani asosan binolar beradi.';
    }
  };

  const refresh = () => {
    dateIn.value = String(app.doy);
    timeIn.value = String(app.hours);
    dateOut.textContent = formatDate(app.doy);
    timeOut.textContent = formatTime(app.hours);
    const s = app.env.state.sun;
    altOut.textContent = `${s.altitude.toFixed(1)}°`;
    azOut.textContent = `${s.azimuth.toFixed(0)}°`;
    azLbl.textContent = `azimut · ${compassWord(s.azimuth)}`;
    const rs = sunriseSunset(app.doy);
    riseOut.textContent = formatTime(rs.rise);
    setOut.textContent = formatTime(rs.set);
    presetBtns.forEach((p) => p.b.setAttribute('aria-pressed', String(p.doy === app.doy)));
    clearTimeout(shadeTimer);
    shadeTimer = window.setTimeout(refreshShade, 120);
    if (heatMap && heatMap.doy !== app.doy && heatToggle.checked) {
      heatStatus.textContent = 'Sana o‘zgardi. Xaritani yangilash uchun qayta yoqing.';
    }
  };
  app.timeListeners.push(refresh);

  app.onFrame((dt) => {
    if (!playing) return;
    let t = app.hours + dt * 1.0;
    if (t > 21.5) t = 4.5;
    app.setTime(app.doy, t);
  });

  const removeHeat = () => {
    if (heatMesh) {
      app.overlays.remove(heatMesh);
      (heatMesh.material as THREE.MeshBasicMaterial).map?.dispose();
      heatMesh.geometry.dispose();
      heatMesh = null;
    }
  };

  const showHeat = async () => {
    removeHeat();
    if (computing) computing.cancelled = true;
    const sig = { cancelled: false };
    computing = sig;
    heatStatus.textContent = 'Hisoblanmoqda… 0%';
    const map = await computeSunHours(app.occluders, app.doy, (p) => {
      heatStatus.textContent = `Hisoblanmoqda… ${Math.round(p * 100)}%`;
    }, { signal: sig });
    if (!map || sig.cancelled || !heatToggle.checked) return;
    heatMap = map;
    const maxH = Math.ceil(map.dayLength);
    const tex = heatTexture(map, maxH);
    const [x0, x1, z0, z1] = HEAT_RECT;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.position.set((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
    mesh.renderOrder = 2;
    heatMesh = mesh;
    app.overlays.add(mesh);
    const court = mapStats(map, COURTYARD);
    const fore = mapStats(map, [-40, 40, 104, 150]);
    const garden = mapStats(map, [-176, 4, -146, -110]);
    heatStatus.textContent = `${formatDate(map.doy)}: kun uzunligi ${map.dayLength.toFixed(1)} soat.`;
    heatLegend.hidden = false;
    heatLegend.replaceChildren(
      h('div', { class: 'grad', style: `background:linear-gradient(90deg, ${[0, 0.25, 0.5, 0.72, 0.88, 1].map((t) => `rgb(${heatColor(t).map(Math.round).join(',')})`).join(',')})` }),
      h('div', { class: 'grad-scale' }, h('span', {}, '0 soat (soya)'), h('span', {}, `${(maxH / 2).toFixed(0)}`), h('span', {}, `${maxH} soat`)),
    );
    heatStats.hidden = false;
    heatStats.replaceChildren(
      h('div', { class: 'stat' }, h('b', {}, `${fmt(court.avg, 1)} s`), h('span', {}, 'hovli: o‘rtacha quyosh')),
      h('div', { class: 'stat' }, h('b', {}, `${Math.round(court.under4 * 100)}%`), h('span', {}, 'hovlining <4 soat quyoshli qismi')),
      h('div', { class: 'stat' }, h('b', {}, `${fmt(fore.avg, 1)} s`), h('span', {}, 'forecourt: o‘rtacha')),
      h('div', { class: 'stat' }, h('b', {}, `${fmt(garden.avg, 1)} s`), h('span', {}, 'Scholars’ Garden: o‘rtacha')),
    );
  };

  heatToggle.addEventListener('change', () => {
    if (heatToggle.checked) {
      showHeat();
    } else {
      if (computing) computing.cancelled = true;
      removeHeat();
      heatLegend.hidden = true;
      heatStats.hidden = true;
      heatStatus.textContent = 'Xarita o‘chirildi.';
    }
  });

  shell.addTab({
    id: 'sun',
    label: 'Quyosh',
    icon: 'sun',
    build: (p) => {
      p.append(
        h('h2', {}, 'Quyosh va soya'),
        h('p', { class: 'lede' }, 'Toshkent (41,3° sh.k.) uchun real quyosh holati. Konsepsiya «shade design zarur» deydi, shu yerda tekshiriladi.'),
        h('div', { class: 'section' },
          h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { for: 'sun-date' }, 'Sana'), dateOut), dateIn),
          chips,
          h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { for: 'sun-time' }, 'Mahalliy vaqt (UTC+5)'), timeOut), timeIn),
          h('div', { class: 'btn-row' }, playBtn),
        ),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, altOut, h('span', {}, 'quyosh balandligi')),
          h('div', { class: 'stat' }, azOut, azLbl),
          h('div', { class: 'stat' }, riseOut, h('span', {}, 'quyosh chiqishi')),
          h('div', { class: 'stat' }, setOut, h('span', {}, 'quyosh botishi')),
        ),
        h('div', { class: 'section' },
          h('h3', {}, 'Hovli soyasi hozir (80 × 60 m)'),
          h('div', { class: 'compare' },
            h('div', { class: 'compare-row' }, h('span', {}, 'Faqat binolar'), h('div', { class: 'meter bronze' }, meterB), outB),
            h('div', { class: 'compare-row' }, h('span', {}, '+ ravoq va chinorlar'), h('div', { class: 'meter' }, meterA), outA),
          ),
          shadeNote,
        ),
        h('div', { class: 'section' },
          h('h3', {}, 'Kunlik quyosh soatlari xaritasi'),
          h('label', { class: 'toggle', for: 'heat-toggle' }, 'Xaritani ko‘rsatish', heatToggle),
          heatStatus,
          heatLegend,
          heatStats,
        ),
      );
      refresh();
    },
  });

  // tashqi API: kerakli sana/vaqtni o‘rnatish
  return {
    setNoonSummer: () => {
      const doy = dayOfYear(6, 21);
      app.setTime(doy, 13);
    },
  };
}
