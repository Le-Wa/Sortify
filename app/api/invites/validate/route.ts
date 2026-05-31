import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hashInviteCode, encryptAES256GCM } from "@/lib/crypto";
import { getInviteCode, createPendingAuth } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== "string") {
    return NextResponse.json({ error: "code requis" }, { status: 400 });
  }

  const codeHash = hashInviteCode(body.code.trim().toUpperCase());
  const invite = await getInviteCode(codeHash);

  if (!invite) {
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });
  }
  if (invite.used_by) {
    return NextResponse.json({ error: "Ce code a déjà été utilisé" }, { status: 400 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Code expiré" }, { status: 400 });
  }

  // Fetch inviter's credentials
  const supabase = createClient();
  const { data: inviter } = await supabase
    .from("users")
    .select("spotify_id, spotify_client_id, spotify_client_secret_enc")
    .eq("id", invite.inviter_id)
    .single();

  let clientId: string;
  let clientSecretEnc: string;

  if (inviter?.spotify_client_id && inviter.spotify_client_secret_enc) {
    // BYOK inviter — use their credentials
    clientId = inviter.spotify_client_id;
    clientSecretEnc = inviter.spotify_client_secret_enc;
  } else if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    // v1 inviter or dev — fall back to shared app credentials
    // Use ENCRYPTION_KEY if available, otherwise a dev-only fallback key
    const encKey = process.env.ENCRYPTION_KEY ?? "6465766b65796465766b65796465766b65796465766b65796465766b65793132";
    clientId = process.env.SPOTIFY_CLIENT_ID;
    clientSecretEnc = encryptAES256GCM(process.env.SPOTIFY_CLIENT_SECRET, encKey);
  } else {
    return NextResponse.json({ error: "L'invitant n'a pas de credentials configurés" }, { status: 400 });
  }

  const nonce = randomBytes(24).toString("base64url");
  await createPendingAuth(nonce, clientId, clientSecretEnc, invite.inviter_id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("byok_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
  return response;
}
