import "server-only";
import { customFiche, type Fiche } from "./ai/fiches";
import type { SortFiche } from "./ai/sort";
import { fillBac } from "./ai/sort";
import { createActiveBac, MAX_ACTIVE_BACS } from "./bac-admin";
import { listBacs, placeThreshold } from "./bacs";
import { loadCorpus, sampleCorpus } from "./corpus";
import { db } from "./db";
import { saveProgress, type Job } from "./jobs";

/** « Nouveau bac » en tâche de fond : fiche par l'IA → recherche des titres dans toute la bibliothèque → playlist. */
export interface NewBacProgress {
  phase: "fiche" | "remplissage" | "playlist" | "done";
  request: string;
  fiche?: Fiche;
  exampleIds?: string[];
  /** Titres déjà écoutés par l'IA, sur le total de la bibliothèque. */
  scanned: number;
  total: number;
  found: { track_id: string; confidence: number }[];
  bac?: { id: string; name: string; count: number };
  /** Début de l'étape en cours : la jauge avance au temps pendant les appels longs. */
  phaseStartedAt?: string;
}

export const newBacProgress = (request: string): NewBacProgress => ({ phase: "fiche", request, scanned: 0, total: 0, found: [] });

/** Titres écoutés par passage : 6 lots de 100 en parallèle, ~20 s. */
const SCAN_UNIT = 600;

export async function runNewBacStep(job: Job<NewBacProgress>, deadline: number): Promise<NewBacProgress> {
  let progress = job.progress;
  if (!progress.phaseStartedAt) progress = { ...progress, phaseStartedAt: new Date().toISOString() };
  do {
    const before = progress.phase;
    progress = await unit(job.member_id, progress);
    if (progress.phase !== before) progress = { ...progress, phaseStartedAt: new Date().toISOString() };
    await saveProgress(job.id, progress);
  } while (Date.now() < deadline && progress.phase !== "done");
  return progress;
}

async function unit(memberId: string, p: NewBacProgress): Promise<NewBacProgress> {
  switch (p.phase) {
    case "fiche": {
      const active = await listBacs(memberId, ["active"]);
      if (active.length >= MAX_ACTIVE_BACS) throw new Error(`Tu as déjà ${active.length} bacs : retires-en un avant d'en créer un autre.`);
      const corpus = await loadCorpus(memberId);
      const sample = sampleCorpus(corpus);
      const fiche = await customFiche(p.request, active.map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis })), sample);
      const exampleIds = fiche.examples.map((k) => sample[k]?.track_id).filter((id): id is string => Boolean(id));
      return { ...p, phase: "remplissage", fiche, exampleIds, total: corpus.length };
    }
    case "remplissage": {
      const fiche = p.fiche;
      if (!fiche) throw new Error("Fiche du nouveau bac perdue");
      const [corpus, active] = await Promise.all([loadCorpus(memberId), listBacs(memberId, ["active"])]);
      const byId = new Map(corpus.map((t) => [t.track_id, t]));
      const sortFiche: SortFiche = {
        name: fiche.name,
        axis: fiche.axis,
        brief: fiche.brief,
        examples: (p.exampleIds ?? []).map((id) => byId.get(id)).filter((t) => t !== undefined).map((t) => `${t.artists[0]} — ${t.title}`),
      };
      const slice = corpus.slice(p.scanned, p.scanned + SCAN_UNIT);
      const found = (await fillBac(sortFiche, active.map((b) => b.name), slice)).filter((t) => t.confidence >= placeThreshold(fiche.axis));
      const scanned = p.scanned + slice.length;
      return { ...p, scanned, total: corpus.length, found: [...p.found, ...found], phase: scanned >= corpus.length || slice.length === 0 ? "playlist" : "remplissage" };
    }
    case "playlist": {
      if (!p.fiche) throw new Error("Fiche du nouveau bac perdue");
      const bac = await createActiveBac(memberId, p.fiche, p.exampleIds ?? [], p.found);
      const { count, error } = await db().from("placements").select("track_id", { count: "exact", head: true }).eq("bac_id", bac.id);
      if (error) throw new Error(`Comptage du nouveau bac : ${error.message}`);
      return { ...p, phase: "done", bac: { id: bac.id, name: bac.name, count: count ?? 0 } };
    }
    case "done":
      return p;
  }
}
