// HUD: sana, vaqt, quyosh balandligi va kompas.
import * as THREE from 'three';
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h } from '../ui/dom';
import { formatDate, formatTime } from '../core/sun';

export function mountHud(app: App, shell: Shell) {
  const time = h('div', { class: 'time' });
  const needle = h('div', {
    class: 'compass',
    title: 'Shimol',
    html: `<svg viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="currentColor" stroke-opacity=".25"/>
      <path d="M17 4 21 17h-8Z" fill="var(--ring3)"/>
      <path d="M17 30 13 17h8Z" fill="currentColor" fill-opacity=".45"/>
      <text x="17" y="11.5" text-anchor="middle" font-size="6.5" font-family="IBM Plex Sans, sans-serif" font-weight="600" fill="#fff">N</text>
    </svg>`,
  });
  shell.hud.append(time, needle);
  const svg = () => needle.querySelector('svg') as SVGSVGElement;

  const update = () => {
    const s = app.env.state.sun;
    time.replaceChildren(
      `${formatDate(app.doy)} · ${formatTime(app.hours)}`,
      h('small', {}, s.altitude > 0 ? `quyosh ${s.altitude.toFixed(0)}°` : 'tun'),
    );
  };
  app.timeListeners.push(update);
  update();

  const dir = new THREE.Vector3();
  app.onFrame(() => {
    const cam = app.activeCamera;
    if (app.activeScene !== app.scene) return;
    cam.getWorldDirection(dir);
    const a = Math.atan2(dir.x, -dir.z);
    svg().style.transform = `rotate(${(-a * 180) / Math.PI}deg)`;
  });
}
