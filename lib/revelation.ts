import "server-only";
import { fillOnly, initialAnalyse, type AnalyseProgress } from "./analyse";
import { listBacs } from "./bacs";
import type { CreationProgress } from "./creation";
import { check, db } from "./db";
import { initialImport, type ImportProgress } from "./import";
import { isStalled, kickJob, latestJob, startJob, type Job } from "./jobs";
import { hasActiveBacs } from "./library";

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
  if (!imp || (imp.status === "failed" && retry)) imp = await launch(memberId, "import", initialImport);
  if (imp.status !== "done") {
    await nudge(imp);
    return { stage: "import", ...view(imp) };
  }

  const proposed = await listBacs(memberId, ["proposed", "removed"]);
  let analyse = await latestJob<AnalyseProgress>(memberId, "analyse");
  if (!analyse || (analyse.status === "failed" && retry)) {
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

