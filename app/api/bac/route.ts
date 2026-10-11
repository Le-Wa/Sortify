import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStalled, kickJob, latestJob } from "@/lib/jobs";
import type { NewBacProgress } from "@/lib/new-bac";

/** État de la dernière création de bac (relance une création bloquée). Suivi par « + Nouveau bac ». */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.spotifyId) return Response.json({ error: "Non connecté" }, { status: 401 });
  try {
    const job = await latestJob<NewBacProgress>(session.spotifyId, "bac");
    if (job && isStalled(job)) await kickJob(job.id);
    if (!job) return Response.json(null);
    // Pas besoin d'envoyer la fiche ni la liste des titres trouvés au navigateur.
    const { phase, scanned, total, found, bac, phaseStartedAt, request } = job.progress;
    return Response.json({
      id: job.id,
      status: job.status,
      error: job.error,
      finishedAt: job.finished_at,
      progress: { phase, scanned, total, found: found.length, bac, phaseStartedAt, request, name: job.progress.fiche?.name ?? null },
    });
  } catch (error) {
    console.error("État de la création de bac :", error);
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, { status: 500 });
  }
}
