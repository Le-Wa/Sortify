import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, moveTrackToPlaylist, removeTrackFromPlaylist, addTrackToExtraPlaylist } from "@/lib/supabase/queries";

type Params = Promise<{ track_id: string }>;

const Body = z.object({
  action: z.enum(["move", "add-extra", "remove-from-playlist"]),
  playlist_id: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid action" }, { status: 400 });
  const { action, playlist_id } = parsed.data;

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { track_id } = await params;

  if (action === "move") {
    if (!playlist_id) return Response.json({ error: "Missing playlist_id" }, { status: 400 });
    await moveTrackToPlaylist(track_id, dbUser.id, playlist_id);
    return Response.json({ ok: true });
  }

  if (action === "add-extra") {
    if (!playlist_id) return Response.json({ error: "Missing playlist_id" }, { status: 400 });
    await addTrackToExtraPlaylist(track_id, dbUser.id, playlist_id);
    return Response.json({ ok: true });
  }

  if (!playlist_id) return Response.json({ error: "Missing playlist_id" }, { status: 400 });
  await removeTrackFromPlaylist(track_id, dbUser.id, playlist_id);
  return Response.json({ ok: true });
}
