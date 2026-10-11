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

const VOWELS = "AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜ";

/**
 * Coupe un mot long en deux à une frontière de syllabe proche du milieu,
 * avec un trait d'union : « AFROBEATS » → « AFRO- » + « BEATS ».
 */
function hyphenate(word: string): [string, string] {
  const up = word.toUpperCase();
  const mid = word.length / 2;
  let best = Math.round(mid);
  let bestScore = Infinity;
  for (let i = 3; i <= word.length - 3; i++) {
    // La seconde partie commence par une syllabe : consonne puis voyelle (« Mélan-colie », pas « Méla-ncolie »).
    const syllable = !VOWELS.includes(up[i]) && VOWELS.includes(up[i + 1] ?? "");
    const score = Math.abs(i - mid) + (syllable ? 0 : 2);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [`${word.slice(0, best)}-`, word.slice(best)];
}

/** Un nom d'un seul mot de 9 lettres ou plus est coupé en deux lignes (plus gros sur la pochette). */
const LONG_WORD = 9;

/** Répartit les mots sur 3 lignes au plus, en équilibrant leur longueur. */
export function splitLines(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length >= LONG_WORD) return hyphenate(words[0]);
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
  const fontSize = Math.min(size * 0.34, (size - padding * 2) / widest, (size * 0.62) / (lines.length * 0.94));
  const small = Math.max(7, Math.round(size * 0.055));
  return { lines, fontSize, padding, small };
}


/**
 * Place de la forme : la plus grande boîte carrée ancrée en haut à droite (débordant d'un cinquième)
 * qui ne touche ni le nom ni la mention du coin gauche.
 */
export function shapeBox(name: string, size: number) {
  const { lines, fontSize, padding, small } = sleeveLayout(name, size);
  const BLEED = 0.2;
  const gap = size * 0.035;
  const lineH = 0.94 * fontSize;
  const textTop = size - padding - lines.length * lineH;
  const blocks = lines.map((line, i) => ({ top: textTop + i * lineH + fontSize * 0.08, bottom: textTop + (i + 1) * lineH, right: padding + lineWidthEm(line) * fontSize }));
  blocks.push({ top: padding, bottom: padding + small, right: padding + small * 0.62 * 7 }); // « sortify »
  let box = size * 0.7;
  for (; box > size * 0.12; box -= size / 160) {
    const left = size - box * (1 - BLEED);
    const bottom = box * (1 - BLEED);
    if (!blocks.some((b) => bottom + gap > b.top && left - gap < b.right)) break;
  }
  return { box, left: size - box * (1 - BLEED), top: -box * BLEED };
}
