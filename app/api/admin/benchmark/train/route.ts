import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getUserPlaylists } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import { getAnthropic } from "@/lib/anthropic";

interface BenchmarkRow {
  track_id: string;
  name: string;
  artist: string;
  genres: string[];
  af_energy: number | null;
  af_danceability: number | null;
  af_valence: number | null;
  af_tempo: number | null;
  v1_playlist_name: string | null;
  v1_reason: string | null;
  v2_playlist_name: string | null;
  v2_reason: string | null;
}

interface Label {
  track_id: string;
  correct_playlist_id: string | null;
  notes: string | null;
}

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const supabase = createClient();

  const [snapshotRes, labelsRes, playlists] = await Promise.all([
    supabase.from("benchmark_snapshot").select("results").eq("user_id", dbUser.id).single(),
    supabase.from("benchmark_labels").select("track_id, correct_playlist_id, notes").eq("user_id", dbUser.id),
    getUserPlaylists(dbUser.id),
  ]);

  if (!snapshotRes.data) return Response.json({ error: "Aucun snapshot. Lance d'abord le benchmark." }, { status: 400 });

  const labels = (labelsRes.data ?? []) as Label[];
  if (labels.length === 0) return Response.json({ error: "Aucun label. Fais des corrections d'abord." }, { status: 400 });

  const results = snapshotRes.data.results as unknown as BenchmarkRow[];
  const resultMap = new Map(results.map((r) => [r.track_id, r]));

  // Group labeled tracks by their correct_playlist_id
  const byPlaylist = new Map<string, { track: BenchmarkRow; label: Label }[]>();
  const inboxLabels: { track: BenchmarkRow; label: Label }[] = [];

  for (const label of labels) {
    const track = resultMap.get(label.track_id);
    if (!track) continue;
    if (!label.correct_playlist_id) {
      inboxLabels.push({ track, label });
    } else {
      const key = label.correct_playlist_id;
      if (!byPlaylist.has(key)) byPlaylist.set(key, []);
      byPlaylist.get(key)!.push({ track, label });
    }
  }

  const anthropic = getAnthropic();

  const suggestions = await Promise.all(
    playlists
      .filter((p) => byPlaylist.has(p.id))
      .map(async (playlist) => {
        const examples = byPlaylist.get(playlist.id)!;

        // Tracks labeled as correct for this playlist
        const correct = examples.map(({ track, label }) => ({
          track: `${track.artist} — ${track.name}`,
          genres: track.genres.join(", "),
          audio: track.af_energy !== null
            ? `energy ${track.af_energy.toFixed(2)}, dance ${track.af_danceability?.toFixed(2)}, valence ${track.af_valence?.toFixed(2)}`
            : "no audio features",
          v1_said: track.v1_playlist_name ?? "inbox",
          v2_said: track.v2_playlist_name ?? "inbox",
          v1_reason: track.v1_reason,
          v2_reason: track.v2_reason,
          user_note: label.notes ?? null,
        }));

        // Tracks labeled as inbox that the classifier sent here (false positives)
        const falsePositives = inboxLabels
          .filter(({ track }) => track.v1_playlist_name === playlist.name || track.v2_playlist_name === playlist.name)
          .map(({ track }) => ({
            track: `${track.artist} — ${track.name}`,
            genres: track.genres.join(", "),
            v1_said: track.v1_playlist_name ?? "inbox",
            v2_said: track.v2_playlist_name ?? "inbox",
          }));

        const prompt = `Tu améliores le llm_help_text d'une playlist Spotify personnelle, utilisé pour guider un classificateur LLM.

## Playlist : "${playlist.name}"

llm_help_text actuel :
${playlist.llm_help_text ?? "(vide — aucune description)"}

## Tracks labellisés comme corrects pour cette playlist (ground truth) :
${JSON.stringify(correct, null, 2)}

${falsePositives.length > 0 ? `## Tracks que le classifier a mis ici, mais qui doivent aller en inbox (faux positifs) :
${JSON.stringify(falsePositives, null, 2)}` : ""}

## Ta mission :
Écris un llm_help_text amélioré pour "${playlist.name}" qui :
1. Capture mieux la vibe de ces tracks labellisés
2. Distingue clairement des faux positifs (si présents)
3. Reste concis (3-5 phrases max) et orienté vibe musicale, pas technique
4. Inclut si utile : exemples d'artistes, cas limites, ce qu'on exclut

Réponds avec un objet JSON unique :
{"llm_help_text": "...", "reasoning": "..."}
Le reasoning explique les changements clés par rapport à l'actuel.`;

        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
        const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(text) as { llm_help_text: string; reasoning: string };

        return {
          playlist_id: playlist.id,
          playlist_name: playlist.name,
          current_llm_help_text: playlist.llm_help_text ?? null,
          suggested_llm_help_text: parsed.llm_help_text,
          reasoning: parsed.reasoning,
          examples_count: examples.length,
        };
      })
  );

  return Response.json({ suggestions });
}
