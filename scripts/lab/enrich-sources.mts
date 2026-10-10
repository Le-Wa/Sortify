// Banc d'essai — sources d'enrichissement alternatives sur des titres sans tag (lecture seule).
// Usage : npm run try scripts/lab/enrich-sources.mts <dossier sortie>
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, responseText } from "@/lib/claude";
import { db } from "@/lib/db";
import { trackTags } from "@/lib/enrichment/lastfm";
import { spotify } from "@/lib/spotify/client";

const out = process.argv[2];
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const { data: rows } = await db().from("likes").select("track_id, title, artists, isrc, released_year").eq("member_id", m).eq("genres", "{}");
const sample = (rows ?? []).sort(() => Math.random() - 0.5).slice(0, 60) as { track_id: string; title: string; artists: string[]; isrc: string | null; released_year: number | null }[];
console.log("échantillon sans tag :", sample.length);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const result: Record<string, Record<string, string[]>> = {};
const put = (src: string, id: string, tags: string[]) => ((result[src] ??= {})[id] = tags);

// 1. Last.fm, tags du titre
for (const t of sample) put("lastfm_titre", t.track_id, (await trackTags(t.artists[0] ?? "", t.title)) ?? []);

// 2. Deezer, genres de l'album (via ISRC)
for (const t of sample) {
  let tags: string[] = [];
  if (t.isrc) {
    const tr = (await (await fetch(`https://api.deezer.com/track/isrc:${t.isrc}`)).json()) as { album?: { id?: number } };
    if (tr.album?.id) {
      const al = (await (await fetch(`https://api.deezer.com/album/${tr.album.id}`)).json()) as { genres?: { data: { name: string }[] } };
      tags = al.genres?.data.map((g) => g.name.toLowerCase()) ?? [];
    }
  }
  put("deezer_album", t.track_id, tags);
  await sleep(120);
}

// 3. MusicBrainz, genres/tags de l'enregistrement et de l'artiste (1 requête/s)
const UA = { "User-Agent": "Sortify/2.0 (banc d'essai)" };
for (const t of sample) {
  let tags: string[] = [];
  if (t.isrc) {
    const r = (await (await fetch(`https://musicbrainz.org/ws/2/isrc/${t.isrc}?fmt=json&inc=artist-credits`, { headers: UA })).json()) as {
      recordings?: { id: string }[];
    };
    await sleep(1100);
    const rec = r.recordings?.[0]?.id;
    if (rec) {
      const d = (await (await fetch(`https://musicbrainz.org/ws/2/recording/${rec}?inc=genres+tags+artist-credits&fmt=json`, { headers: UA })).json()) as {
        genres?: { name: string }[];
        tags?: { name: string }[];
      };
      await sleep(1100);
      tags = [...new Set([...(d.genres ?? []), ...(d.tags ?? [])].map((g) => g.name.toLowerCase()))];
    }
  }
  put("musicbrainz", t.track_id, tags);
}

// 4. Spotify, genres des artistes
for (const t of sample) {
  let tags: string[] = [];
  try {
    const tr = await spotify<{ artists: { id: string }[] }>(m, `/tracks/${t.track_id}`);
    const a = await spotify<{ genres?: string[] }>(m, `/artists/${tr.artists[0].id}`);
    tags = a.genres ?? [];
  } catch (e) {
    tags = [`ERREUR ${(e as Error).message.slice(0, 60)}`];
  }
  put("spotify_artiste", t.track_id, tags);
}

// 5. Connaissances de l'IA (Haiku et Sonnet), avec « inconnu » quand elle ne connaît pas
const schema = z.object({ titres: z.array(z.object({ id: z.number().int(), connu: z.boolean(), genres: z.array(z.string()) })) });
for (const model of ["claude-haiku-5-5", "claude-sonnet-5-5"] as const) {
  const lines = sample.map((t, i) => `${i} | ${t.artists.join(", ")} — ${t.title} | ${t.released_year ?? "?"}`).join("\n");
  const msg = await claude().messages.create({
    model,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system:
      "Pour chaque titre, dis si tu connais l'artiste ou le titre (connu) et donne 2 à 5 genres musicaux en anglais, en minuscules, comme des tags Last.fm. Si tu ne connais pas, mets connu=false et devine les genres seulement si le nom ou le titre le suggèrent clairement, sinon une liste vide. N'invente pas.",
    messages: [{ role: "user", content: lines }],
  });
  const parsed = schema.parse(JSON.parse(responseText(msg, model)));
  for (const r of parsed.titres) {
    const t = sample[r.id];
    if (t) put(`ia_${model.includes("haiku") ? "haiku" : "sonnet"}`, t.track_id, r.connu ? r.genres : r.genres.map((g) => `?${g}`));
  }
  console.log(model, "tokens :", msg.usage.input_tokens, "→", msg.usage.output_tokens);
}

writeFileSync(`${out}/enrich-sources.json`, JSON.stringify({ sample, result }, null, 2));
console.log("\nCouverture (titres avec au moins un tag) sur", sample.length, "titres sans tag :");
for (const [src, map] of Object.entries(result)) {
  const vals = Object.values(map);
  const ok = vals.filter((v) => v.length && !v[0].startsWith("ERREUR") && !v[0].startsWith("?")).length;
  const guess = vals.filter((v) => v.length && v[0].startsWith("?")).length;
  const err = vals.filter((v) => v[0]?.startsWith("ERREUR")).length;
  console.log(`  ${src.padEnd(16)} ${ok} sûrs${guess ? `, ${guess} devinés` : ""}${err ? `, ${err} erreurs` : ""}`);
}
console.log("\nExemples :");
for (const t of sample.slice(0, 8)) {
  console.log(`- ${t.artists[0]} — ${t.title}`);
  for (const [src, map] of Object.entries(result)) if (map[t.track_id]?.length) console.log(`    ${src}: ${map[t.track_id].slice(0, 5).join(", ")}`);
}
