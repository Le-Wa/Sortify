import { env } from "@/lib/env";
import { check, db } from "@/lib/db";
import { kickJob, startJob } from "@/lib/jobs";
import { initialTri } from "@/lib/tri";

export const maxDuration = 60;

/**
 * Tri quotidien (Vercel Cron, plan Hobby : une fois par jour, même heure pour tout le monde).
 * Lance un job « tri » par membre qui a des bacs et n'a pas mis le tri en pause.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const members = check(
    await db().from("members").select("spotify_id, bacs!inner(id)").eq("sort_paused", false).eq("bacs.status", "active"),
    "Lecture des membres à trier",
  ) as { spotify_id: string }[];
  const ids = [...new Set(members.map((m) => m.spotify_id))];

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const job = await startJob(id, "tri", initialTri("cron"));
      await kickJob(job.id);
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) console.error("Tri quotidien : lancement impossible", (f as PromiseRejectedResult).reason);
  return Response.json({ members: ids.length, failed: failed.length });
}
