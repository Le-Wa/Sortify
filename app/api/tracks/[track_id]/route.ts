import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, moveTrackToPlaylist, removeTrackFromPlaylist, addTrackToExtraPlaylist } from "@/lib/supabase/queries";

type Params = Promise<{ track_id: string }>;

export async function PATCH(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { track_id } = await params;
  const body = (await req.json()) as { action?: string; playlist_id?: string };

  if (body.action === "move") {
    if (!body.playlist_id) return Response.json({ error: "Missing playlist_id" }, { status: 400 });
    await moveTrackToPlaylist(track_id, dbUser.id, body.playlist_id);
    return Response.json({ ok: true });
  }

  if (body.action === "add-extra") {
    if (!body.playlist_id) return Response.json({ error: "Missing playlist_id" }, { status: 400 });
    await addTrackToExtraPlaylist(track_id, dbUser.id, body.playlist_id);
    return Response.json({ ok: true });
  }

  if (body.action === "remove-from-playlist") {
    if (!body.playlist_id) return Response.json({ error: "Missing playlist_id" }, { status: 400 });
    await removeTrackFromPlaylist(track_id, dbUser.id, body.playlist_id);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
