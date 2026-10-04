// Kichik DOM yordamchilari va ikonlar (inline SVG).

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k === 'html') {
      el.innerHTML = String(v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const svg = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  view: svg('<path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z"/><circle cx="12" cy="12" r="2.6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>'),
  shield: svg('<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  people: svg('<circle cx="9" cy="7.5" r="3"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9" r="2.3"/><path d="M15.8 14.3c2.3.2 4 1.9 4.7 4.7"/>'),
  door: svg('<path d="M5 21V4.5L13 3v18"/><path d="M13 5h6v16"/><path d="M3 21h18"/><circle cx="10.5" cy="12.5" r=".6" fill="currentColor"/>'),
  numbers: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  camera: svg('<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4V8Z"/><circle cx="12" cy="13.2" r="3.4"/>'),
  cube: svg('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  walk: svg('<circle cx="13" cy="4.5" r="1.8"/><path d="m10 21 2.2-6.5L15 17v4M8.5 11l2.5-4 3.5 1.5 2.5 3.5M11 7l-1 7.5"/>'),
  tour: svg('<path d="M4 18c3-8 6-10 8-10s3.5 3 3.5 5-1.5 3.5-3 3.5S9 15 10 12.5 15 6 20 6"/><circle cx="20" cy="6" r="1.4" fill="currentColor"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  enter: svg('<path d="M14 4h5v16h-5"/><path d="M3 12h11M10 8l4 4-4 4"/>'),
  back: svg('<path d="M10 6 4 12l6 6M4 12h16"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  theme: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
  heat: svg('<path d="M12 3c2.5 3 5 5.5 5 9.5a5 5 0 0 1-10 0C7 9.5 9 8 9 5.5c1.5 1 2.5 2.3 3 4 .8-2 .5-4.3 0-6.5Z"/>'),
} as const;

export function icon(name: keyof typeof ICONS): HTMLElement {
  const s = document.createElement('span');
  s.style.display = 'contents';
  s.innerHTML = ICONS[name];
  return s;
}

/** Akademiya belgisi: 8 nurli girih yulduzi ichida ustunlar — loyiha uchun neytral belgi. */
export const BRAND_MARK = `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
  <path d="M20 2.5 25 9l8 .8-1 8 5.5 2.2-5.5 2.2 1 8-8 .8-5 6.5-5-6.5-8-.8 1-8L2.5 20 8 17.8l-1-8 8-.8L20 2.5Z"/>
  <path d="M13 26h14M14.5 24v-8M18.5 24v-8M21.5 24v-8M25.5 24v-8M12.5 15.5 20 12l7.5 3.5Z"/>
</svg>`;

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('uz-UZ', { maximumFractionDigits: digits, minimumFractionDigits: digits }).replace(/,/g, ' ');
}

export function toast(msg: string, ms = 2600) {
  let el = document.querySelector<HTMLDivElement>('.toast');
  if (!el) {
    el = h('div', { class: 'toast card', role: 'status', 'aria-live': 'polite' });
    document.querySelector('.ui')?.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout((el as unknown as { _t: number })._t);
  (el as unknown as { _t: number })._t = window.setTimeout(() => (el!.hidden = true), ms);
}
