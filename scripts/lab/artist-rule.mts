// Règle « artiste sûr » (13/10/2026) — essai à blanc, lecture seule.
// Un artiste est « sûr » quand au moins MIN de ses titres sont dans UN bac de scène actif et aucun dans un autre bac de scène :
// ses titres restés dans Divers iraient dans ce bac.
//   1. Mesure gratuite : sur les titres déjà rangés en scène, la règle (calculée sans le titre lui-même) retrouve-t-elle son bac ?
//   2. Essai à blanc sur Divers : combien de titres bougeraient, vers quels bacs ; chaque déplacement vérifié par le juge (Opus).
// Usage : npm run try -- scripts/lab/artist-rule.mts <dossier> [MIN=3]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, responseText } from "@/lib/claude";
import { ensureDivers, listBacs, sortFichesFor } from "@/lib/bacs";
import { loadCorpus, trackLine, type CorpusTrack } from "@/lib/corpus";
import { db } from "@/lib/db";

const out = process.argv[2];
const MIN = Number(process.argv[3] ?? 3);
if (!out) throw new Error("Usage : artist-rule.mts <dossier> [MIN]");
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

async function all<T>(query: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

const { data: members } = await db().from("members").select("spotify_id, display_name").order("created_at");
const report: Record<string, unknown> = {};
for (const m of members ?? []) {
  const bacs = await listBacs(m.spotify_id, ["active"]);
  const scene = new Set(bacs.filter((b) => !b.is_divers && b.axis === "scène").map((b) => b.id));
  const divers = await ensureDivers(m.spotify_id);
  const corpus = await loadCorpus(m.spotify_id);
  const byId = new Map(corpus.map((t) => [t.track_id, t]));
  const artistOf = (id: string) => byId.get(id)?.artists[0] ?? "";
  const placements = await all<{ bac_id: string; track_id: string }>((from) =>
    db().from("placements").select("bac_id, track_id").eq("member_id", m.spotify_id).range(from, from + 999),
  );
  // Par artiste : nombre de titres dans chaque bac de scène.
  const byArtist = new Map<string, Map<string, Set<string>>>();
  for (const p of placements) {
    if (!scene.has(p.bac_id)) continue;
    const a = artistOf(p.track_id);
    if (!a) continue;
    const m2 = byArtist.get(a) ?? new Map<string, Set<string>>();
    m2.set(p.bac_id, (m2.get(p.bac_id) ?? new Set()).add(p.track_id));
    byArtist.set(a, m2);
  }
  /** Bac « sûr » de l'artiste, en ignorant éventuellement un titre (validation croisée). */
  const sureBac = (artist: string, without?: string): string | null => {
    const per = byArtist.get(artist);
    if (!per) return null;
    const counts = [...per].map(([bac, ids]) => [bac, [...ids].filter((id) => id !== without).length] as const).filter(([, n]) => n > 0);
    return counts.length === 1 && counts[0][1] >= MIN ? counts[0][0] : null;
  };

  // 1. Validation croisée sur les titres déjà en scène.
  const sceneTracks = [...new Set(placements.filter((p) => scene.has(p.bac_id)).map((p) => p.track_id))];
  let predicted = 0, right = 0;
  for (const id of sceneTracks) {
    const guess = sureBac(artistOf(id), id);
    if (!guess) continue;
    predicted++;
    if (placements.some((p) => p.track_id === id && p.bac_id === guess)) right++;
  }

  // 2. Essai à blanc sur Divers.
  const diversIds = new Set(placements.filter((p) => p.bac_id === divers.id).map((p) => p.track_id));
  const moves = [...diversIds].map((id) => ({ id, bac: sureBac(artistOf(id)) })).filter((x): x is { id: string; bac: string } => Boolean(x.bac));
  const name = (id: string) => bacs.find((b) => b.id === id)?.name ?? id;
  const perBac = new Map<string, number>();
  for (const x of moves) perBac.set(name(x.bac), (perBac.get(name(x.bac)) ?? 0) + 1);

  // Juge : chaque déplacement, oui / non, avec les fiches du membre.
  const fiches = await sortFichesFor(bacs.filter((b) => !b.is_divers));
  const idx = new Map(bacs.filter((b) => !b.is_divers).map((b, i) => [b.id, i]));
  const path = `${out}/artiste-verif-${m.display_name}-${MIN}.json`;
  let verdicts: boolean[];
  if (existsSync(path)) verdicts = JSON.parse(readFileSync(path, "utf8")) as boolean[];
  else {
    const schema = z.object({ verdicts: z.array(z.object({ id: z.number().int(), ok: z.boolean() })) });
    const block = fiches.map((f, i) => `### Bac ${i + 1} — ${f.name} (${f.axis})\n${f.brief}${f.examples.length ? `\nExemples : ${f.examples.join(" ; ")}` : ""}`).join("\n\n");
    verdicts = new Array(moves.length).fill(false);
    const BATCH = 30;
    await Promise.all(
      Array.from({ length: Math.ceil(moves.length / BATCH) }, (_, k) => k * BATCH).map(async (start) => {
        const chunk = moves.slice(start, start + BATCH);
        const msg = await claude().messages.create({
          model: "claude-opus-5-5",
          max_tokens: 8000,
          output_config: { effort: "high", format: zodOutputFormat(schema) },
          system: `Tu es un disquaire exigeant. Voici les bacs (playlists) d'une personne :\n\n${block}\n\nPour chaque ligne « titre → bac », réponds ok = true seulement si un connaisseur qui lit la fiche mettrait ce titre dans ce bac sans hésiter. Méfie-toi des tags, souvent ceux de l'artiste. Format : numéro | artistes — titre | année | tags | én da va ac → bac.`,
          messages: [{ role: "user", content: chunk.map((x, i) => `${trackLine(byId.get(x.id) as CorpusTrack, start + i)} → ${fiches[idx.get(x.bac)!].name}`).join("\n") }],
        });
        for (const v of schema.parse(JSON.parse(responseText(msg, "Vérification"))).verdicts) if (v.id >= start && v.id < start + chunk.length) verdicts[v.id] = v.ok;
      }),
    );
    writeFileSync(path, JSON.stringify(verdicts));
  }
  const ok = verdicts.filter(Boolean).length;
  const row = {
    "validation croisée": `${predicted} titres prédits, ${pct(right, predicted)} % dans le bon bac`,
    divers: diversIds.size,
    déplacés: `${moves.length} (${pct(moves.length, diversIds.size)} % de Divers)`,
    "validés par le juge": `${ok} (${pct(ok, moves.length)} %)`,
    "par bac": Object.fromEntries([...perBac].sort((a, b) => b[1] - a[1])),
  };
  report[m.display_name ?? m.spotify_id] = row;
  console.log(`\n${m.display_name} (MIN = ${MIN})`, JSON.stringify(row, null, 1));
  const refused = moves.map((x, i) => ({ x, ok: verdicts[i] })).filter((v) => !v.ok).slice(0, 10);
  for (const { x } of refused) console.log(`  ✗ ${byId.get(x.id)?.artists[0]} — ${byId.get(x.id)?.title} → ${name(x.bac)}`);
}
writeFileSync(`${out}/artiste-rapport-${MIN}.json`, JSON.stringify(report, null, 1));
