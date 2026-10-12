// Vérifie le calcul « Divers » de l'écran Proposition sur les bacs actifs d'un membre (lecture seule).
import { proposalImpact } from "@/lib/revelation";
import { db } from "@/lib/db";
for (const order of [true, false]) {
  const { data: m } = await db().from("members").select("spotify_id, display_name").order("created_at", { ascending: order }).limit(1).single();
  const { data: bacs } = await db().from("bacs").select("id, name, status").eq("member_id", m!.spotify_id).eq("status", "active").eq("is_divers", false);
  const asProposal = (bacs ?? []).map((b) => ({ ...b, status: "proposed" }));
  const impact = await proposalImpact(m!.spotify_id, asProposal);
  console.log(`${m!.display_name} : Divers ${impact.divers} / ${impact.total} ·`, (bacs ?? []).map((b) => `${b.name} ${impact.alone.get(b.id)}`).join(", "));
}
