import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

const Body = z.object({
  sample_size: z.number().int().positive().nullable(),
  period_months: z.number().int().positive().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const supabase = createClient();
  await supabase
    .from("users")
    .update({
      onboarding_mode: "auto",
      onboarding_status: "in_progress",
      onboarding_step: 1,
      proposal_ready: false,
      onboarding_config: {
        sample_size: parsed.data.sample_size,
        period_months: parsed.data.period_months,
      },
    })
    .eq("id", user.id);

  // Fire-and-forget — client polls for progress
  fetch(`${process.env.NEXTAUTH_URL}/api/onboarding/jobs/start`, {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") ?? "" },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
