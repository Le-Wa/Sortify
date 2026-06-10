import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import { getAnthropic } from "@/lib/anthropic";

export interface ProposedPlaylistCoverage {
  matched: number;
  total: number;
  pct: number;
  sample_tracks: { name: string; artist: string }[];
}

export interface ProposedPlaylist {
  name: string;
  description: string;
  llm_help_text: string;
  genres_include: string[];
  genres_exclude: string[];
  example_artists: string[];
  coverage: ProposedPlaylistCoverage;
}

export interface TaxonomyProposal {
  playlists: ProposedPlaylist[];
  global_coverage: { matched: number; total: number; pct: number };
  unmatched_tracks: { name: string; artist: string }[];
  target_count: number;
  generated_at: string;
}

interface LLMPlaylistRaw {
  name: string;
  description: string;
  llm_help_text: string;
  genres_include: string[];
  genres_exclude?: string[];
  example_artists: string[];
}

interface TrackSample {
  name: string;
  artist: string;
  genres: string[];
}

function calculateCoverage(
  tracks: TrackSample[],
  playlists: LLMPlaylistRaw[]
): ProposedPlaylist[] {
  const total = tracks.length;
  return playlists.map((pl) => {
    const include = (pl.genres_include ?? []).map((g) => g.toLowerCase());
    const matched_tracks = tracks.filter((t) =>
      t.genres.some((g) => include.includes(g.toLowerCase()))
    );
    const matched = matched_tracks.length;
    const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
    const sample_tracks = matched_tracks
      .slice(0, 3)
      .map((t) => ({ name: t.name, artist: t.artist }));
    return {
      name: pl.name,
      description: pl.description,
      llm_help_text: pl.llm_help_text,
      genres_include: pl.genres_include ?? [],
      genres_exclude: pl.genres_exclude ?? [],
      example_artists: pl.example_artists ?? [],
      coverage: { matched, total, pct, sample_tracks },
    };
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  if (!user.proposal_ready) return NextResponse.json({ error: "Analyse non terminée" }, { status: 403 });

  let body: { target_count?: number; force?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const targetCount = Math.min(8, Math.max(2, body.target_count ?? 4));
  const force = body.force === true;

  const supabase = createClient();

  // Return cached proposal unless force=true
  if (!force) {
    const { data: userRow } = await supabase
      .from("users")
      .select("taxonomy_proposal")
      .eq("id", user.id)
      .single();
    if (userRow?.taxonomy_proposal) {
      return NextResponse.json(userRow.taxonomy_proposal);
    }
  }

  // Reset existing proposal when forcing
  if (force) {
    await supabase.from("users").update({ taxonomy_proposal: null }).eq("id", user.id);
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select("name, artists, genres, audio_features")
    .eq("user_id", user.id)
    .not("enriched_at", "is", null)
    .limit(500);

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "Aucun track enrichi trouvé" }, { status: 422 });
  }

  const sample: TrackSample[] = tracks.slice(0, 200).map((t) => ({
    name: t.name as string,
    artist: Array.isArray(t.artists) ? (t.artists as string[])[0] : "",
    genres: (t.genres as string[] | null) ?? [],
  }));

  const sampleWithFeatures = sample.map((t, i) => ({
    ...t,
    energy: (tracks[i].audio_features as Record<string, number> | null)?.energy ?? null,
    valence: (tracks[i].audio_features as Record<string, number> | null)?.valence ?? null,
  }));

  const anthropic = getAnthropic();
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Tu es un expert en organisation musicale. Voici un échantillon de ${sample.length} tracks d'un utilisateur Spotify :

${JSON.stringify(sampleWithFeatures)}

Propose exactement ${targetCount} playlists adaptées à ce profil musical.
Pour chaque playlist, génère :
- name : nom court en français (2-4 mots max)
- description : une phrase user-facing décrivant le vibe de la playlist (affiché sur Spotify)
- llm_help_text : texte de guidage pour le classifier automatique — décris concrètement ce qui entre dans cette playlist, les cas limites, l'énergie et le mood attendus, avec des exemples d'artistes ou de genres précis
- genres_include : liste de genres musicaux cibles qui définissent cette playlist (3-8 genres)
- genres_exclude : liste de genres à exclure explicitement pour éviter les chevauchements (0-3 genres)
- example_artists : liste de 4-6 artistes présents dans les tracks qui représentent cette playlist

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication :
{"playlists": [...]}`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  let llmPlaylists: LLMPlaylistRaw[] = [];
  try {
    const parsed = JSON.parse(raw) as { playlists: LLMPlaylistRaw[] };
    llmPlaylists = parsed.playlists;
  } catch {
    return NextResponse.json({ error: "Réponse LLM invalide", raw }, { status: 502 });
  }

  const playlistsWithCoverage = calculateCoverage(sample, llmPlaylists);

  const coveredTracks = new Set<string>();
  for (const pl of llmPlaylists) {
    const include = (pl.genres_include ?? []).map((g) => g.toLowerCase());
    sample.forEach((t, i) => {
      if (t.genres.some((g) => include.includes(g.toLowerCase()))) {
        coveredTracks.add(String(i));
      }
    });
  }
  const globalMatched = coveredTracks.size;
  const globalTotal = sample.length;
  const globalPct = globalTotal > 0 ? Math.round((globalMatched / globalTotal) * 100) : 0;

  const unmatchedTracks = sample
    .filter((_, i) => !coveredTracks.has(String(i)))
    .slice(0, 12)
    .map((t) => ({ name: t.name, artist: t.artist }));

  const proposal: TaxonomyProposal = {
    playlists: playlistsWithCoverage,
    global_coverage: { matched: globalMatched, total: globalTotal, pct: globalPct },
    unmatched_tracks: unmatchedTracks,
    target_count: targetCount,
    generated_at: new Date().toISOString(),
  };

  await supabase.from("users").update({ taxonomy_proposal: proposal }).eq("id", user.id);

  return NextResponse.json(proposal);
}
