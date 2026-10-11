/**
 * Couleurs des bacs, attribuées automatiquement (jamais choisies par l'utilisateur).
 * Identiques en mode clair et sombre ; `ink` est la couleur du texte posé dessus.
 */
export const BAC_COLORS = [
  { bg: "#FF6A13", ink: "#111111" }, // orange
  { bg: "#FF9FCB", ink: "#111111" }, // rose
  { bg: "#2448D8", ink: "#FFFFFF" }, // cobalt
  { bg: "#B9A8FF", ink: "#111111" }, // lilas
  { bg: "#FFD23F", ink: "#111111" }, // jaune
  { bg: "#14A3A3", ink: "#111111" }, // turquoise
  { bg: "#1E9E5A", ink: "#FFFFFF" }, // vert
  { bg: "#111111", ink: "#ECEDE8" }, // noir
  { bg: "#C9CBC4", ink: "#111111" }, // gris
] as const;

export const DIVERS_COLOR = { bg: "#C9A878", ink: "#111111" } as const;

export function inkFor(bg: string): string {
  if (bg.toUpperCase() === DIVERS_COLOR.bg) return DIVERS_COLOR.ink;
  return BAC_COLORS.find((c) => c.bg.toUpperCase() === bg.toUpperCase())?.ink ?? "#111111";
}

/** Prochaine couleur libre pour un nouveau bac (on recycle quand tout est pris). */
export function nextColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  const free = BAC_COLORS.find((c) => !taken.has(c.bg.toUpperCase()));
  return (free ?? BAC_COLORS[used.length % BAC_COLORS.length]).bg;
}

/** Teinte plus sombre (amount < 0) ou plus claire (> 0) d'une couleur hex. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** Teintes du vinyle ton sur ton des pochettes (plus clair sur le bac noir). */
export function vinylShades(bg: string): { disc: string; groove: string; label: string } {
  const dark = bg.toUpperCase() === "#111111";
  return {
    disc: shade(bg, dark ? 0.1 : -0.12),
    groove: shade(bg, dark ? 0.16 : -0.2),
    label: shade(bg, dark ? 0.22 : -0.26),
  };
}
