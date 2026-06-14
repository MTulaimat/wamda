/* Live accent theming: drives the --accent CSS variable both windows read. */
export function applyAccent(hex: string) {
  document.documentElement.style.setProperty("--accent", hex);
}

/** Convert "#RRGGBB" to "r,g,b" for rgba() shadows that need the accent tint. */
export function accentRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "110,123,255";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
