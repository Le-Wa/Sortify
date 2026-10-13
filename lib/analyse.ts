import "server-only";
import { complementFiches, proposeFiches } from "./ai/fiches";
import { fillBac, sortTracks } from "./ai/sort";
import { addPlacements, insertFiches, listBacs, replacePlacements, sortFichesFor, SURE_THRESHOLD, type Bac, examplesFor } from "./bacs";
import { loadCorpus, sampleCorpus } from "./corpus";
import { check, db } from "./db";
import { saveProgress, type Job } from "./jobs";
import { librarySize, minPerBac as minPerBacFor, tooSmallMessage } from "./library-size";

export interface AnalyseProgress {
  /** fiches → rangement de tout le corpus → compléter (orphelins) → remplissage des bacs à remplir → done */
  phase: "fiches" | "rangement" | "complement" | "remplissage" | "done";
  sorted: number;
  total: number;
  /** Début de l'étape en cours (ISO) : la jauge avance au temps pendant les longs appels à l'IA. */
  phaseStartedAt?: string;
}

export const initialAnalyse: AnalyseProgress = { phase: "fiches", sorted: 0, total: 0 };
export const fillOnly: AnalyseProgress = { phase: "remplissage", sorted: 0, total: 0 };

const SORT_UNIT = 120;
/** Sous cette couverture, on cherche des bacs parmi les titres restés sans maison (spec 02). */
const TARGET_COVERAGE = 0.85;

export async function runAnalyseStep(job: Job<AnalyseProgress>, deadline: number): Promise<AnalyseProgress> {
  let progress = job.progress;
  if (!progress.phaseStartedAt) {
    progress = { ...progress, phaseStartedAt: new Date().toISOString() };
    await saveProgress(job.id, progress);
  }
  do {
    const before = progress.phase;
    progress = await analyseUnit(job.member_id, progress);
    if (progress.phase !== before) progress = { ...progress, phaseStartedAt: new Date().toISOString() };
    await saveProgress(job.id, progress);
  } while (Date.now() < deadline && progress.phase !== "done");
  return progress;
}

async function analyseUnit(memberId: string, progress: AnalyseProgress): Promise<AnalyseProgress> {
  switch (progress.phase) {
    case "fiches":
      return writeFiches(memberId);
    case "rangement":
      return sortUnit(memberId, progress);
    case "complement":
      return complementUnit(memberId, progress);
    case "remplissage":
      return fillUnit(memberId, progress);
    case "done":
      return progress;
  }
}

async function writeFiches(memberId: string): Promise<AnalyseProgress> {
  const corpus = await loadCorpus(memberId);
  // Message lisible à l'écran d'attente ; « Réessayer » relance alors l'import pour lire les nouveaux likes.
  if (librarySize(corpus.length) === "trop-petite") throw new Error(tooSmallMessage(corpus.length));
  const sample = sampleCorpus(corpus);
  const fiches = await proposeFiches(sample);
  check(await db().from("divers_hints").delete().eq("member_id", memberId), "Effacement des anciens avis");
  // Nouvelle analyse : les propositions précédentes (jamais créées) disparaissent.
  check(
    await db().from("bacs").delete().eq("member_id", memberId).in("status", ["proposed", "removed"]).eq("is_divers", false),
    "Effacement des anciennes propositions",
  );
  const active = await listBacs(memberId, ["active"]);
  await insertFiches(memberId, fiches, sample, {
    startPosition: active.length,
    usedColors: active.map((b) => b.color),
    usedShapes: active.map((b) => b.shape),
    needsFill: false,
  });
  return { phase: "rangement", sorted: 0, total: corpus.length };
}

async function sortUnit(memberId: string, progress: AnalyseProgress): Promise<AnalyseProgress> {
  const corpus = await loadCorpus(memberId);
  const bacs = await listBacs(memberId, ["proposed"]);
  const slice = corpus.slice(progress.sorted, progress.sorted + SORT_UNIT);
  if (slice.length > 0 && bacs.length > 0) {
    const sorted = await sortTracks(await sortFichesFor(bacs), slice);
    // Comme au tri quotidien : un titre dont le meilleur bac reste sous 0,6 n'est pas rangé (il ira dans Divers),
    // sinon une simple supposition (Larusso dans « Rap FR old school » à 0,5) finit dans une playlist.
    await addPlacements(
      memberId,
      sorted
        .filter((s) => (s.suggestions[0]?.confidence ?? 0) >= SURE_THRESHOLD)
        .flatMap((s) => s.suggestions.map((x) => ({ bac_id: bacs[x.bac].id, track_id: s.track_id, confidence: x.confidence }))),
    );
    // Titres qui iront dans Divers : on garde l'avis de l'IA, pour les ranger plus tard sans la redemander.
    const hints = sorted
      .filter((s) => s.suggestions.length > 0 && s.suggestions[0].confidence < SURE_THRESHOLD)
      .map((s) => ({
        member_id: memberId,
        track_id: s.track_id,
        suggestions: s.suggestions.map((x) => ({ bac_id: bacs[x.bac].id, confidence: x.confidence })),
        reason: s.reason || null,
      }));
    if (hints.length > 0) check(await db().from("divers_hints").upsert(hints, { onConflict: "member_id,track_id" }), "Avis gardés pour Divers");
  }
  const done = progress.sorted + slice.length;
  if (done < corpus.length && slice.length > 0) return { ...progress, sorted: done, total: corpus.length };
  await placeExamples(memberId, bacs);
  return { phase: "complement", sorted: done, total: corpus.length };
}

async function complementUnit(memberId: string, progress: AnalyseProgress): Promise<AnalyseProgress> {
  const next: AnalyseProgress = { ...progress, phase: "remplissage" };
  const corpus = await loadCorpus(memberId);
  const bacs = await listBacs(memberId, ["proposed"]);
  const placed = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await db()
        .from("placements")
        .select("track_id")
        .in("bac_id", bacs.map((b) => b.id))
        .range(from, from + 999),
      "Lecture des placements",
    ) as { track_id: string }[];
    for (const r of rows) placed.add(r.track_id);
    if (rows.length < 1000) break;
  }
  const orphans = corpus.filter((t) => !placed.has(t.track_id));
  // Petite bibliothèque : on s'en tient aux 2 ou 3 bacs de l'analyse.
  if (librarySize(corpus.length) !== "normale") return next;
  const minPerBac = minPerBacFor(corpus.length);
  if (orphans.length / corpus.length <= 1 - TARGET_COVERAGE || orphans.length < minPerBac) return next;

  const fiches = await complementFiches(
    orphans,
    bacs.map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis })),
    minPerBac,
  );
  if (fiches.length > 0) {
    await insertFiches(memberId, fiches, orphans, {
      startPosition: bacs.length,
      usedColors: bacs.map((b) => b.color),
      usedShapes: bacs.map((b) => b.shape),
      needsFill: true,
    });
  }
  return next;
}

/** Les titres exemples choisis par l'IA sont toujours dans leur bac. */
async function placeExamples(memberId: string, bacs: Bac[]): Promise<void> {
  const examples = await examplesFor(bacs.map((b) => b.id));
  await addPlacements(
    memberId,
    bacs.flatMap((b) => (examples.get(b.id)?.positive ?? []).map((e) => ({ bac_id: b.id, track_id: e.track_id, confidence: 1 }))),
  );
}

async function fillUnit(memberId: string, progress: AnalyseProgress): Promise<AnalyseProgress> {
  const bacs = await listBacs(memberId, ["proposed", "active"]);
  const target = bacs.find((b) => b.needs_fill);
  if (!target) return { ...progress, phase: "done" };

  const corpus = await loadCorpus(memberId);
  const [fiche] = await sortFichesFor([target]);
  const placements = await fillBac(
    fiche,
    bacs.filter((b) => b.id !== target.id && b.status !== "removed").map((b) => b.name),
    corpus,
  );
  await replacePlacements(memberId, target.id, placements);
  await placeExamples(memberId, [target]);
  check(await db().from("bacs").update({ needs_fill: false }).eq("id", target.id), "Fin du remplissage");
  return progress;
}
