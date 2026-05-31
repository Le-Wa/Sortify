/**
 * Imports selected Spotify playlists as Sortify playlists with manually_assigned = true
 * for their tracks. Called at the end of S4 before entering the app.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";
import { createClient } from "@/lib/supabase/client";

const BASE = "https://api.spotify.com/v1";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.playlist_ids)) {
    return NextResponse.json({ error: "playlist_ids requis" }, { status: 400 });
  }

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const token = await refreshAccessToken(session.userId);
  const supabase = createClient();
  const playlistIds: string[] = body.playlist_ids;

  for (const spotifyPlaylistId of playlistIds) {
    // Fetch playlist metadata
    const metaRes = await spotifyFetch(`${BASE}/playlists/${spotifyPlaylistId}?fields=id,name,description,images`, token);
    if (!metaRes.ok) continue;
    const meta = await metaRes.json() as {
      id: string; name: string; description: string;
      images: { url: string }[];
    };

    // Upsert playlist in DB
    const { data: pl, error: plError } = await supabase
      .from("playlists")
      .upsert({
        user_id: user.id,
        spotify_playlist_id: meta.id,
        name: meta.name,
        description: meta.description ?? null,
        enabled: true,
        priority: 0,
      }, { onConflict: "user_id,spotify_playlist_id" })
      .select("id")
      .single();

    if (plError || !pl) continue;

    // Fetch tracks from this playlist and insert with manually_assigned = true
    let url: string | null = `${BASE}/playlists/${spotifyPlaylistId}/tracks?fields=next,items(added_at,track(id,name,artists,external_ids))&limit=50`;

    while (url) {
      const tracksRes = await spotifyFetch(url, token);
      if (!tracksRes.ok) break;
      const tracksData = await tracksRes.json() as {
        next: string | null;
        items: Array<{
          added_at: string;
          track: { id: string; name: string; artists: { id: string; name: string }[]; external_ids: { isrc?: string } } | null;
        }>;
      };

      const batch = tracksData.items
        .filter((item) => item.track?.id)
        .map((item) => ({
          user_id: user.id,
          spotify_track_id: item.track!.id,
          spotify_added_at: item.added_at ?? null,
          name: item.track!.name,
          artists: item.track!.artists.map((a) => a.name),
          artist_ids: item.track!.artists.map((a) => a.id),
          isrc: item.track!.external_ids?.isrc ?? null,
          assigned_playlist: pl.id,
          manually_assigned: true,
          is_liked: false,
          classified_at: new Date().toISOString(),
          classification_level: 0,
          needs_review: false,
          is_archived: false,
          genres: [],
        }));

      if (batch.length > 0) {
        await supabase.from("tracks").upsert(batch, {
          onConflict: "user_id,spotify_track_id",
          ignoreDuplicates: true,
        });
      }

      url = tracksData.next;
    }
  }

  return NextResponse.json({ ok: true });
}
