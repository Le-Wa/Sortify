// Fenêtre d'import : répartition des likes par année d'ajout (Spotify, lecture seule) et par année de sortie (base).
// Usage : npm run try -- scripts/lab/import-window.mts
import { db } from "@/lib/db";
import { spotify } from "@/lib/spotify/client";
import type { SavedTracksPage } from "@/lib/import";

const { data: members, error } = await db().from("members").select("spotify_id, display_name");
if (error) throw new Error(error.message);
for (const m of members ?? []) {
  const byYear = new Map<number, number>();
  const releasedBefore2021 = new Map<number, [number, number]>();
  let url: string | null = "/me/tracks?limit=50";
  let total = 0;
  const dates: number[] = [];
  while (url) {
    const page: SavedTracksPage & { total?: number } = await spotify<SavedTracksPage & { total?: number }>(m.spotify_id, url);
    total = page.total ?? total;
    for (const it of page.items) {
      if (!it.track?.id) continue;
      const y = new Date(it.added_at).getUTCFullYear();
      dates.push(Date.parse(it.added_at));
      byYear.set(y, (byYear.get(y) ?? 0) + 1);
      const rel = Number(it.track.album.release_date?.slice(0, 4));
      const [old, all] = releasedBefore2021.get(y) ?? [0, 0];
      releasedBefore2021.set(y, [old + (rel && rel < 2021 ? 1 : 0), all + 1]);
    }
    url = page.next;
  }
  // Likes cumulés en remontant le temps depuis aujourd'hui, par tranche de 12 mois.
  const now = Date.now();
  console.log(`\n${m.display_name} : ${total} likes au total`);
  console.log([...byYear].sort((a, b) => b[0] - a[0]).map(([y, n]) => `${y}: ${n}`).join(" · "));
  console.log("sortis avant 2021 par année d'ajout :", [...releasedBefore2021].sort((a, b) => b[0] - a[0]).map(([y, [o, a]]) => `${y}: ${Math.round((100 * o) / a)}%`).join(" · "));
  const months = (k: number) => dates.filter((d) => d >= now - k * 30.44 * 86_400_000).length;
  console.log("fenêtres glissantes :", [6, 12, 24, 36, 48, 60, 84].map((k) => `${k} mois: ${months(k)}`).join(" · "));
  const sorted = [...dates].sort((a, b) => b - a);
  for (const n of [500, 1000, 1500]) console.log(`${n} derniers likes : depuis ${new Date(sorted[Math.min(n, sorted.length) - 1]).toISOString().slice(0, 10)}`);
  for (const target of [300, 500, 1000]) {
    let k = 24;
    while (months(k) < target && k < 240) k += 12;
    console.log(`élargir par année jusqu'à ${target} : ${k} mois → ${months(k)} likes`);
  }
}
