import "server-only";
import { initialAnalyse, runAnalyseStep, type AnalyseProgress } from "./analyse";
import { runCreationStep, type CreationProgress } from "./creation";
import { runImportStep, type ImportProgress } from "./import";
import { runTriStep, type TriProgress } from "./tri";
import { claimJob, failJob, finishJob, kickJob, releaseJob, startJob, STEP_BUDGET_MS, type Job } from "./jobs";

/**
 * Un passage de worker : prend le bail, avance jusqu'au budget, puis se relance
 * lui-même s'il reste du travail. L'utilisateur peut fermer l'app pendant ce temps.
 */
export async function runJob(id: string): Promise<void> {
  const job = await claimJob(id);
  if (!job) return; // déjà pris par un autre worker, ou terminé

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
          return;
        }
        await releaseJob(id, progress);
        break;
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
