import { createClient } from "@/lib/supabase/client";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

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
      refresh_token: user.refresh_token,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${data.error_description ?? data.error}`);
  }

  const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  // Spotify may rotate the refresh_token — always persist the latest one
  const newRefreshToken: string = data.refresh_token ?? user.refresh_token;

  await supabase
    .from("users")
    .update({
      access_token: data.access_token,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
    })
    .eq("spotify_id", userId);

  return data.access_token as string;
}
