import "server-only";
import { initialAnalyse, runAnalyseStep, type AnalyseProgress } from "./analyse";
import { runCreationStep, type CreationProgress } from "./creation";
import { runImportStep, type ImportProgress } from "./import";
import { refreshBriefs } from "./bac-admin";
import { refreshArrivalPlaylist } from "./arrival-playlist";
import { notify } from "./push";
import { runNewBacStep, type NewBacProgress } from "./new-bac";
import { runReanalyseStep, suggestFromDivers, type ReanalyseProgress } from "./suggestions";
import { runTriStep, type TriProgress } from "./tri";
import { runOldLikesStep, type OldLikesProgress } from "./old-likes";
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
          // Playlist « Arrivage de la semaine » : un échec ne remet pas le tri en cause.
          await refreshArrivalPlaylist(job.member_id).catch((error: unknown) =>
            console.error("Arrivage de la semaine non mis à jour :", error instanceof Error ? error.message : error),
          );
          // Tri du lundi : « ton arrivage est prêt » sur les téléphones abonnés.
          if (progress.source === "cron") await announceArrival(job.member_id, progress);
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
      case "anciens": {
        const progress = await runOldLikesStep(job as Job<OldLikesProgress>, deadline);
        if (progress.phase === "done") {
          await finishJob(id, progress);
          await notify(job.member_id, {
            title: "Tes anciens likes sont rangés",
            body: `${progress.placed} dans tes bacs, ${progress.divers} dans Divers.`,
            url: "/bacs",
          }).catch((error: unknown) => console.error("Notification des anciens likes :", error instanceof Error ? error.message : error));
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

/** Notification du lundi ; rien si aucun nouveau like. Un échec ne remet pas le tri en cause. */
async function announceArrival(memberId: string, p: TriProgress): Promise<void> {
  const total = p.placed + p.pending + p.divers;
  if (total === 0) return;
  const body = [`${p.placed} titre${p.placed > 1 ? "s" : ""} rangé${p.placed > 1 ? "s" : ""}`, p.pending ? `${p.pending} à trier` : null, p.divers ? `${p.divers} en Divers` : null]
    .filter(Boolean)
    .join(" · ");
  await notify(memberId, { title: "Ton arrivage est prêt", body, url: p.pending ? "/a-trier" : "/arrivages" }).catch((error: unknown) =>
    console.error("Notification du lundi non envoyée :", error instanceof Error ? error.message : error),
  );
}
