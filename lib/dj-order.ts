/**
 * Ordre « DJ » d'un bac (13/10/2026) : enchaîner les titres comme un DJ, sans IA.
 * - tempo proche (± 6 % idéalement ; un demi ou double tempo compte comme proche : 70 ↔ 140 BPM) ;
 * - tonalités compatibles sur la roue de Camelot (même case, case voisine, ou relatif majeur / mineur) ;
 * - énergie en montée douce du début à la fin.
 * Les titres sans tempo sont placés d'après leur énergie ; ceux sans aucune donnée audio vont à la fin.
 * Module pur, testé dans `lib/__tests__/dj-order.test.ts`.
 */

export interface DjTrack {
  id: string;
  tempo?: number | null;
  key?: number | null;
  mode?: number | null;
  energy?: number | null;
}

// Roue de Camelot : numéro (1–12) selon la tonalité (0 = do … 11 = si).
const MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

/** « 8B » (majeur) ou « 5A » (mineur), null sans tonalité. */
export function camelot(key?: number | null, mode?: number | null): string | null {
  if (key == null || mode == null || key < 0 || key > 11) return null;
  return mode === 1 ? `${MAJOR[key]}B` : `${MINOR[key]}A`;
}

/** 0 : même case ou voisine compatible ; 1 : deux crans ; 2 : loin ; 0,5 sans information. */
export function keyDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 0.5;
  const na = Number(a.slice(0, -1));
  const nb = Number(b.slice(0, -1));
  const step = Math.min((na - nb + 12) % 12, (nb - na + 12) % 12);
  const sameLetter = a.at(-1) === b.at(-1);
  if (sameLetter && step <= 1) return 0;
  if (!sameLetter && step === 0) return 0; // relatif majeur / mineur
  if (step <= 2) return 1;
  return 2;
}

/** Écart de tempo relatif, en tenant compte du demi et du double tempo. */
export function tempoGap(a?: number | null, b?: number | null): number {
  if (!a || !b) return 0.08;
  const ratios = [b / a, (2 * b) / a, b / (2 * a)];
  return Math.min(...ratios.map((r) => Math.abs(1 - r)));
}

/** Ordre DJ : renvoie les identifiants dans l'ordre d'écoute. */
export function djOrder(tracks: DjTrack[]): string[] {
  const known = tracks.filter((t) => t.energy != null || t.tempo != null);
  const unknown = tracks.filter((t) => t.energy == null && t.tempo == null);
  if (known.length === 0) return tracks.map((t) => t.id);

  const energies = known.map((t) => t.energy ?? 0.5);
  const eMin = Math.min(...energies);
  const eMax = Math.max(...energies);
  const left = new Set(known.map((t) => t.id));
  const byId = new Map(known.map((t) => [t.id, t]));

  // Départ : le titre le plus calme (échauffement).
  let current = [...known].sort((a, b) => (a.energy ?? 0.5) - (b.energy ?? 0.5) || (a.tempo ?? 999) - (b.tempo ?? 999))[0];
  const order = [current.id];
  left.delete(current.id);

  while (left.size > 0) {
    const position = order.length / Math.max(1, known.length - 1);
    const target = eMin + (eMax - eMin) * position;
    const from = current;
    let best: DjTrack | null = null;
    let bestCost = Infinity;
    for (const id of left) {
      const t = byId.get(id)!;
      const cost =
        Math.min(tempoGap(from.tempo, t.tempo), 0.3) * 10 + // 6 % d'écart ≈ 0,6
        keyDistance(camelot(from.key, from.mode), camelot(t.key, t.mode)) * 0.6 +
        Math.abs((t.energy ?? target) - target) * 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = t;
      }
    }
    current = best!;
    order.push(current.id);
    left.delete(current.id);
  }
  return [...order, ...unknown.map((t) => t.id)];
}
