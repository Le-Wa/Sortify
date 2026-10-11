import "server-only";
import { initialAnalyse, runAnalyseStep, type AnalyseProgress } from "./analyse";
import { runCreationStep, type CreationProgress } from "./creation";
import { runImportStep, type ImportProgress } from "./import";
import { refreshBriefs } from "./bac-admin";
import { runNewBacStep, type NewBacProgress } from "./new-bac";
import { runReanalyseStep, suggestFromDivers, type ReanalyseProgress } from "./suggestions";
import { runTriStep, type TriProgress } from "./tri";
import { withUsage } from "./ai-usage";
import { claimJob, failJob, finishJob, kickJob, releaseJob, startJob, STEP_BUDGET_MS, type Job } from "./jobs";

/**
 * Un passage de worker : prend le bail, avance jusqu'au budget, puis se relance
 * lui-même s'il reste du travail. L'utilisateur peut fermer l'app pendant ce temps.
 */
export async function runJob(id: string): Promise<void> {
  const job = await claimJob(id);
  if (!job) return; // déjà pris par un autre worker, ou terminé
  // Consommation de l'IA rattachée au membre et à la tâche.
  await withUsage(job.member_id, job.kind, () => runClaimed(job));
}

async function runClaimed(job: Job<unknown>): Promise<void> {
  const id = job.id;

  const deadline = Date.now() + STEP_BUDGET_MS;
  try {
    switch (job.kind) {
      case "import": {
        const progress = await runImportStep(job as Job<ImportProgress>, deadline);
        if (progress.phase === "done") {
          await finishJob(id, progress);
          // Les likes sont prêts : l'IA enchaîne sur l'analyse.
          const analyse = await startJob(job.member_id, "analyse", initialAnalyse);
          await kickJob(analyse.id);
          return;
        }
        await releaseJob(id, progress);
        break;
      }
      case "analyse": {
        const progress = await runAnalyseStep(job as Job<AnalyseProgress>, deadline);
        if (progress.phase === "done") {
          await finishJob(id, progress);
          return;
        }
        await releaseJob(id, progress);
        break;
      }
      case "creation": {
        const progress = await runCreationStep(job as Job<CreationProgress>, deadline);
        if (progress.phase === "done") {
          await finishJob(id, progress);
          return;
        }
        await releaseJob(id, progress);
        break;
      }
      case "tri": {
        const progress = await runTriStep(job as Job<TriProgress>, deadline);
        if (progress.phase === "done") {
          await finishJob(id, progress);
          // Ré-analyse automatique (spec 02 §2.5) : un échec ne doit pas faire échouer le tri.
          await suggestFromDivers(job.member_id).catch((error: unknown) =>
            console.error("Suggestion depuis Divers impossible :", error instanceof Error ? error.message : error),
          );
          return;
        }
        await releaseJob(id, progress);
        break;
      }
      case "bac": {
        const progress = await runNewBacStep(job as Job<NewBacProgress>, deadline);
        if (progress.phase === "done") {
          await finishJob(id, progress);
          // Les fiches voisines tiennent compte du nouveau bac ; un échec ne remet pas le bac en cause.
          await refreshBriefs(job.member_id).catch((error: unknown) =>
            console.error("Frontières des fiches non rafraîchies :", error instanceof Error ? error.message : error),
          );
          return;
        }
        await releaseJob(id, progress);
        break;
      }
      case "reanalyse": {
        await finishJob(id, await runReanalyseStep(job as Job<ReanalyseProgress>));
        return;
      }
      default:
        throw new Error(`Type de job pas encore géré : ${job.kind}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Job ${job.kind} ${id} en échec :`, message);
    await failJob(id, message);
    return;
  }
  await kickJob(id);
}
