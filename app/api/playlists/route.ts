import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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
  const { spotifyPlaylistId, name, description, rules } = body;

  if (!spotifyPlaylistId || !name) {
    return Response.json(
      { error: "Missing spotifyPlaylistId or name" },
      { status: 400 }
    );
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  // Centroid starts null — calculated by the cron after the first tracks are classified
  const playlist = await insertPlaylist({
    user_id: dbUser.id,
    spotify_playlist_id: spotifyPlaylistId,
    name,
    description: description ?? null,
    centroid: null,
    rules: rules ?? EMPTY_RULES,
  });

  return Response.json(playlist, { status: 201 });
}
