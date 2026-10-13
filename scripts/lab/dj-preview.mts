// Aperçu de l'ordre DJ des bacs d'un membre (lecture seule : Spotify et base, sans IA, rien n'est écrit).
// Usage : npm run try -- scripts/lab/dj-preview.mts [nom du bac]
import { djPreview } from "@/lib/dj";
import { listBacs } from "@/lib/bacs";
import { db } from "@/lib/db";

const only = process.argv[2];
const { data: members } = await db().from("members").select("spotify_id, display_name").order("created_at");
for (const m of members ?? []) {
  for (const bac of await listBacs(m.spotify_id, ["active"])) {
    if (!bac.spotify_playlist_id || (only && bac.name !== only)) continue;
    const p = await djPreview(m.spotify_id, bac.id);
    console.log(`${m.display_name} · ${bac.name} (${p.total}, tempo connu ${p.withTempo}) — bon tempo ${p.before.tempo} → ${p.after.tempo} %, tonalités ${p.before.key} → ${p.after.key} %`);
    if (only) for (const t of p.first) console.log(`   ${String(t.bpm ?? "—").padStart(3)} ${String(t.key ?? "—").padStart(3)} ${t.energy?.toFixed(2) ?? "—"}  ${t.artist} — ${t.title}`);
  }
}
