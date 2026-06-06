import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { TaxonomyProposal } from "@/app/api/onboarding/propose-taxonomy/route";

// PATCH: update llm_help_text of a specific playlist in taxonomy_proposal
// body: { playlist_index: number; llm_help_text: string }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const body = await req.json() as { playlist_index: number; llm_help_text: string };
  if (typeof body.playlist_index !== "number" || typeof body.llm_help_text !== "string") {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("taxonomy_proposal")
    .eq("id", user.id)
    .single();

  if (!userRow?.taxonomy_proposal) {
    return NextResponse.json({ error: "Aucune proposition en cours" }, { status: 404 });
  }

  const proposal = userRow.taxonomy_proposal as TaxonomyProposal;
  if (!proposal.playlists[body.playlist_index]) {
    return NextResponse.json({ error: "Index de playlist invalide" }, { status: 400 });
  }

  proposal.playlists[body.playlist_index].llm_help_text = body.llm_help_text;

  const { error } = await supabase
    .from("users")
    .update({ taxonomy_proposal: proposal })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE: clear taxonomy_proposal after validation
export async function DELETE(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await getUserWithOnboarding(session.userId);
  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ taxonomy_proposal: null })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
