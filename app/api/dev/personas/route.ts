import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@/lib/supabase/client";
import { randomBytes } from "crypto";

if (process.env.NODE_ENV === "production") {
  throw new Error("Dev personas route must not be included in production builds");
}

const DEV_PREFIX = "dev_";

// GET — list all dev personas
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, spotify_id, email, onboarding_status, onboarding_step, onboarding_mode")
    .like("spotify_id", `${DEV_PREFIX}%`)
    .order("email");
  return NextResponse.json(data ?? []);
}

// POST — create a new dev persona
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label: string = body.label ?? "Sans nom";
  const initialStatus: string = body.status ?? "pending";
  const initialStep: number = body.step ?? 0;
  const initialMode: string | null = body.mode ?? null;

  const suffix = randomBytes(4).toString("hex");
  const spotifyId = `${DEV_PREFIX}${label.toLowerCase().replace(/\s+/g, "_")}_${suffix}`;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      spotify_id: spotifyId,
      email: label,
      onboarding_status: initialStatus,
      onboarding_step: initialStep,
      onboarding_mode: initialMode,
      // Required fields with safe defaults
      access_token: "dev_token",
      refresh_token: "dev_refresh",
      expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    })
    .select("id, spotify_id, email, onboarding_status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE — remove a dev persona
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spotifyId = searchParams.get("spotify_id");
  if (!spotifyId?.startsWith(DEV_PREFIX)) {
    return NextResponse.json({ error: "Seuls les personas dev peuvent être supprimés" }, { status: 400 });
  }
  const supabase = createClient();
  await supabase.from("users").delete().eq("spotify_id", spotifyId);
  return NextResponse.json({ ok: true });
}
