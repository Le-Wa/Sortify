import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, updateCronEnabled } from "@/lib/supabase/queries";

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "Missing enabled (boolean)" }, { status: 400 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await updateCronEnabled(dbUser.id, body.enabled);
  return Response.json({ cron_enabled: body.enabled });
}
