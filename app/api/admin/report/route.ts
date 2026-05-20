import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getUserCronData } from "@/lib/supabase/queries";

const OVERDUE_MS = 8 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const data = await getUserCronData(dbUser.id);
  const lastRun = (data?.last_cron_report ?? null) as { ran_at?: string } | null;
  const lastCronAt = lastRun?.ran_at ?? null;
  const cron_overdue =
    !lastCronAt || new Date(lastCronAt).getTime() < Date.now() - OVERDUE_MS;

  return Response.json({
    last_cron_at: lastCronAt,
    cron_overdue,
    last_run: data?.last_cron_report ?? null,
  });
}
