/** Mise en page du nom sur une pochette Sortify (écran et image envoyée à Spotify). */

/** Largeur d'une ligne en em, mesurée sur Archivo 900 condensé 62 % en capitales. */
export function lineWidthEm(line: string): number {
  let em = 0;
  for (const char of line.toUpperCase()) {
    if (char === " ") em += 0.25;
    else if ("MW".includes(char)) em += 0.72;
    else if ("IJL'’.,:;!|".includes(char)) em += 0.35;
    else em += 0.52;
  }
  return em;
}

/** Répartit les mots sur 3 lignes au plus, en équilibrant leur longueur. */
export function splitLines(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return words.length ? words : [""];
  const target = words.join(" ").length / 3;
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > target && lines.length < 2) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}

/** Lignes, taille du nom, marge et taille du code pour une pochette de `size` pixels. */
export function sleeveLayout(name: string, size: number) {
  const lines = splitLines(name);
  const widest = Math.max(...lines.map(lineWidthEm), 1);
  const padding = Math.round(size * 0.08);
  const fontSize = Math.min(size * 0.34, (size - padding * 2) / widest, (size * 0.62) / (lines.length * 0.84));
  const small = Math.max(7, Math.round(size * 0.055));
  return { lines, fontSize, padding, small };
}

export function catalogCode(position: number): string {
  return `SRT·${String(position + 1).padStart(2, "0")}`;
}
