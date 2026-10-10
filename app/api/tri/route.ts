import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStalled, kickJob, latestJob } from "@/lib/jobs";
import type { TriProgress } from "@/lib/tri";

/** État du dernier tri (relance un tri bloqué). Suivi par le bouton « Nouveaux likes ? ». */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.spotifyId) return Response.json({ error: "Non connecté" }, { status: 401 });
  try {
    const job = await latestJob<TriProgress>(session.spotifyId, "tri");
    if (job && isStalled(job)) await kickJob(job.id);
    return Response.json(job ? { status: job.status, progress: job.progress, error: job.error } : null);
  } catch (error) {
    console.error("État du tri :", error);
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, { status: 500 });
  }
}
