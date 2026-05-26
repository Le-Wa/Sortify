import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, updateCronEnabled } from "@/lib/supabase/queries";
import { z } from "zod";

const Body = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Missing enabled (boolean)" }, { status: 400 });
  const { enabled } = parsed.data;

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await updateCronEnabled(dbUser.id, enabled);
  return Response.json({ cron_enabled: enabled });
}
