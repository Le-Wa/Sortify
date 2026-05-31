import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateInviteCode, hashInviteCode } from "@/lib/crypto";
import { createInviteCode } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Dev invite route must not be included in production builds");
}

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

  const timestamp = Date.now();
  const code = generateInviteCode(user.id, timestamp);
  const codeHash = hashInviteCode(code);
  await createInviteCode(user.id, codeHash);

  return NextResponse.json({ code });
}
