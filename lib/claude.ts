import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Analyse de la bibliothèque : appel rare, la qualité prime (spec 02 — « le plus capable »). */
export const ANALYSIS_MODEL = "claude-fable-5-1";
/** Retouches de la proposition (autre idée, fusion, bac sur mesure) : l'utilisateur attend la réponse. */
export const EDIT_MODEL = "claude-opus-5-5";
/**
 * Rangement des titres. Sonnet plutôt que Haiku depuis le banc d'essai du 10/10/2026
 * (docs/bench/2026-10-10-banc-essai.md) : +10 points de justesse, décisions stables, ~0,15 centime par titre.
 */
export const SORT_MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

/** Client Anthropic (clé ANTHROPIC_API_KEY lue par le SDK). */
export function claude(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 3 });
  return client;
}

/** Texte d'une réponse, après vérification qu'elle est complète. */
export function responseText(
  message: { content: Array<{ type: string; text?: string }>; stop_reason: string | null },
  context: string,
): string {
  if (message.stop_reason === "refusal") throw new Error(`${context} : le modèle a refusé de répondre`);
  if (message.stop_reason === "max_tokens") throw new Error(`${context} : réponse tronquée (max_tokens)`);
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) throw new Error(`${context} : réponse vide`);
  return text;
}
