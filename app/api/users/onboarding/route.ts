import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserOnboarding, updateOnboardingData } from "@/lib/supabase/queries";

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    completed?: boolean;
    import_since?: number | null;
    cron_enabled?: boolean;
  };

  const dbUser = await getUserOnboarding(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await updateOnboardingData(dbUser.id, {
    onboarding_completed: body.completed ?? true,
    import_since: body.import_since ?? null,
    cron_enabled: body.cron_enabled ?? true,
  });

  return Response.json({ ok: true });
}
