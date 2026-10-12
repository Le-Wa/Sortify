import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { basicAuth, type SpotifyApp } from "./spotify/client";

/**
 * Connexion « power user » avec sa propre app Spotify : NextAuth ne connaît que l'app de Sortify, donc l'OAuth
 * se fait à part (/power → Spotify → /api/power/callback), puis un jeton de passage signé ouvre la session NextAuth.
 */
export const POWER_COOKIE = "sortify_power";
export const powerRedirectUri = () => `${env.appUrl}/api/power/callback`;

/** Les identifiants marchent-ils ? (jeton « client credentials », sans compte utilisateur) */
export async function verifyApp(app: SpotifyApp): Promise<boolean> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(app) },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  return res.ok;
}

export const newState = () => randomBytes(18).toString("base64url");

export function authorizeUrl(app: SpotifyApp, scopes: string, state: string): string {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({ client_id: app.clientId, response_type: "code", redirect_uri: powerRedirectUri(), scope: scopes, state, show_dialog: "true" }).toString();
  return url.toString();
}

export async function exchangeCode(app: SpotifyApp, code: string): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(app) },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: powerRedirectUri() }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token || !data.refresh_token || !data.expires_in) {
    throw new Error(`Connexion Spotify refusée : ${data.error_description ?? data.error ?? res.status}`);
  }
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
}

// ── Jeton de passage vers la session NextAuth (2 minutes) ─────────────────────

const HANDOFF_TTL_S = 120;
const sign = (payload: string) => createHmac("sha256", `sortify:passage:${env.nextAuthSecret}`).update(payload).digest("base64url");

export function signHandoff(spotifyId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: spotifyId, exp: Math.floor(Date.now() / 1000) + HANDOFF_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Identifiant Spotify du jeton s'il est authentique et pas expiré, sinon null. */
export function verifyHandoff(token: string): string | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    return sub && exp && exp > Date.now() / 1000 ? sub : null;
  } catch {
    return null;
  }
}
