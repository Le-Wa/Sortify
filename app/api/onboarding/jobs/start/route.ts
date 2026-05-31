import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding, updateOnboardingStatus } from "@/lib/supabase/queries";
import { runOnboardingJob } from "@/lib/onboarding/job";
import { createClient } from "@/lib/supabase/client";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  if (user.onboarding_status === "complete") {
    return NextResponse.json({ ok: true, done: true });
  }

  // Resume from current step if already in progress
  const startStep = user.onboarding_step > 0 ? user.onboarding_step : 1;

  const result = await runOnboardingJob(session.userId, user.id, startStep);

  if (!result.done && !result.error) {
    // If job was interrupted (budget exhausted), client should call again
    return NextResponse.json({ ok: true, done: false, step: result.step });
  }

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error, step: result.step }, { status: 500 });
  }

  return NextResponse.json({ ok: true, done: true });
}
