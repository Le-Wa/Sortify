import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getUserPlaylists } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const supabase = createClient();

  const [snapshotRes, labelsRes, playlists] = await Promise.all([
    supabase.from("benchmark_snapshot").select("ran_at, results").eq("user_id", dbUser.id).single(),
    supabase.from("benchmark_labels").select("track_id, correct_playlist_id, notes, labeled_at").eq("user_id", dbUser.id),
    getUserPlaylists(dbUser.id),
  ]);

  if (!snapshotRes.data) {
    return Response.json({ snapshot: null, playlists });
  }

  const playlistMap = new Map(playlists.map((p) => [p.id, p.name]));
  const labelMap = new Map(
    (labelsRes.data ?? []).map((l) => [
      l.track_id as string,
      {
        correct_playlist_id: l.correct_playlist_id as string | null,
        correct_playlist_name: l.correct_playlist_id ? (playlistMap.get(l.correct_playlist_id as string) ?? null) : null,
        notes: l.notes as string | null,
        labeled_at: l.labeled_at as string,
      },
    ])
  );

  const results = ((snapshotRes.data.results as unknown[]) ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const label = labelMap.get(row.track_id as string) ?? null;
    return { ...row, label };
  });

  return Response.json({
    snapshot: { ran_at: snapshotRes.data.ran_at, results },
    playlists,
  });
}
