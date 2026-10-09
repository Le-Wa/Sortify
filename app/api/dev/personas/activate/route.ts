import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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

  // Copy real Spotify tokens to the persona so it can make actual API calls.
  // If the current session is a real (non-dev) user, use their tokens.
  // If the session is a dev persona, find the real user from DB directly.
  const session = await getServerSession(authOptions);
  const realSpotifyId = session?.userId && !session.userId.startsWith("dev_")
    ? session.userId
    : null;

  const realUserQuery = realSpotifyId
    ? supabase.from("users").select("access_token, refresh_token, expires_at, spotify_client_id, spotify_client_secret_enc").eq("spotify_id", realSpotifyId).single()
    : supabase.from("users").select("access_token, refresh_token, expires_at, spotify_client_id, spotify_client_secret_enc").not("spotify_id", "like", "dev_%").not("access_token", "eq", "dev_token").order("created_at", { ascending: false }).limit(1).single();

  const { data: realUser } = await realUserQuery;
  if (realUser) {
    await supabase
      .from("users")
      .update({
        access_token: realUser.access_token,
        refresh_token: realUser.refresh_token,
        expires_at: realUser.expires_at,
        spotify_client_id: realUser.spotify_client_id ?? null,
        spotify_client_secret_enc: realUser.spotify_client_secret_enc ?? null,
      })
      .eq("spotify_id", spotifyId);
  }

  const token = signHandoffToken(user.spotify_id, user.email ?? spotifyId);
  return NextResponse.json({ token });
}
