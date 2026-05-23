import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Anthropic from "@anthropic-ai/sdk";
import type { PlaylistRules } from "@/lib/types";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM = `Tu es un système de configuration de classificateur musical.
À partir d'une description textuelle, tu génères des règles JSON pour un classifier de playlists musicales.

Si la description est trop vague pour générer des règles utiles (pas de genres, d'artistes, ni d'ambiance musicale identifiable), réponds UNIQUEMENT avec :
{"error": "Description trop vague : précise des genres, des artistes ou une ambiance musicale."}

Sinon, réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
{
  "rules": {
    "genres": {
      "include": ["genre1", "genre2"],
      "exclude": []
    },
    "audio_features": {
      "energy": { "min": 0.0, "max": 1.0 }
    },
    "hard_constraints": {
      "max_age_days": null,
      "require_genre_signal": false
    }
  },
  "llm_help_text": "Description de la vibe en français, 1-2 phrases."
}

Contraintes :
- genres.include : genres Spotify valides, en minuscules
- audio_features : uniquement si la description l'implique (ex: "très énergique", "tempo rapide")
  Plages valides : energy/danceability/valence/acousticness = 0.0-1.0, tempo = 60-200 (BPM)
- require_genre_signal : true si les genres sont indispensables pour identifier cette playlist
- llm_help_text : 1-2 phrases décrivant la vibe, utilisées pour l'arbitrage LLM`;

function isValidRules(r: unknown): r is PlaylistRules {
  if (typeof r !== "object" || r === null) return false;
  const obj = r as Record<string, unknown>;
  const g = obj.genres as Record<string, unknown> | undefined;
  const hc = obj.hard_constraints as Record<string, unknown> | undefined;
  return (
    Array.isArray(g?.include) &&
    Array.isArray(g?.exclude) &&
    typeof hc?.require_genre_signal === "boolean" &&
    typeof obj.audio_features === "object" &&
    obj.audio_features !== null
  );
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { description?: unknown };
  if (typeof body.description !== "string" || body.description.trim().length === 0) {
    return Response.json({ error: "Missing description" }, { status: 400 });
  }

  const description = body.description.trim();
  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: `Description : "${description}"` }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "LLM returned invalid JSON" }, { status: 500 });
  }

  if (typeof parsed.error === "string") {
    return Response.json({ error: parsed.error }, { status: 422 });
  }

  if (!isValidRules(parsed.rules)) {
    return Response.json({ error: "LLM returned invalid rules structure" }, { status: 500 });
  }

  return Response.json({
    rules: parsed.rules as PlaylistRules,
    llm_help_text: typeof parsed.llm_help_text === "string" ? parsed.llm_help_text : null,
  });
}
