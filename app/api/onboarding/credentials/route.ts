import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { encryptAES256GCM } from "@/lib/crypto";
import { createPendingAuth } from "@/lib/supabase/queries";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const CLIENT_ID_RE = /^[0-9a-f]{32}$/;
const CLIENT_SECRET_RE = /^[0-9a-f]{32}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.client_id !== "string" || typeof body.client_secret !== "string") {
    return NextResponse.json({ error: "client_id and client_secret are required" }, { status: 400 });
  }

  const { client_id, client_secret } = body as { client_id: string; client_secret: string };

  if (!CLIENT_ID_RE.test(client_id)) {
    return NextResponse.json({ error: "Client ID invalide (32 caractères hexadécimaux attendus)" }, { status: 400 });
  }
  if (!CLIENT_SECRET_RE.test(client_secret)) {
    return NextResponse.json({ error: "Client Secret invalide (32 caractères hexadécimaux attendus)" }, { status: 400 });
  }

  // Test credentials against Spotify
  const testRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!testRes.ok) {
    const err = await testRes.json().catch(() => ({}));
    if (testRes.status === 401) {
      return NextResponse.json({ error: "Credentials invalides — vérifie ton Client ID et Client Secret" }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Erreur Spotify (${testRes.status}) — réessaie dans un instant` },
      { status: 502 }
    );
  }

  const encKey = process.env.ENCRYPTION_KEY ?? "6465766b65796465766b65796465766b65796465766b65796465766b65793132";
  const secretEnc = encryptAES256GCM(client_secret, encKey);
  const nonce = randomBytes(24).toString("base64url");
  await createPendingAuth(nonce, client_id, secretEnc);

  const response = NextResponse.json({ ok: true, client_id });
  response.cookies.set("byok_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
  return response;
}
