import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getAdminLogsV2,
  type AdminLogsFilter,
} from "@/lib/supabase/queries";

const PER_PAGE = 50;

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? String(PER_PAGE), 10)));

  const filters: AdminLogsFilter = {
    playlistId: searchParams.get("playlist_id") ?? undefined,
    correctionsOnly: searchParams.get("corrections_only") === "true",
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    level: searchParams.has("level") ? parseInt(searchParams.get("level")!, 10) : undefined,
  };

  const [{ logs: rawLogs, total }, playlists] = await Promise.all([
    getAdminLogsV2(dbUser.id, filters, page, perPage),
    getUserPlaylists(dbUser.id),
  ]);

  const playlistNameMap = new Map(playlists.map((p) => [p.id, p.name]));

  const logs = rawLogs.map((row) => ({
    ...row,
    suggested: row.suggested ? (playlistNameMap.get(row.suggested) ?? row.suggested) : null,
    corrected_to: row.corrected_to
      ? (playlistNameMap.get(row.corrected_to) ?? row.corrected_to)
      : null,
  }));

  return Response.json({ logs, total, page, per_page: perPage });
}
