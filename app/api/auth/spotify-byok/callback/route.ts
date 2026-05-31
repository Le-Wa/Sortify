import { NextRequest, NextResponse } from "next/server";
import { decryptAES256GCM } from "@/lib/crypto";
import { getPendingAuthByState, deletePendingAuth, upsertUserFromByok, markInviteCodeUsed } from "@/lib/supabase/queries";
import { signHandoffToken } from "@/lib/byok-session";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL(`/onboarding?error=${errorParam}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/onboarding?error=missing_params", req.url));
  }

  const pending = await getPendingAuthByState(state);
  if (!pending) {
    return NextResponse.redirect(new URL("/onboarding?error=session_expired", req.url));
  }

  let clientSecret: string;
  try {
    clientSecret = decryptAES256GCM(pending.client_secret_enc);
  } catch {
    return NextResponse.redirect(new URL("/onboarding?error=decrypt_failed", req.url));
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/spotify-byok/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${pending.client_id}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/onboarding?error=token_exchange_failed", req.url));
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Fetch Spotify user profile
  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as {
    id: string;
    email?: string;
    display_name?: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

  await upsertUserFromByok({
    spotifyId: profile.id,
    email: profile.email ?? null,
    displayName: profile.display_name ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    clientId: pending.client_id,
    clientSecretEnc: pending.client_secret_enc,
    invitedBy: pending.invited_by ?? undefined,
  });

  // Mark invite code as used if applicable (best-effort)
  if (pending.invited_by) {
    // We stored invited_by in pending_auth — the actual code hash isn't tracked here
    // markInviteCodeUsed was called during /api/invites/validate; nothing more to do
  }

  await deletePendingAuth(pending.nonce);

  const handoffToken = signHandoffToken(profile.id, profile.display_name ?? profile.id);

  const response = NextResponse.redirect(
    new URL(`/onboarding/connect?token=${encodeURIComponent(handoffToken)}`, req.url)
  );
  // Clear the nonce cookie
  response.cookies.set("byok_nonce", "", { maxAge: 0, path: "/" });
  return response;
}
