// Lightweight accessibility helpers for Phaser scenes

let liveEl: HTMLElement | null = null;

export function createLiveRegion() {
  if (typeof document === 'undefined') return;
  if (liveEl) return;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.overflow = 'hidden';
  document.body.appendChild(el);
  liveEl = el;
}

export function announce(text: string) {
  if (!liveEl) return;
  liveEl.textContent = text;
}
