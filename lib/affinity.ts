/**
 * Affinité musicale entre deux potes (13/10/2026), sans IA : moitié genres (cosinus des familles de genre),
 * moitié artistes (part des titres de chacun signés par un artiste commun, moyenne géométrique).
 * Walid × Jérémy : 39 %. Module pur, testé dans `lib/__tests__/affinity.test.ts`.
 */

export interface AffinityTrack {
  track_id: string;
  artist: string;
  families: string[];
}

export interface Affinity {
  score: number;
  sharedTracks: string[];
  /** Artistes communs, des plus présents aux moins présents chez les deux. */
  sharedArtists: string[];
  /** Famille de genre la plus représentée dans ce que vous partagez (titres et artistes communs). */
  meetingFamily: string | null;
}

function familyShares(tracks: AffinityTrack[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tracks) for (const f of t.families) m.set(f, (m.get(f) ?? 0) + 1 / Math.max(1, tracks.length));
  return m;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    dot += (a.get(k) ?? 0) * (b.get(k) ?? 0);
    na += (a.get(k) ?? 0) ** 2;
    nb += (b.get(k) ?? 0) ** 2;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function affinity(a: AffinityTrack[], b: AffinityTrack[]): Affinity {
  if (a.length === 0 || b.length === 0) return { score: 0, sharedTracks: [], sharedArtists: [], meetingFamily: null };
  const count = (list: AffinityTrack[]) => {
    const m = new Map<string, number>();
    for (const t of list) if (t.artist) m.set(t.artist, (m.get(t.artist) ?? 0) + 1);
    return m;
  };
  const [ca, cb] = [count(a), count(b)];
  const sharedArtists = [...ca.keys()].filter((x) => cb.has(x)).sort((x, y) => cb.get(y)! + ca.get(y)! - (cb.get(x)! + ca.get(x)!));
  const shared = new Set(sharedArtists);
  const inB = new Set(b.map((t) => t.track_id));
  const sharedTracks = a.filter((t) => inB.has(t.track_id)).map((t) => t.track_id);
  const cover = (list: AffinityTrack[]) => list.filter((t) => shared.has(t.artist)).length / list.length;
  const score = Math.round(100 * (0.5 * cosine(familyShares(a), familyShares(b)) + 0.5 * Math.sqrt(cover(a) * cover(b))));
  const meeting = familyShares([...a.filter((t) => shared.has(t.artist)), ...b.filter((t) => shared.has(t.artist))]);
  const meetingFamily = [...meeting].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  return { score, sharedTracks, sharedArtists, meetingFamily };
}

/** Ressemblance entre deux bacs (0 à 1) : artistes en commun et genres proches. */
export function bacSimilarity(a: AffinityTrack[], b: AffinityTrack[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a.map((t) => t.artist));
  const sb = new Set(b.map((t) => t.artist));
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const jaccard = inter / (sa.size + sb.size - inter);
  return 0.5 * Math.min(1, jaccard * 4) + 0.5 * cosine(familyShares(a), familyShares(b));
}
