import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getPendingAuthByNonce, setPendingAuthState } from "@/lib/supabase/queries";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
].join(" ");

export async function GET(req: NextRequest) {
  const nonce = req.cookies.get("byok_nonce")?.value;
  if (!nonce) {
    return NextResponse.redirect(new URL("/onboarding?error=session_expired", req.url));
  }

  const pending = await getPendingAuthByNonce(nonce);
  if (!pending) {
    return NextResponse.redirect(new URL("/onboarding?error=session_expired", req.url));
  }

  const state = randomBytes(24).toString("base64url");
  await setPendingAuthState(nonce, state);

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/spotify-byok/callback`;
  const params = new URLSearchParams({
    client_id: pending.client_id,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    show_dialog: "true",
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
