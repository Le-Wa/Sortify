"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { SCOPES } from "@/lib/auth";
import { verifyAnthropicKey } from "@/lib/own-keys";
import { authorizeUrl, newState, POWER_COOKIE, verifyApp } from "@/lib/power-login";
import { encrypt } from "@/lib/secrets";

const schema = z.object({
  clientId: z.string().trim().regex(/^[0-9a-f]{32}$/i, "Le Client ID fait 32 caractères (chiffres et lettres a à f)."),
  clientSecret: z.string().trim().regex(/^[0-9a-f]{32}$/i, "Le Client Secret fait 32 caractères (chiffres et lettres a à f)."),
  anthropicKey: z.string().trim().min(1, "Ta clé Anthropic est obligatoire : avec ta propre app Spotify, l'IA passe par ta clé.").max(300),
});

/**
 * Vérifie l'app Spotify du power user et sa clé Anthropic (obligatoire : il entre sans invitation et paie son IA),
 * garde le tout chiffré le temps de la connexion, et renvoie l'adresse d'autorisation. La clé est enregistrée au retour,
 * avant que l'analyse ne démarre.
 */
export async function startPowerLogin(input: {
  clientId: string;
  clientSecret: string;
  anthropicKey: string;
}): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Identifiants invalides." };
  const app = { clientId: parsed.data.clientId, clientSecret: parsed.data.clientSecret };
  if (!(await verifyApp(app))) return { ok: false, message: "Spotify refuse ces identifiants : vérifie le Client ID et le Client Secret de ton app." };
  let anthropicKey: string;
  try {
    anthropicKey = await verifyAnthropicKey(parsed.data.anthropicKey);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Clé Anthropic invalide." };
  }
  const state = newState();
  const pending = { ...app, anthropicKey, state, exp: Date.now() + 10 * 60_000 };
  (await cookies()).set(POWER_COOKIE, encrypt(JSON.stringify(pending)), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return { ok: true, url: authorizeUrl(app, SCOPES, state) };
}
