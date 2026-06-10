import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import { getAnthropic } from "@/lib/anthropic";
import type { ProposedPlaylist, ProposedPlaylistCoverage } from "@/app/api/onboarding/propose-taxonomy/route";

interface AnchorPlaylist {
  name: string;
  genres_include: string[];
  llm_help_text?: string;
}

interface TrackSample {
  name: string;
  artist: string;
  genres: string[];
  energy?: number | null;
  valence?: number | null;
}

interface LLMPlaylistRaw {
  name: string;
  description: string;
  llm_help_text: string;
  genres_include: string[];
  genres_exclude?: string[];
  example_artists: string[];
}

function buildCoverage(
  tracks: TrackSample[],
  genresInclude: string[]
): ProposedPlaylistCoverage {
  const include = genresInclude.map((g) => g.toLowerCase());
  const matched = include.length === 0
    ? []
    : tracks.filter((t) => t.genres.some((g) => include.includes(g.toLowerCase())));
  const pct = tracks.length > 0 ? Math.round((matched.length / tracks.length) * 100) : 0;
  return {
    matched: matched.length,
    total: tracks.length,
    pct,
    sample_tracks: matched.slice(0, 3).map((t) => ({ name: t.name, artist: t.artist })),
  };
}

// POST { anchors: AnchorPlaylist[] }
// → Appelle le LLM sur les tracks non couverts par les ancres
// → Retourne les nouvelles playlists suggérées (les ancres ne sont PAS retournées — le client les garde)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const body = await req.json() as { anchors: AnchorPlaylist[] };
  const anchors: AnchorPlaylist[] = Array.isArray(body.anchors) ? body.anchors : [];

  const supabase = createClient();
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
    energy: (t.audio_features as Record<string, number> | null)?.energy ?? null,
    valence: (t.audio_features as Record<string, number> | null)?.valence ?? null,
  }));

  // Tracks non couverts par les ancres
  const coveredByAnchors = new Set<number>();
  for (const anchor of anchors) {
    const include = anchor.genres_include.map((g) => g.toLowerCase());
    sample.forEach((t, i) => {
      if (include.length > 0 && t.genres.some((g) => include.includes(g.toLowerCase()))) {
        coveredByAnchors.add(i);
      }
    });
  }

  const unmatched = sample.filter((_, i) => !coveredByAnchors.has(i));

  if (unmatched.length === 0) {
    return NextResponse.json({
      new_playlists: [],
      unmatched_tracks: [],
      global_coverage: {
        matched: sample.length,
        total: sample.length,
        pct: 100,
      },
      message: "Toutes les tracks sont déjà couvertes par les playlists existantes.",
    });
  }

  // Nombre de nouvelles playlists à suggérer (1 par 20 tracks non couverts, min 1, max 3)
  const suggestCount = Math.min(3, Math.max(1, Math.round(unmatched.length / 20)));

  const anchorSummary = anchors.length > 0
    ? anchors.map((a) => `- "${a.name}" (genres: ${a.genres_include.join(", ")})`).join("\n")
    : "Aucune playlist existante.";

  const anthropic = getAnthropic();
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Tu es un expert en organisation musicale.

L'utilisateur a déjà ces playlists (NE PAS reproduire, NE PAS chevaucher) :
${anchorSummary}

Ces ${unmatched.length} tracks ne rentrent dans aucune des playlists ci-dessus :
${JSON.stringify(unmatched.slice(0, 60))}

Propose exactement ${suggestCount} nouvelle${suggestCount > 1 ? "s" : ""} playlist${suggestCount > 1 ? "s" : ""} pour couvrir ces tracks.
Les genres doivent être différents de ceux déjà utilisés dans les playlists existantes.

Pour chaque playlist, génère :
- name : nom court en français (2-4 mots max)
- description : une phrase user-facing décrivant le vibe
- llm_help_text : texte de guidage pour le classifier — genres, mood, énergie, artistes types
- genres_include : genres cibles (3-8 genres, différents des ancres)
- genres_exclude : genres à exclure (0-3)
- example_artists : 3-5 artistes représentatifs depuis les tracks fournis

Réponds UNIQUEMENT avec un JSON valide :
{"playlists": [...]}`,
      },
    ],
  });

  let raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  // Strip markdown code fences if present
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let llmPlaylists: LLMPlaylistRaw[] = [];
  try {
    const parsed = JSON.parse(raw) as { playlists: LLMPlaylistRaw[] };
    llmPlaylists = parsed.playlists;
  } catch {
    return NextResponse.json({ error: "Réponse LLM invalide", raw }, { status: 502 });
  }

  // Calcul couverture pour les nouvelles playlists (sur le sample complet)
  const newPlaylists: ProposedPlaylist[] = llmPlaylists.map((pl) => ({
    name: pl.name,
    description: pl.description,
    llm_help_text: pl.llm_help_text,
    genres_include: pl.genres_include ?? [],
    genres_exclude: pl.genres_exclude ?? [],
    example_artists: pl.example_artists ?? [],
    coverage: buildCoverage(sample, pl.genres_include ?? []),
  }));

  // Couverture globale (ancres + nouvelles)
  const allCovered = new Set(coveredByAnchors);
  for (const pl of llmPlaylists) {
    const include = (pl.genres_include ?? []).map((g) => g.toLowerCase());
    sample.forEach((t, i) => {
      if (t.genres.some((g) => include.includes(g.toLowerCase()))) allCovered.add(i);
    });
  }

  const unmatchedAfter = sample
    .filter((_, i) => !allCovered.has(i))
    .slice(0, 12)
    .map((t) => ({ name: t.name, artist: t.artist }));

  return NextResponse.json({
    new_playlists: newPlaylists,
    unmatched_tracks: unmatchedAfter,
    unmatched_count: sample.length - allCovered.size,
    global_coverage: {
      matched: allCovered.size,
      total: sample.length,
      pct: Math.round((allCovered.size / sample.length) * 100),
    },
  });
}
