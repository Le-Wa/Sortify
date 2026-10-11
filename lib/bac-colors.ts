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

/** Prochaine couleur libre pour un nouveau bac ; quand tout est pris, la moins utilisée (dans l'ordre de la palette). */
export function nextColor(used: string[]): string {
  const uses = new Map<string, number>(BAC_COLORS.map((c) => [c.bg, 0]));
  for (const color of used) {
    const key = color.toUpperCase();
    if (uses.has(key)) uses.set(key, uses.get(key)! + 1);
  }
  const least = Math.min(...uses.values());
  return BAC_COLORS.find((c) => uses.get(c.bg) === least)!.bg;
}
