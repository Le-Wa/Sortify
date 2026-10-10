import "server-only";
import { env } from "@/lib/env";
import { getMember, saveTokens, type SpotifyTokens } from "@/lib/members";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const API = "https://api.spotify.com/v1";
const EXPIRY_MARGIN_S = 5 * 60;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function refreshTokens(refreshToken: string): Promise<SpotifyTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token || !data.expires_in) {
    throw new Error(`Rafraîchissement du token Spotify impossible : ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

/** Token d'accès valide pour un membre, rafraîchi et sauvegardé si besoin. */
export async function accessTokenFor(spotifyId: string): Promise<string> {
  const member = await getMember(spotifyId);
  if (!member) throw new Error(`Membre inconnu : ${spotifyId}`);
  if (Date.now() / 1000 < member.expires_at - EXPIRY_MARGIN_S) return member.access_token;
  const tokens = await refreshTokens(member.refresh_token);
  await saveTokens(spotifyId, tokens);
  return tokens.access_token;
}

export class SpotifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Appel à l'API Spotify pour un membre : token, retries sur 429 et 5xx, erreur explicite. */
export async function spotify<T>(
  spotifyId: string,
  pathOrUrl: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
  const { json, headers: extra, ...rest } = init;
  const token = await accessTokenFor(spotifyId);
  const headers = new Headers(extra);
  headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) headers.set("Content-Type", "application/json");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const waitS = Number(res.headers.get("Retry-After") ?? 2 ** attempt);
      await sleep((waitS + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SpotifyError(`Spotify ${init.method ?? "GET"} ${url} → ${res.status} ${body.slice(0, 300)}`, res.status);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
