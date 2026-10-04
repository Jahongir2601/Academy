// HUD’dagi «Realistik» almashtirgichi: fotorealistik rejim va oddiy maket orasida.
import type { App } from '../app';
import type { Shell } from '../ui/shell';
import { h, toast } from '../ui/dom';
import { Realism } from '../core/realism';

const KEY = 'akademiya.realistic';

function stored(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

export function mountRealistic(app: App, shell: Shell): Realism {
  const realism = new Realism(app);
  const btn = h('button', {
    class: 'mode-toggle',
    title: 'Realistik ko‘rinish: fotoskaner teksturalar, barg daraxtlar, yumshoq soyalar (kuchli videokarta kerak)',
    onclick: () => {
      realism.setEnabled(!realism.enabled);
      try {
        localStorage.setItem(KEY, realism.enabled ? '1' : '0');
      } catch {
        /* saqlab bo‘lmasa ham ishlayveradi */
      }
      toast(realism.enabled ? 'Realistik ko‘rinish yoqildi' : 'Maket ko‘rinishi');
    },
  }, h('i', { class: 'dot' }), 'Realistik');
  realism.onChange = (on) => btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-pressed', 'false');
  shell.hud.prepend(btn);
  // eksport (GLB) doim maket holatidan
  app.exportHooks.push(() => {
    const was = realism.enabled;
    if (was) realism.setEnabled(false);
    return () => {
      if (was) realism.setEnabled(true);
    };
  });
  const url = new URLSearchParams(location.search).get('real');
  const pref = url === '1' ? true : url === '0' ? false : stored();
  realism.setEnabled(pref ?? !app.isMobile);
  return realism;
}
