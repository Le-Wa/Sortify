import { NextRequest, NextResponse } from "next/server";
import { signHandoffToken } from "@/lib/byok-session";
import { createClient } from "@/lib/supabase/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Dev personas route must not be included in production builds");
}

// POST { spotify_id } → returns a handoff token to sign in as the persona
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const spotifyId: string | undefined = body.spotify_id;

  if (!spotifyId?.startsWith("dev_")) {
    return NextResponse.json({ error: "Persona ID invalide" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("spotify_id, email")
    .eq("spotify_id", spotifyId)
    .single();

  if (!user) return NextResponse.json({ error: "Persona non trouvé" }, { status: 404 });

  const token = signHandoffToken(user.spotify_id, user.email ?? spotifyId);
  return NextResponse.json({ token });
}
