// Vérifie que chaque playlist Spotify correspond aux placements en base (nombre, contenu, plus récents en haut).
import { db } from "@/lib/db";
import { spotify } from "@/lib/spotify/client";

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const { data: bacs } = await db().from("bacs").select("id, name, spotify_playlist_id").eq("member_id", m).eq("status", "active").order("position");
let ok = 0;
for (const b of bacs ?? []) {
  const ids: string[] = [];
  let url: string | null = `/playlists/${b.spotify_playlist_id}/items?limit=100&fields=next,items(item(id))`;
  while (url) {
    const page: { next: string | null; items: { item: { id: string } | null }[] } = await spotify(m, url);
    ids.push(...page.items.map((i) => i.item?.id ?? "").filter(Boolean));
    url = page.next;
  }
  const { data: rows } = await db().from("likes").select("track_id, liked_at, placements!inner(bac_id)").eq("member_id", m).eq("placements.bac_id", b.id).order("liked_at", { ascending: false });
  const expected = (rows ?? []).map((r) => r.track_id);
  const same = expected.length === ids.length && expected.every((id, i) => id === ids[i]);
  if (same) ok++;
  console.log(`${same ? "✓" : "✗"} ${b.name} : base ${expected.length}, Spotify ${ids.length}${same ? "" : `, doublons Spotify ${ids.length - new Set(ids).size}`}`);
}
console.log(`${ok} / ${bacs?.length} playlists identiques à la base, dans l'ordre`);
