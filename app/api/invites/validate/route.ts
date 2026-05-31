import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hashInviteCode } from "@/lib/crypto";
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

  if (!inviter?.spotify_client_id || !inviter.spotify_client_secret_enc) {
    return NextResponse.json({ error: "L'invitant n'a pas de credentials configurés" }, { status: 400 });
  }

  // Re-encrypt the secret with the same key (it's already encrypted; pass it through)
  const nonce = randomBytes(24).toString("base64url");
  await createPendingAuth(nonce, inviter.spotify_client_id, inviter.spotify_client_secret_enc, invite.inviter_id);

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
