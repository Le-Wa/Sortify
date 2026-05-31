import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@/lib/supabase/client";
import { createHash, randomBytes } from "crypto";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("spotify_id", session.userId)
    .single();

  if (!user) return NextResponse.json({ error: "User non trouvé" }, { status: 404 });

  // Code aléatoire simple pour le dev — pas besoin de ENCRYPTION_KEY
  const words = ["BEAT", "DROP", "VIBE", "TUNE", "WAVE", "FLOW", "SOUL", "JAZZ"];
  const word = words[Math.floor(Math.random() * words.length)];
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const code = `${word}-${suffix}`;
  const codeHash = createHash("sha256").update(code).digest("hex");

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("invite_codes").insert({
    inviter_id: user.id,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code });
}
