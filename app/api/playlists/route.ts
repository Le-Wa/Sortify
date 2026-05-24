import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAccessToken } from "@/lib/spotify/token";
import { createSpotifyPlaylist } from "@/lib/spotify/fetchers";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  insertPlaylist,
} from "@/lib/supabase/queries";
import type { PlaylistRules } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_RULES: PlaylistRules = {
  genres: { include: [], exclude: [] },
  audio_features: {},
  hard_constraints: { max_age_days: null, require_genre_signal: false },
};

// ── GET /api/playlists ────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const playlists = await getUserPlaylists(dbUser.id);
  return Response.json(playlists);
}

// ── POST /api/playlists ───────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    spotifyPlaylistId?: string;
    name?: string;
    description?: string;
    rules?: PlaylistRules;
  };
  const { name, description, rules } = body;
  let { spotifyPlaylistId } = body;

  if (!name) {
    return Response.json({ error: "Missing name" }, { status: 400 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  // No Spotify playlist linked — create one automatically
  if (!spotifyPlaylistId) {
    try {
      const token = await refreshAccessToken(session.userId);
      const created = await createSpotifyPlaylist(token, session.userId, name, description);
      spotifyPlaylistId = created.id;
    } catch (err) {
      return Response.json(
        { error: `Impossible de créer la playlist dans Spotify : ${String(err)}` },
        { status: 502 }
      );
    }
  }

  // Centroid starts null — calculated by the cron after the first tracks are classified
  const playlist = await insertPlaylist({
    user_id: dbUser.id,
    spotify_playlist_id: spotifyPlaylistId,
    name,
    description: description ?? null,
    centroid: null,
    rules: rules ?? EMPTY_RULES,
  });

  return Response.json({ ...playlist, spotify_playlist_id: spotifyPlaylistId }, { status: 201 });
}
