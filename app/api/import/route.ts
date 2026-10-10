import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initialImport, type ImportProgress } from "@/lib/import";
import { isStalled, kickJob, latestJob, startJob, type Job } from "@/lib/jobs";

export interface ImportStatus {
  status: "running" | "done" | "failed";
  progress: ImportProgress;
  error: string | null;
}

function toStatus(job: Job<ImportProgress>): ImportStatus {
  return { status: job.status, progress: job.progress, error: job.error };
}

/**
 * Lance l'import s'il n'a jamais tourné (ou si `retry` après un échec), relance un job bloqué,
 * et renvoie l'état. Idempotent : l'écran d'attente l'appelle en boucle.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.spotifyId) return Response.json({ error: "Non connecté" }, { status: 401 });
  const retry = new URL(req.url).searchParams.get("retry") === "1";

  let job = await latestJob<ImportProgress>(session.spotifyId, "import");
  if (!job || (job.status === "failed" && retry)) {
    job = await startJob(session.spotifyId, "import", initialImport);
    await kickJob(job.id);
  } else if (isStalled(job)) {
    await kickJob(job.id);
  }
  return Response.json(toStatus(job));
}
