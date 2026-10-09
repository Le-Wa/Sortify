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

  // Mark in_progress so a refresh during import doesn't send user back to S0
  await supabase
    .from("users")
    .update({ onboarding_status: "in_progress", onboarding_step: 0 })
    .eq("id", user.id);

  const importErrors: string[] = [];
  let totalImported = 0;

  for (const spotifyPlaylistId of playlistIds) {
    // Fetch playlist metadata
    const metaRes = await spotifyFetch(`${BASE}/playlists/${spotifyPlaylistId}?fields=id,name,description,images`, token);
    if (!metaRes.ok) {
      importErrors.push(`playlist ${spotifyPlaylistId}: metadata fetch failed (${metaRes.status})`);
      continue;
    }
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

    if (plError || !pl) {
      importErrors.push(`playlist ${spotifyPlaylistId}: db upsert failed — ${plError?.message ?? "no data"}`);
      continue;
    }

    // Fetch tracks from this playlist and insert with manually_assigned = true
    let url: string | null = `${BASE}/playlists/${spotifyPlaylistId}/items?limit=50`;

    while (url) {
      const tracksRes = await spotifyFetch(url, token);
      if (!tracksRes.ok) break;
      type SpotifyTrackItem = { id: string; name: string; type: string; artists: { id: string; name: string }[]; external_ids?: { isrc?: string } };
      const tracksData = await tracksRes.json() as {
        next: string | null;
        items: Array<{ added_at: string; track?: SpotifyTrackItem | null; item?: SpotifyTrackItem | null }>;
      };

      const batch = tracksData.items
        .map((entry) => ({ added_at: entry.added_at, track: entry.item ?? entry.track }))
        .filter((entry): entry is { added_at: string; track: SpotifyTrackItem } =>
          !!entry.track?.id && entry.track.type === "track"
        )
        .map((entry) => ({
          user_id: user.id,
          spotify_track_id: entry.track.id,
          spotify_added_at: entry.added_at ?? null,
          name: entry.track.name,
          artists: entry.track.artists.map((a) => a.name),
          artist_ids: entry.track.artists.map((a) => a.id),
          isrc: entry.track.external_ids?.isrc ?? null,
          assigned_playlist: pl.id,
          manually_assigned: true,
          is_liked: false,
          classified_at: new Date().toISOString(),
          classification_level: 0,
          needs_review: false,
          is_archived: false,
          genres: [],
        }));

      const skipped = tracksData.items.length - batch.length;
      if (skipped > 0) importErrors.push(`${skipped} items ignorés (épisodes, tracks indisponibles ou locales)`);

      if (batch.length > 0) {
        const { error: upsertError } = await supabase.from("tracks").upsert(batch, {
          onConflict: "user_id,spotify_track_id",
          ignoreDuplicates: true,
        });
        if (upsertError) {
          importErrors.push(`upsert error: ${upsertError.message}`);
        } else {
          const spotifyIds = batch.map((t) => t.spotify_track_id);
          const { error: updateError } = await supabase
            .from("tracks")
            .update({ assigned_playlist: pl.id, manually_assigned: true })
            .eq("user_id", user.id)
            .in("spotify_track_id", spotifyIds);
          if (updateError) importErrors.push(`update error: ${updateError.message}`);
          totalImported += batch.length;
        }
      }

      url = tracksData.next;
    }
  }

  return NextResponse.json({ ok: true, imported: totalImported, errors: importErrors });
}
