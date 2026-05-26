import { createClient } from "@/lib/supabase/client";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export async function refreshSpotifyToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
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
    .select("access_token, refresh_token, expires_at")
    .eq("spotify_id", userId)
    .single();

  if (error || !user) throw new Error(`User not found in DB: ${userId}`);

  if (Date.now() < user.expires_at * 1000 - EXPIRY_MARGIN_MS) {
    return user.access_token;
  }

  const refreshed = await refreshSpotifyToken(user.refresh_token);

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
