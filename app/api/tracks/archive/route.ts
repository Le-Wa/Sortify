import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, archiveTrack } from "@/lib/supabase/queries";
import { z } from "zod";

const Body = z.object({ trackId: z.string() });

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Missing trackId" }, { status: 400 });
  const { trackId } = parsed.data;

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await archiveTrack(trackId, dbUser.id);
  return Response.json({ ok: true });
}
