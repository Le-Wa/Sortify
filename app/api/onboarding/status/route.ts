import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, onboarding_status, onboarding_step, onboarding_mode")
    .eq("spotify_id", session.userId)
    .single();

  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const [tracksRes, inboxRes] = await Promise.all([
    supabase
      .from("tracks")
      .select("id, classified_at, enriched_at", { count: "exact" })
      .eq("user_id", user.id),
    supabase
      .from("tracks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("needs_review", true),
  ]);

  const tracks = tracksRes.data ?? [];
  const total = tracks.length;
  const enriched = tracks.filter((t) => t.enriched_at).length;
  const classified = tracks.filter((t) => t.classified_at).length;
  const inboxCount = inboxRes.count ?? 0;

  // Map onboarding_step to step name
  const stepNames: Record<number, string> = {
    0: "idle",
    1: "import",
    2: "enrich",
    3: "classify",
    4: "done",
  };
  const step = stepNames[user.onboarding_step] ?? "import";

  // Compute percentage
  let pct = 0;
  if (total > 0) {
    if (step === "import") pct = Math.min(10, Math.round((classified / Math.max(total, 1)) * 10));
    else if (step === "enrich") pct = 10 + Math.round((enriched / total) * 40);
    else if (step === "classify") pct = 50 + Math.round((classified / total) * 50);
    else if (step === "done") pct = 100;
  }
  if (user.onboarding_status === "complete") pct = 100;

  return NextResponse.json({
    pct,
    step,
    imported: total,
    classified,
    inbox_count: inboxCount,
    onboarding_status: user.onboarding_status,
  });
}
