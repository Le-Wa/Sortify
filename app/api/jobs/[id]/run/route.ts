import { after } from "next/server";
import { hasCronSecret } from "@/lib/env";
import { runJob } from "@/lib/run-job";

export const maxDuration = 300;

/** Fait avancer un job en arrière-plan. Appelé par l'app elle-même, avec le secret du cron. */
export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[id]/run">) {
  if (!hasCronSecret(req.headers.get("authorization"))) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await ctx.params;
  after(async () => {
    try {
      await runJob(id);
    } catch (error) {
      // Le job reste « en cours » sans bail : le prochain passage de l'écran d'attente le relancera.
      console.error(`Job ${id} : passage interrompu`, error);
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}
