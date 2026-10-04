// Interfeys qobig‘i: brend, tab-rels, panellar, bino kartasi, pastki satr, HUD.
import { h, icon, ICONS, BRAND_MARK } from './dom';

export interface TabDef {
  id: string;
  label: string;
  icon: keyof typeof ICONS;
  build: (panel: HTMLElement) => void;
  onShow?: () => void;
  onHide?: () => void;
}

export class Shell {
  readonly ui: HTMLElement;
  readonly rail: HTMLElement;
  readonly dock: HTMLElement;
  readonly info: HTMLElement;
  readonly infoBody: HTMLElement;
  readonly caption: HTMLElement;
  readonly hud: HTMLElement;
  readonly hint: HTMLElement;
  readonly brand: HTMLElement;
  private tabs = new Map<string, { def: TabDef; btn: HTMLButtonElement; panel: HTMLElement }>();
  current: string | null = null;
  private onInfoClose: (() => void) | null = null;
  readonly mobile = window.matchMedia('(max-width: 760px)');

  constructor(root: HTMLElement) {
    this.ui = h('div', { class: 'ui' });
    root.appendChild(this.ui);

    this.brand = h(
      'header',
      { class: 'brand card' },
      h('span', { class: 'brand-mark', html: BRAND_MARK }),
      h('div', {}, h('h1', {}, 'Markaziy Bank Akademiyasi'), h('p', {}, 'Konseptual 3D maket · Bilim. Tahlil. Qaror.')),
    );
    this.rail = h('nav', { class: 'rail card', role: 'tablist', 'aria-label': 'Bo‘limlar' });
    this.dock = h('div', { class: 'dock' }, this.rail);

    this.infoBody = h('div', { style: 'display:contents' });
    this.info = h(
      'aside',
      { class: 'info card', hidden: true, 'aria-live': 'polite' },
      h('button', { class: 'close', 'aria-label': 'Yopish', onclick: () => this.hideInfo() }, icon('close')),
      this.infoBody,
    );
    this.caption = h('div', { class: 'caption card', hidden: true });
    this.hud = h('div', { class: 'hud card' });
    this.hint = h('div', { class: 'hint card' }, 'Sichqoncha: chap — aylantirish · o‘ng — surish · g‘ildirak — yaqinlashtirish · binoni bosing');
    this.ui.append(this.brand, this.dock, this.info, this.caption, this.hud, this.hint);
    setTimeout(() => (this.hint.hidden = true), 9000);
  }

  addTab(def: TabDef) {
    const btn = h(
      'button',
      { role: 'tab', 'aria-selected': 'false', id: `tab-${def.id}`, title: def.label },
      icon(def.icon),
      h('span', {}, def.label),
    );
    const panel = h('section', { class: 'panel card', role: 'tabpanel', hidden: true, 'aria-labelledby': `tab-${def.id}` });
    const collapse = h('button', { class: 'collapse-btn', 'aria-label': 'Panelni yopish' }, icon('chevron'));
    collapse.addEventListener('click', () => this.select(null));
    panel.appendChild(collapse);
    def.build(panel);
    btn.addEventListener('click', () => this.select(this.current === def.id ? null : def.id));
    this.rail.appendChild(btn);
    this.dock.appendChild(panel);
    this.tabs.set(def.id, { def, btn, panel });
  }

  select(id: string | null) {
    if (this.current) {
      const t = this.tabs.get(this.current);
      if (t) {
        t.btn.setAttribute('aria-selected', 'false');
        t.panel.hidden = true;
        t.def.onHide?.();
      }
    }
    this.current = id;
    if (id) {
      const t = this.tabs.get(id);
      if (t) {
        t.btn.setAttribute('aria-selected', 'true');
        t.panel.hidden = false;
        t.def.onShow?.();
        if (this.mobile.matches) this.hideInfo();
      }
    }
  }

  showInfo(content: HTMLElement, onClose?: () => void) {
    this.infoBody.replaceChildren(content);
    this.info.hidden = false;
    this.info.scrollTop = 0;
    this.onInfoClose = onClose ?? null;
    if (this.mobile.matches) this.select(null);
  }

  hideInfo() {
    if (this.info.hidden) return;
    this.info.hidden = true;
    const f = this.onInfoClose;
    this.onInfoClose = null;
    f?.();
  }

  setVisible(v: boolean) {
    this.brand.hidden = !v;
    this.dock.style.display = v ? '' : 'none';
    this.hud.hidden = !v;
    if (!v) {
      this.info.hidden = true;
      this.hint.hidden = true;
    }
  }
}
