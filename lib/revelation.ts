import "server-only";
import { fillOnly, initialAnalyse, type AnalyseProgress } from "./analyse";
import { listBacs } from "./bacs";
import { loadCorpus } from "./corpus";
import type { CreationProgress } from "./creation";
import { check, db } from "./db";
import { initialImport, type ImportProgress } from "./import";
import { isStalled, kickJob, latestJob, startJob, type Job } from "./jobs";
import { hasActiveBacs } from "./library";
import { MIN_LIBRARY } from "./library-size";

interface JobView<P> {
  status: "running" | "done" | "failed";
  progress: P;
  error: string | null;
}

export type RevelationState =
  | ({ stage: "import" } & JobView<ImportProgress>)
  | ({ stage: "analyse"; covers: string[] } & JobView<AnalyseProgress>)
  | { stage: "proposition"; filling: boolean; error: string | null }
  | ({ stage: "creation" } & JobView<CreationProgress>)
  | { stage: "done"; creation: CreationProgress | null };

const view = <P>(job: Job<P>): JobView<P> => ({ status: job.status, progress: job.progress, error: job.error });

async function launch<P>(memberId: string, kind: "import" | "analyse", progress: P): Promise<Job<P>> {
  const job = await startJob(memberId, kind, progress);
  await kickJob(job.id);
  return job;
}

async function nudge<P>(job: Job<P>): Promise<void> {
  if (isStalled(job as Job<unknown>)) await kickJob(job.id);
}

/**
 * Où en est la Révélation d'un membre. Lance ou relance ce qu'il faut : l'écran
 * qui suit la progression appelle cette fonction en boucle (idempotente).
 * `retry` relance l'étape qui a échoué.
 */
export async function revelationState(memberId: string, retry = false): Promise<RevelationState> {
  if (await hasActiveBacs(memberId)) {
    // L'écran de création garde son bilan une fois terminé.
    const last = await latestJob<CreationProgress>(memberId, "creation");
    return { stage: "done", creation: last?.progress ?? null };
  }

  const creation = await latestJob<CreationProgress>(memberId, "creation");
  if (creation && creation.status !== "done") {
    if (creation.status === "failed" && retry) {
      const again = await startJob(memberId, "creation", creation.progress);
      await kickJob(again.id);
      return { stage: "creation", ...view(again) };
    }
    await nudge(creation);
    return { stage: "creation", ...view(creation) };
  }

  let imp = await latestJob<ImportProgress>(memberId, "import");
  let analyse = await latestJob<AnalyseProgress>(memberId, "analyse");
  // Bibliothèque trop petite (l'analyse a refusé) : « Réessayer » relit les likes, il y en a peut-être de nouveaux.
  const tooSmall = imp?.status === "done" && analyse?.status === "failed" && imp.progress.imported < MIN_LIBRARY;
  if (!imp || (imp.status === "failed" && retry) || (tooSmall && retry)) imp = await launch(memberId, "import", initialImport);
  if (imp.status !== "done") {
    await nudge(imp);
    return { stage: "import", ...view(imp) };
  }

  const proposed = await listBacs(memberId, ["proposed", "removed"]);
  // Une analyse plus ancienne que le dernier import ne compte plus (import relancé).
  if (!analyse || (analyse.status === "failed" && retry) || analyse.started_at < imp.started_at) {
    analyse = await launch(memberId, "analyse", proposed.length > 0 ? fillOnly : initialAnalyse);
  }
  const analysing = ["fiches", "rangement", "complement"].includes(analyse.progress.phase);
  if (analysing || proposed.length === 0) {
    await nudge(analyse);
    return { stage: "analyse", covers: await randomCovers(memberId), ...view(analyse) };
  }

  // Proposition à l'écran. Un bac retouché attend son remplissage : on s'assure qu'un job s'en occupe.
  const needsFill = proposed.some((b) => b.needs_fill && b.status === "proposed");
  if (analyse.status === "running") await nudge(analyse);
  else if (needsFill && analyse.status === "done") analyse = await launch(memberId, "analyse", fillOnly);
  return {
    stage: "proposition",
    filling: needsFill,
    error: analyse.status === "failed" ? analyse.error : null,
  };
}

/** Quelques vraies pochettes de la bibliothèque, à feuilleter pendant l'analyse. */
async function randomCovers(memberId: string): Promise<string[]> {
  const rows = check(
    await db().from("likes").select("cover_url").eq("member_id", memberId).not("cover_url", "is", null).limit(400),
    "Lecture des pochettes",
  ) as { cover_url: string }[];
  const urls = [...new Set(rows.map((r) => r.cover_url))];
  for (let i = urls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [urls[i], urls[j]] = [urls[j], urls[i]];
  }
  return urls.slice(0, 40);
}


export interface ProposalImpact {
  /** Titres de la bibliothèque (ceux que l'analyse a vus). */
  total: number;
  /** Titres sans aucun bac gardé : ils iront dans Divers. */
  divers: number;
  /** Par bac : gardé, titres qui partiraient dans Divers si on le retirait ; retiré, titres qu'il sortirait de Divers. */
  alone: Map<string, number>;
}

/** Ce que pèse chaque bac de la proposition sur la caisse Divers. */
export async function proposalImpact(memberId: string, bacs: { id: string; status: string }[]): Promise<ProposalImpact> {
  const total = (await loadCorpus(memberId)).length;
  const kept = new Set(bacs.filter((b) => b.status === "proposed").map((b) => b.id));
  const bacsOf = new Map<string, string[]>();
  for (const bac of bacs) {
    for (let from = 0; ; from += 1000) {
      const rows = check(
        await db().from("placements").select("track_id").eq("bac_id", bac.id).range(from, from + 999),
        "Lecture des placements",
      ) as { track_id: string }[];
      for (const r of rows) bacsOf.set(r.track_id, [...(bacsOf.get(r.track_id) ?? []), bac.id]);
      if (rows.length < 1000) break;
    }
  }
  let housed = 0;
  const alone = new Map<string, number>(bacs.map((b) => [b.id, 0]));
  for (const ids of bacsOf.values()) {
    const keptHere = ids.filter((id) => kept.has(id));
    if (keptHere.length > 0) housed++;
    if (keptHere.length === 1) alone.set(keptHere[0], alone.get(keptHere[0])! + 1);
    if (keptHere.length === 0) for (const id of ids) alone.set(id, alone.get(id)! + 1);
  }
  return { total, divers: Math.max(0, total - housed), alone };
}
