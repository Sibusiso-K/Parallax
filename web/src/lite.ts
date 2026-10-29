// Lite mode (DESIGN.md §4): reduced motion, Save-Data or 4 GB of memory or less.
// connection and deviceMemory are only reported by some browsers (mostly Chromium).
type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

export function isLite(nav: NavigatorHints, reducedMotion: boolean): boolean {
  if (reducedMotion) return true;
  if (nav.connection?.saveData) return true;
  return nav.deviceMemory !== undefined && nav.deviceMemory <= 4;
}

export function applyLiteMode(): void {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => {
    document.documentElement.toggleAttribute('data-lite', isLite(navigator, query.matches));
  };
  update();
  query.addEventListener('change', update);
}
