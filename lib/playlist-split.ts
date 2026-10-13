import { FAMILY_LABELS } from "./family-labels";

/** Un morceau de playlist découpée doit pouvoir faire un bac. */
const MIN_PART = 15;

export interface PlaylistPart {
  family: string;
  label: string;
  count: number;
}

/**
 * Découpage par famille de genre : chaque titre va dans celle de ses familles la plus présente dans la playlist.
 * Large = au moins 30 titres likés, aucune famille à la moitié, et au moins deux morceaux de 15 titres.
 */
export function splitByFamily(tracks: { track_id: string; families: string[] }[]): { broad: boolean; parts: (PlaylistPart & { ids: string[] })[] } {
  const weight = new Map<string, number>();
  for (const t of tracks) for (const f of t.families) weight.set(f, (weight.get(f) ?? 0) + 1);
  const groups = new Map<string, string[]>();
  for (const t of tracks) {
    const f = [...t.families].sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0))[0];
    if (f) groups.set(f, [...(groups.get(f) ?? []), t.track_id]);
  }
  const parts = [...groups]
    .map(([family, ids]) => ({ family, label: FAMILY_LABELS[family] ?? family, count: ids.length, ids }))
    .filter((p) => p.count >= MIN_PART)
    .sort((a, b) => b.count - a.count);
  const top = Math.max(0, ...[...weight.values()]);
  const broad = tracks.length >= 30 && top / tracks.length < 0.5 && parts.length >= 2;
  return { broad, parts };
}

