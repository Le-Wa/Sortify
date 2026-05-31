import { createClient } from "@/lib/supabase/client";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export async function refreshSpotifyToken(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const id = clientId ?? process.env.SPOTIFY_CLIENT_ID!;
  const secret = clientSecret ?? process.env.SPOTIFY_CLIENT_SECRET!;
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${data.error_description ?? data.error}`);
  }

  return {
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token ?? refreshToken) as string,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in as number),
  };
}

export async function refreshAccessToken(userId: string): Promise<string> {
  const supabase = createClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("access_token, refresh_token, expires_at, spotify_client_id, spotify_client_secret_enc")
    .eq("spotify_id", userId)
    .single();

  if (error || !user) throw new Error(`User not found in DB: ${userId}`);

  if (Date.now() < user.expires_at * 1000 - EXPIRY_MARGIN_MS) {
    return user.access_token;
  }

  let clientId: string | undefined;
  let clientSecret: string | undefined;
  if (user.spotify_client_id && user.spotify_client_secret_enc) {
    const { decryptAES256GCM } = await import("@/lib/crypto");
    clientId = user.spotify_client_id;
    clientSecret = decryptAES256GCM(user.spotify_client_secret_enc);
  }

  const refreshed = await refreshSpotifyToken(user.refresh_token, clientId, clientSecret);

  await supabase
    .from("users")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    })
    .eq("spotify_id", userId);

  return refreshed.access_token;
}
