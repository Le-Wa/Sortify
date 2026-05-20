import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, archiveTrack } from "@/lib/supabase/queries";

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { trackId?: string };
  if (!body.trackId) {
    return Response.json({ error: "Missing trackId" }, { status: 400 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await archiveTrack(body.trackId, dbUser.id);
  return Response.json({ ok: true });
}
