"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { SCOPES } from "@/lib/auth";
import { normalizeCode } from "@/lib/members";
import { authorizeUrl, newState, POWER_COOKIE, verifyApp } from "@/lib/power-login";
import { encrypt } from "@/lib/secrets";

const schema = z.object({
  clientId: z.string().trim().regex(/^[0-9a-f]{32}$/i, "Le Client ID fait 32 caractères (chiffres et lettres a à f)."),
  clientSecret: z.string().trim().regex(/^[0-9a-f]{32}$/i, "Le Client Secret fait 32 caractères (chiffres et lettres a à f)."),
  code: z.string().trim().max(20),
});

/** Vérifie l'app Spotify du power user, garde ses identifiants le temps de la connexion, et renvoie l'adresse d'autorisation. */
export async function startPowerLogin(input: { clientId: string; clientSecret: string; code: string }): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Identifiants invalides." };
  const app = { clientId: parsed.data.clientId, clientSecret: parsed.data.clientSecret };
  if (!(await verifyApp(app))) return { ok: false, message: "Spotify refuse ces identifiants : vérifie le Client ID et le Client Secret de ton app." };
  const state = newState();
  const pending = { ...app, invite: parsed.data.code ? normalizeCode(parsed.data.code) : null, state, exp: Date.now() + 10 * 60_000 };
  (await cookies()).set(POWER_COOKIE, encrypt(JSON.stringify(pending)), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return { ok: true, url: authorizeUrl(app, SCOPES, state) };
}
