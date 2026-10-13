// Banc d'essai, 4e tour (13/10/2026) — ce qui est en ligne sans mesure. Lecture seule (rien d'écrit en base ni dans Spotify).
//   limite        : 5 bacs par titre (2 scènes, 3 transversaux) contre 3 (2 + 2) — échantillon et juge du 11/10.
//   transversaux  : consigne « au moins 3 bacs transversaux à critère net » de l'analyse, contre l'ancienne (bibliothèque de Jérémy).
//   style         : genres Deezer ajoutés quand les tags Last.fm n'ont aucun style.
//   homonymes     : verdict d'homonyme par artiste (un titre vérifié) contre par titre.
// Usage : npm run try -- scripts/lab/algo-bench4.mts <dossier> <phase>
// Les étapes coûteuses sont mises en cache dans <dossier> : relancer une phase ne repaie pas ce qui est déjà fait.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { proposeFiches, RULES, type Fiche } from "@/lib/ai/fiches";
import { sortTracks, type SortFiche, type SortOptions, type Sorted } from "@/lib/ai/sort";
import { listBacs, placeThreshold, sortFichesFor, SURE_THRESHOLD } from "@/lib/bacs";
import { costOf } from "@/lib/ai-cost";
import { claude, responseText } from "@/lib/claude";
import { loadCorpus, trackLine, type CorpusTrack } from "@/lib/corpus";
import { db } from "@/lib/db";
import { deezerGenres } from "@/lib/enrichment/deezer";
import { contradicts, hasStyle } from "@/lib/enrichment/families";

const [out, phase] = process.argv.slice(2);
if (!out || !phase) throw new Error("Usage : algo-bench4.mts <dossier> <limite|transversaux|style|homonymes>");
const OPUS = "claude-opus-5-5";
const LOW = 0.4;
const ref = "docs/bench/2026-10-11";

// ── Coût : chaque appel du banc est compté ici.
let spent = 0;
const track = (model: string, usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) => {
  spent += costOf(model, { input: usage.input_tokens, output: usage.output_tokens, cacheRead: usage.cache_read_input_tokens ?? 0, cacheWrite: usage.cache_creation_input_tokens ?? 0 });
};
const sortCost = (u: { input: number; output: number }) => (spent += (u.input * 2 + u.output * 10) / 1e6);

const cached = async <T,>(name: string, make: () => Promise<T>): Promise<T> => {
  const path = `${out}/${name}.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as T;
  const value = await make();
  writeFileSync(path, JSON.stringify(value, null, 1));
  return value;
};

const { data: members } = await db().from("members").select("spotify_id, display_name").order("created_at");
const walid = members![0];
const jeremy = members![1];

// ── Juge : Opus 5.5 effort élevé, 0 à 3 bacs par titre (comme le 11/10).
const judgeSchema = z.object({ titres: z.array(z.object({ id: z.number().int(), bacs: z.array(z.number().int()) })) });
const block = (fiches: SortFiche[]) =>
  fiches
    .map((x, i) => [`### Bac ${i + 1} — ${x.name} (${x.axis})`, x.brief, x.examples.length ? `Exemples : ${x.examples.join(" ; ")}` : "", x.counterExamples?.length ? `N'y vont pas : ${x.counterExamples.join(" ; ")}` : ""].filter(Boolean).join("\n"))
    .join("\n\n");
async function judge(fiches: SortFiche[], tracks: CorpusTrack[]): Promise<Map<string, Set<number>>> {
  const res = new Map<string, Set<number>>();
  const BATCH = 25;
  await Promise.all(
    Array.from({ length: Math.ceil(tracks.length / BATCH) }, (_, k) => k * BATCH).map(async (start) => {
      const chunk = tracks.slice(start, start + BATCH);
      const msg = await claude().messages.create({
        model: OPUS,
        max_tokens: 16000,
        output_config: { effort: "high", format: zodOutputFormat(judgeSchema) },
        system: `Tu es un disquaire exigeant. Voici les bacs (playlists) d'une personne :\n\n${block(fiches)}\n\nPour chaque titre, donne les numéros des bacs où il a clairement sa place selon les fiches (0 à 3) : son bac de scène s'il en a un, et les bacs d'ambiance ou de moment où il colle aussi. Liste vide si aucun bac ne lui convient vraiment (il ira dans « Divers »). Sois rigoureux : un titre ne va dans un bac que si un connaisseur qui lit la fiche l'y mettrait sans hésiter. Méfie-toi des tags : ce sont souvent ceux de l'artiste, parfois faux ; les tags « deezer: » sont les genres de l'album sur Deezer, grossiers mais propres au disque. Format : numéro | artistes — titre | année | tags | én da va ac.`,
        messages: [{ role: "user", content: chunk.map((t, i) => trackLine(t, start + i)).join("\n") }],
      });
      track(OPUS, msg.usage);
      for (const r of judgeSchema.parse(JSON.parse(responseText(msg, "Juge"))).titres) {
        const t = tracks[r.id];
        if (t) res.set(t.track_id, new Set(r.bacs.filter((b) => b >= 1 && b <= fiches.length).map((b) => b - 1)));
      }
    }),
  );
  return res;
}

/** Vérification oui / non de placements précis (au-delà des 3 bacs que le juge peut donner). */
const verifySchema = z.object({ verdicts: z.array(z.object({ id: z.number().int(), ok: z.boolean() })) });
async function verify(fiches: SortFiche[], pairs: { t: CorpusTrack; bac: number }[]): Promise<boolean[]> {
  const out: boolean[] = new Array(pairs.length).fill(false);
  const BATCH = 30;
  await Promise.all(
    Array.from({ length: Math.ceil(pairs.length / BATCH) }, (_, k) => k * BATCH).map(async (start) => {
      const chunk = pairs.slice(start, start + BATCH);
      const msg = await claude().messages.create({
        model: OPUS,
        max_tokens: 8000,
        output_config: { effort: "high", format: zodOutputFormat(verifySchema) },
        system: `Tu es un disquaire exigeant. Voici les bacs (playlists) d'une personne :\n\n${block(fiches)}\n\nPour chaque ligne « titre → bac », réponds ok = true seulement si un connaisseur qui lit la fiche mettrait ce titre dans ce bac sans hésiter (un titre peut avoir sa place dans plusieurs bacs). Méfie-toi des tags, souvent ceux de l'artiste. Format : numéro | artistes — titre | année | tags | én da va ac → bac.`,
        messages: [{ role: "user", content: chunk.map((p, i) => `${trackLine(p.t, start + i)} → ${fiches[p.bac].name}`).join("\n") }],
      });
      track(OPUS, msg.usage);
      for (const v of verifySchema.parse(JSON.parse(responseText(msg, "Vérification"))).verdicts) if (v.id - start >= 0 && v.id - start < chunk.length) out[v.id] = v.ok;
    }),
  );
  return out;
}

// ── Décision comme dans l'app (tri) : rangé si le meilleur bac atteint 0,6, puis chaque bac au-dessus de son seuil
// (0,5 pour une scène, 0,6 pour un transversal) ; 0,4–0,6 À trier ; sinon Divers.
const placedOf = (s: Sorted, fiches: SortFiche[]) =>
  (s.suggestions[0]?.confidence ?? 0) >= SURE_THRESHOLD ? s.suggestions.filter((x) => x.confidence >= placeThreshold(fiches[x.bac].axis)).map((x) => x.bac) : [];
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

function score(sorted: Sorted[], fiches: SortFiche[], gold: Map<string, Set<number>>) {
  const trans = (b: number) => fiches[b].axis !== "scène";
  let placed = 0, pending = 0, div = 0, multi = 0, four = 0, withT = 0, bacsSum = 0, top1 = 0, top1N = 0;
  let tp = 0, pairs = 0, tpS = 0, pS = 0, tpT = 0, pT = 0, goldPairs = 0, found = 0;
  for (const s of sorted) {
    const g = gold.get(s.track_id) ?? new Set<number>();
    const top = s.suggestions[0]?.confidence ?? 0;
    const pl = placedOf(s, fiches);
    if (pl.length) placed++;
    else if (top >= LOW) pending++;
    else div++;
    if (pl.length > 1) multi++;
    if (pl.length >= 4) four++;
    if (pl.some(trans)) withT++;
    bacsSum += pl.length;
    if (g.size && s.suggestions[0]) {
      top1N++;
      if (g.has(s.suggestions[0].bac)) top1++;
    }
    for (const b of pl) {
      pairs++;
      if (g.has(b)) tp++;
      if (trans(b)) {
        pT++;
        if (g.has(b)) tpT++;
      } else {
        pS++;
        if (g.has(b)) tpS++;
      }
    }
    goldPairs += g.size;
    const cand = s.suggestions.filter((x) => x.confidence >= LOW).map((x) => x.bac);
    found += [...g].filter((b) => cand.includes(b)).length;
  }
  const N = sorted.length;
  return {
    rangés: pct(placed, N), àTrier: pct(pending, N), divers: pct(div, N), "2+bacs": pct(multi, N), "4+bacs": pct(four, N), avecTransversal: pct(withT, N),
    bacsParRangé: placed ? Math.round((bacsSum / placed) * 100) / 100 : 0, top1: pct(top1, top1N), précision: pct(tp, pairs), précisionScène: pct(tpS, pS), précisionTransversal: pct(tpT, pT), rappel: pct(found, goldPairs),
  };
}

async function sortWith(name: string, fiches: SortFiche[], tracks: CorpusTrack[], opts: SortOptions = {}): Promise<Sorted[]> {
  return cached(name, async () => {
    const usage = { input: 0, output: 0 };
    const sorted = await sortTracks(fiches, tracks, undefined, { ...opts, usage });
    sortCost(usage);
    return sorted;
  });
}

const report: Record<string, unknown> = {};

// ═══ A. Limite de 5 bacs par titre ═══════════════════════════════════════════════
if (phase === "limite") {
  const setup = JSON.parse(readFileSync(`${ref}/algo-bench3-setup.json`, "utf8")) as { refreshed16: SortFiche[] };
  const fiches = setup.refreshed16;
  const gold = new Map(Object.entries(JSON.parse(readFileSync(`${ref}/algo-bench3-gold.json`, "utf8")) as Record<string, number[]>).map(([k, v]) => [k, new Set(v)]));
  const { sampleIds, probeIds } = JSON.parse(readFileSync(`${ref}/echantillon.json`, "utf8")) as { sampleIds: string[]; probeIds: string[] };
  const corpus = await loadCorpus(walid.spotify_id);
  const byId = new Map(corpus.map((t) => [t.track_id, t]));
  // Genres d'aujourd'hui (Deezer déjà substitué aux homonymes) : ce que l'app range vraiment.
  // La sonde (homonymes) ne concerne pas la limite : échantillon de 200 seulement.
  void probeIds;
  const tracks = sampleIds.map((id) => byId.get(id)).filter((t): t is CorpusTrack => Boolean(t));
  console.log(`Échantillon : ${tracks.length} titres, ${fiches.length} bacs`);

  const runs = {
    "3 bacs (2 scènes + 2 transversaux), passage 1": await sortWith("limite-3a", fiches, tracks, { maxTransversal: 2, maxPerTrack: 3 }),
    "3 bacs, passage 2": await sortWith("limite-3b", fiches, tracks, { maxTransversal: 2, maxPerTrack: 3 }),
    "5 bacs (2 scènes + 3 transversaux), passage 1": await sortWith("limite-5a", fiches, tracks),
    "5 bacs, passage 2": await sortWith("limite-5b", fiches, tracks),
  };
  const rows: Record<string, unknown> = {};
  for (const [name, sorted] of Object.entries(runs)) rows[name] = score(sorted, fiches, gold);
  console.table(rows);

  // Le juge ne donne que 3 bacs : les placements en plus (3e transversal, 4e et 5e bac) sont vérifiés un par un.
  const extra: { t: CorpusTrack; bac: number }[] = [];
  for (const run of [runs["5 bacs (2 scènes + 3 transversaux), passage 1"], runs["5 bacs, passage 2"]]) {
    for (const s of run) {
      const pl = placedOf(s, fiches);
      const trans = pl.filter((b) => fiches[b].axis !== "scène");
      const beyond = pl.length > 3 ? pl.slice(3) : [];
      const third = trans.length > 2 ? [trans[2]] : [];
      for (const b of new Set([...beyond, ...third])) extra.push({ t: byId.get(s.track_id)!, bac: b });
    }
  }
  const verdicts = extra.length ? await cached("limite-verif", () => verify(fiches, extra)) : [];
  const ok = verdicts.filter(Boolean).length;
  console.log(`Placements au-delà de l'ancienne limite (2 passages) : ${extra.length}, validés par le juge : ${ok} (${pct(ok, extra.length)} %)`);
  for (const [i, p] of extra.entries()) console.log(`  ${verdicts[i] ? "✓" : "✗"} ${p.t.artists[0]} — ${p.t.title} → ${fiches[p.bac].name}`);
  report.limite = { rows, extra: extra.length, extraOk: ok };
}

// ═══ B. Consigne « au moins 3 bacs transversaux » de l'analyse ═══════════════════
if (phase === "transversaux") {
  // Bibliothèque de Jérémy (la consigne vise les nouveaux membres), échantillon régulier de 450 titres pour borner le coût.
  const full = await loadCorpus(jeremy.spotify_id);
  const step = full.length / 450;
  const corpus = Array.from({ length: Math.min(450, full.length) }, (_, i) => full[Math.floor(i * step)]);
  const OLD_RULES = RULES.replace(
    /- Deux familles :[^\n]*\n- Un bac transversal doit avoir[^\n]*\n/,
    "- Mélange les trois axes : environ deux tiers de bacs « scène », et au moins deux bacs « ambiance » ou « moment » qui traversent plusieurs scènes (un même titre de rap, d'électro ou de soul peut y aller). Ce sont eux qui permettent à un titre de vivre dans plusieurs bacs, et c'est ce que la personne veut.\n",
  );
  if (OLD_RULES === RULES) throw new Error("Ancienne consigne non reconstituée");
  const toSort = (fiches: Fiche[]): SortFiche[] =>
    fiches.map((f) => ({ name: f.name, axis: f.axis, brief: f.brief, examples: f.examples.map((i) => corpus[i]).filter(Boolean).map((t) => `${t.artists[0]} — ${t.title}`), counterExamples: [] }));
  const timed = async (rules?: string) => {
    const t0 = Date.now();
    const before = spent;
    const fiches = await proposeFiches(corpus, rules ? { rules } : {});
    // proposeFiches ne rend pas l'usage : coût estimé (entrée ~62 tokens / titre au tarif Fable, sortie mesurée à part impossible).
    spent = before + (corpus.length * 62 * 10) / 1e6 + 0.9;
    return { fiches, seconds: Math.round((Date.now() - t0) / 1000) };
  };
  const sets = {
    ancienne: await cached("transversaux-fiches-ancienne", () => timed(OLD_RULES)),
    actuelle: await cached("transversaux-fiches-actuelle", () => timed()),
  };
  // 200 titres à ranger ; le juge vérifie un par un les placements dans les bacs transversaux (l'objet de la consigne).
  const sub = corpus.filter((_, i) => i % 5 < 2).slice(0, 200);
  const rows: Record<string, unknown> = {};
  for (const [name, set] of Object.entries(sets)) {
    const fiches = toSort(set.fiches);
    console.log(`\n${name} (${set.seconds} s) : ${fiches.map((f) => `${f.name} [${f.axis}]`).join(" · ")}`);
    const sorted = await sortWith(`transversaux-tri-${name}`, fiches, sub);
    const byTrack = new Map(sub.map((t) => [t.track_id, t]));
    const pairs = sorted.flatMap((s) => placedOf(s, fiches).filter((b) => fiches[b].axis !== "scène").map((bac) => ({ t: byTrack.get(s.track_id)!, bac })));
    const verdicts = await cached(`transversaux-verif-${name}`, () => verify(fiches, pairs));
    const lines = fiches
      .map((f, b) => ({ f, b }))
      .filter(({ f }) => f.axis !== "scène")
      .map(({ f, b }) => {
        const holders = sorted.filter((s) => placedOf(s, fiches).includes(b));
        const scenes = new Set(holders.flatMap((s) => placedOf(s, fiches).filter((x) => fiches[x].axis === "scène")));
        const mine = pairs.map((p, i) => ({ p, ok: verdicts[i] })).filter(({ p }) => p.bac === b);
        return `  ${f.name} : ${holders.length} titres, ${scenes.size} scènes, ${pct(mine.filter((x) => x.ok).length, mine.length)} % validés — ${f.brief.split("\n")[0].slice(0, 110)}`;
      });
    console.log(lines.join("\n"));
    const placed = sorted.filter((x) => placedOf(x, fiches).length > 0).length;
    rows[name] = {
      bacs: fiches.length,
      transversaux: fiches.filter((f) => f.axis !== "scène").length,
      rangés: pct(placed, sorted.length),
      "2+bacs": pct(sorted.filter((x) => placedOf(x, fiches).length > 1).length, sorted.length),
      avecTransversal: pct(sorted.filter((x) => placedOf(x, fiches).some((b) => fiches[b].axis !== "scène")).length, sorted.length),
      placementsTransversaux: pairs.length,
      précisionTransversal: pct(verdicts.filter(Boolean).length, pairs.length),
    };
  }
  console.table(rows);
  report.transversaux = rows;
}

// ═══ C. Genres Deezer pour les tags sans style ═══════════════════════════════════
if (phase === "style") {
  const rows: Record<string, unknown> = {};
  for (const m of [walid, jeremy]) {
    const corpus = await loadCorpus(m.spotify_id);
    const { data: isrcs } = await db().from("likes").select("track_id, isrc").eq("member_id", m.spotify_id);
    const isrcOf = new Map((isrcs ?? []).map((r) => [r.track_id, r.isrc as string | null]));
    const lastfm = (t: CorpusTrack) => t.genres.filter((g) => !g.startsWith("deezer:"));
    // 120 titres au plus par membre (coût du juge).
    const all = corpus.filter((t) => lastfm(t).length > 0 && !hasStyle(lastfm(t)));
    const targets = all.slice(0, 120);
    const dz = await cached(`style-deezer-${m.display_name}`, async () => {
      const res: Record<string, string[]> = {};
      for (const t of targets) res[t.track_id] = await deezerGenres(isrcOf.get(t.track_id) ?? null);
      return res;
    });
    const without = targets.map((t) => ({ ...t, genres: lastfm(t) }));
    const withDz = targets.map((t) => ({ ...t, genres: [...lastfm(t), ...(dz[t.track_id] ?? [])] }));
    const gained = withDz.filter((t, i) => t.genres.length > without[i].genres.length).length;
    console.log(`${m.display_name} : ${all.length} titres aux tags sans style (${pct(all.length, corpus.length)} %) ; sur les ${targets.length} mesurés, Deezer ajoute des genres à ${gained}`);
    if (targets.length === 0) continue;
    const fiches = await sortFichesFor(await listBacs(m.spotify_id, ["active"]));
    const gold = await cached(`style-juge-${m.display_name}`, async () => Object.fromEntries([...(await judge(fiches, withDz))].map(([k, v]) => [k, [...v]])));
    const g = new Map(Object.entries(gold).map(([k, v]) => [k, new Set(v)]));
    rows[`${m.display_name} — Last.fm seul`] = score(await sortWith(`style-sans-${m.display_name}`, fiches, without), fiches, g);
    rows[`${m.display_name} — + Deezer`] = score(await sortWith(`style-avec-${m.display_name}`, fiches, withDz), fiches, g);
  }
  console.table(rows);
  report.style = rows;
}

// ═══ D. Homonymes vérifiés par artiste plutôt que par titre ══════════════════════
if (phase === "homonymes") {
  const rows: Record<string, unknown> = {};
  for (const m of [walid, jeremy]) {
    const corpus = await loadCorpus(m.spotify_id);
    const { data: likeRows } = await db().from("likes").select("track_id, isrc, artists").eq("member_id", m.spotify_id);
    const isrcOf = new Map((likeRows ?? []).map((r) => [r.track_id, r.isrc as string | null]));
    const artistOf = new Map((likeRows ?? []).map((r) => [r.track_id, (r.artists as string[])[0] ?? ""]));
    const count = new Map<string, number>();
    for (const a of artistOf.values()) count.set(a, (count.get(a) ?? 0) + 1);
    const artists = [...count].filter(([a, n]) => n >= 2 && a).map(([a]) => a);
    const tagRows: { artist: string; tags: string[]; homonym: boolean | null }[] = [];
    for (let i = 0; i < artists.length; i += 200) {
      const { data } = await db().from("artist_tags").select("artist, tags, homonym").in("artist", artists.slice(i, i + 200).filter((a) => !a.includes('"')));
      tagRows.push(...((data ?? []) as typeof tagRows));
    }
    const tagsOf = new Map(tagRows.filter((r) => hasStyle(r.tags)).map((r) => [r.artist, r]));
    // Titres concernés : artiste avec un style chez Last.fm et au moins 2 likes (sinon par artiste = par titre).
    const targets = corpus.filter((t) => tagsOf.has(artistOf.get(t.track_id) ?? ""));
    const dz = await cached(`homonymes-deezer-${m.display_name}`, async () => {
      const res: Record<string, string[]> = {};
      let n = 0;
      for (const t of targets) {
        res[t.track_id] = await deezerGenres(isrcOf.get(t.track_id) ?? null);
        if (++n % 200 === 0) console.log(`  Deezer ${n} / ${targets.length}`);
      }
      return res;
    });
    // Genres selon chaque règle.
    const diff: { perArtist: CorpusTrack; perTrack: CorpusTrack }[] = [];
    let unknown = 0, artistYes = 0, trackYes = 0;
    for (const t of targets) {
      const a = tagsOf.get(artistOf.get(t.track_id)!)!;
      const d = dz[t.track_id] ?? [];
      if (a.homonym === null) {
        unknown++;
        continue;
      }
      const titleSays = d.length > 0 && contradicts(a.tags, d);
      if (a.homonym) artistYes++;
      if (titleSays) trackYes++;
      const g = (homonym: boolean) => (homonym ? d : a.tags);
      // Par titre : sans genres Deezer pour ce titre, on garde Last.fm.
      const byTrack = d.length > 0 ? titleSays : false;
      if (a.homonym !== byTrack) diff.push({ perArtist: { ...t, genres: g(a.homonym) }, perTrack: { ...t, genres: g(byTrack) } });
    }
    console.log(`${m.display_name} : ${targets.length} titres d'artistes à 2+ likes ; verdict inconnu ${unknown} ; homonyme par artiste ${artistYes}, par titre ${trackYes} ; règles en désaccord sur ${diff.length} titres (${pct(diff.length, corpus.length)} % de la bibliothèque)`);
    if (diff.length === 0) continue;
    diff.splice(120);
    const fiches = await sortFichesFor(await listBacs(m.spotify_id, ["active"]));
    // Le juge voit les deux jeux de tags.
    const both = diff.map((d) => ({ ...d.perArtist, genres: [...new Set([...d.perArtist.genres, ...d.perTrack.genres])] }));
    const gold = await cached(`homonymes-juge-${m.display_name}`, async () => Object.fromEntries([...(await judge(fiches, both))].map(([k, v]) => [k, [...v]])));
    const g = new Map(Object.entries(gold).map(([k, v]) => [k, new Set(v)]));
    rows[`${m.display_name} — par artiste (en ligne)`] = score(await sortWith(`homonymes-artiste-${m.display_name}`, fiches, diff.map((d) => d.perArtist)), fiches, g);
    rows[`${m.display_name} — par titre`] = score(await sortWith(`homonymes-titre-${m.display_name}`, fiches, diff.map((d) => d.perTrack)), fiches, g);
    for (const d of diff.slice(0, 12)) console.log(`  ${d.perArtist.artists[0]} — ${d.perArtist.title} | artiste: ${d.perArtist.genres.slice(0, 3).join(", ")} | titre: ${d.perTrack.genres.slice(0, 3).join(", ")}`);
  }
  console.table(rows);
  report.homonymes = rows;
}

writeFileSync(`${out}/rapport-${phase}.json`, JSON.stringify(report, null, 1));
console.log(`\nCoût de cette exécution : ~${spent.toFixed(2)} $ (hors étapes déjà en cache)`);
