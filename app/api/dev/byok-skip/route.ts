/**
 * Dev bypass: saute complètement l'OAuth Spotify.
 * Retourne un handoff token pour le user actuellement connecté,
 * et avance son onboarding_status à 'in_progress'.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { signHandoffToken } from "@/lib/byok-session";
import { createClient } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient();

  // Avance le statut du persona pour qu'il arrive à S3 après le "OAuth"
  await supabase
    .from("users")
    .update({ onboarding_status: "in_progress", onboarding_step: 0 })
    .eq("spotify_id", session.userId);

  const displayName = session.user?.name ?? session.userId;
  const token = signHandoffToken(session.userId, displayName);

  return NextResponse.json({ token });
}
