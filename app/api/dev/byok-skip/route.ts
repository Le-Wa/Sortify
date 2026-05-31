import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { encryptAES256GCM } from "@/lib/crypto";
import { createPendingAuth } from "@/lib/supabase/queries";

if (process.env.NODE_ENV === "production") {
  throw new Error("Dev byok-skip route must not be included in production builds");
}

// Crée un pending_auth avec les credentials partagés de l'app (env vars)
// pour bypasser S2 en dev sans avoir à entrer ses propres credentials.
export async function POST(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "SPOTIFY_CLIENT_ID / SECRET non configurés" }, { status: 500 });
  }

  const secretEnc = encryptAES256GCM(clientSecret);
  const nonce = randomBytes(24).toString("base64url");
  await createPendingAuth(nonce, clientId, secretEnc);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("byok_nonce", nonce, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
  return response;
}
