import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserOnboarding, updateOnboardingData } from "@/lib/supabase/queries";

const Body = z.object({
  completed: z.boolean().optional(),
  import_since: z.number().nullable().optional(),
  cron_enabled: z.boolean().optional(),
});

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const body = parsed.data;

  const dbUser = await getUserOnboarding(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await updateOnboardingData(dbUser.id, {
    onboarding_completed: body.completed ?? true,
    import_since: body.import_since ?? null,
    cron_enabled: body.cron_enabled ?? true,
  });

  return Response.json({ ok: true });
}
