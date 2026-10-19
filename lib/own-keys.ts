import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { check, db } from "./db";
import { decrypt, encrypt } from "./secrets";

/**
 * Un power user (sa propre app Spotify) entre sans invitation : son IA passe toujours par sa clé,
 * jamais par celle de Sortify (décision de Walid, 19/10/2026).
 */
export const POWER_KEY_MISSING = "Avec ta propre app Spotify, l'IA de Sortify passe par ta clé Anthropic : ajoute-la dans les Réglages.";

/**
 * Clé Anthropic personnelle d'un membre, ou null : l'IA passe alors par le compte de Sortify.
 * Erreur pour un power user sans clé utilisable : il ne retombe jamais sur la clé de Sortify.
 */
export async function memberAnthropicKey(memberId: string): Promise<string | null> {
  const row = check(
    await db().from("members").select("anthropic_key_enc, spotify_client_id").eq("spotify_id", memberId).maybeSingle(),
    "Lecture de la clé personnelle",
  ) as { anthropic_key_enc: string | null; spotify_client_id: string | null } | null;
  const power = Boolean(row?.spotify_client_id);
  if (!row?.anthropic_key_enc) {
    if (power) throw new Error(POWER_KEY_MISSING);
    return null;
  }
  try {
    return decrypt(row.anthropic_key_enc);
  } catch (error) {
    // Secret de chiffrement changé : un membre invité retombe sur le compte de Sortify plutôt que d'être bloqué.
    console.error("Clé personnelle illisible :", error instanceof Error ? error.message : error);
    if (power) throw new Error(POWER_KEY_MISSING);
    return null;
  }
}

/** Les 4 derniers caractères, pour montrer quelle clé est enregistrée sans l'afficher. */
export async function anthropicKeyHint(memberId: string): Promise<string | null> {
  const key = await memberAnthropicKey(memberId).catch(() => null);
  return key ? key.slice(-4) : null;
}

/** Vérifie la clé auprès d'Anthropic (appel gratuit) et la renvoie nettoyée ; erreur lisible sinon. */
export async function verifyAnthropicKey(key: string): Promise<string> {
  const clean = key.trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(clean)) throw new Error("Ça ne ressemble pas à une clé Anthropic (elle commence par « sk-ant- »).");
  try {
    await new Anthropic({ apiKey: clean, maxRetries: 1 }).models.list({ limit: 1 });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new Error("Anthropic refuse cette clé : vérifie-la dans ta console Anthropic.");
    }
    throw new Error(`Impossible de vérifier la clé pour l'instant : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  }
  return clean;
}

/** Vérifie la clé, puis l'enregistre chiffrée. null = retirer la clé (impossible pour un power user : il la remplace). */
export async function setAnthropicKey(memberId: string, key: string | null): Promise<void> {
  if (key === null) {
    const row = check(await db().from("members").select("spotify_client_id").eq("spotify_id", memberId).maybeSingle(), "Lecture du membre") as {
      spotify_client_id: string | null;
    } | null;
    if (row?.spotify_client_id) throw new Error("Avec ta propre app Spotify, l'IA passe par ta clé : remplace-la plutôt que de la retirer.");
  }
  const clean = key === null ? null : await verifyAnthropicKey(key);
  check(
    await db().from("members").update({ anthropic_key_enc: clean === null ? null : encrypt(clean) }).eq("spotify_id", memberId),
    "Enregistrement de la clé personnelle",
  );
}
