import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

interface PlaylistInput {
  genres_include: string[];
}

// Recalcule couverture + tracks non classés sans appel LLM
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const body = await req.json() as { playlists: PlaylistInput[] };
  if (!Array.isArray(body.playlists)) {
    return NextResponse.json({ error: "playlists requis" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: tracks } = await supabase
    .from("tracks")
    .select("name, artists, genres")
    .eq("user_id", user.id)
    .not("enriched_at", "is", null)
    .limit(500);

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "Aucun track trouvé" }, { status: 422 });
  }

  const sample = tracks.slice(0, 200).map((t) => ({
    name: t.name as string,
    artist: Array.isArray(t.artists) ? (t.artists as string[])[0] : "",
    genres: (t.genres as string[] | null) ?? [],
  }));

  const coveredIndexes = new Set<number>();
  const coveragePerPlaylist: { matched: number; pct: number }[] = [];

  for (const pl of body.playlists) {
    const include = (pl.genres_include ?? []).map((g) => g.toLowerCase());
    const matched = include.length === 0
      ? 0
      : sample.filter((t) => t.genres.some((g) => include.includes(g.toLowerCase()))).length;

    if (include.length > 0) {
      sample.forEach((t, i) => {
        if (t.genres.some((g) => include.includes(g.toLowerCase()))) coveredIndexes.add(i);
      });
    }
    coveragePerPlaylist.push({
      matched,
      pct: sample.length > 0 ? Math.round((matched / sample.length) * 100) : 0,
    });
  }

  const globalMatched = coveredIndexes.size;
  const globalTotal = sample.length;

  const unmatchedTracks = sample
    .filter((_, i) => !coveredIndexes.has(i))
    .slice(0, 12)
    .map((t) => ({ name: t.name, artist: t.artist }));

  return NextResponse.json({
    coverage_per_playlist: coveragePerPlaylist,
    global_coverage: {
      matched: globalMatched,
      total: globalTotal,
      pct: globalTotal > 0 ? Math.round((globalMatched / globalTotal) * 100) : 0,
    },
    unmatched_tracks: unmatchedTracks,
    unmatched_count: globalTotal - globalMatched,
  });
}
