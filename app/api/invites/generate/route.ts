import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hashInviteCode, generateInviteCode } from "@/lib/crypto";
import { getActiveInviteCount, createInviteCode } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

const MAX_INVITES = 5;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, onboarding_status")
    .eq("spotify_id", session.userId)
    .single();

  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  if (user.onboarding_status !== "complete") {
    return NextResponse.json({ error: "Onboarding non complété" }, { status: 403 });
  }

  const activeCount = await getActiveInviteCount(user.id);
  if (activeCount >= MAX_INVITES) {
    return NextResponse.json(
      { error: `Tu as déjà ${MAX_INVITES} codes actifs — attends qu'un soit utilisé ou expiré` },
      { status: 400 }
    );
  }

  const timestamp = Date.now();
  const code = generateInviteCode(user.id, timestamp);
  const codeHash = hashInviteCode(code);
  await createInviteCode(user.id, codeHash);

  return NextResponse.json({ code });
}
