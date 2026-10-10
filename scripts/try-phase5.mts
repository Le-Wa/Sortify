// Essai : ajustement d'une fiche (sans écriture) et suggestion depuis Divers (écrit une suggestion, ou note une vérification).
import { adjustFiche } from "@/lib/ai/fiches";
import { listBacs } from "@/lib/bacs";
import { db } from "@/lib/db";
import { suggestFromDivers } from "@/lib/suggestions";

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const id = member!.spotify_id;
const bacs = await listBacs(id, ["active"]);
const soul = bacs.find((b) => b.name === "Soul nocturne")!;
let t = Date.now();
const adjusted = await adjustFiche(soul, "plus de soul rétro des années 70, moins de RnB moderne", bacs.filter((b) => b.id !== soul.id));
console.log(`Ajustement (${((Date.now() - t) / 1000).toFixed(0)} s)\n  pitch : ${adjusted.pitch}\n  brief : ${adjusted.brief.slice(0, 300)}…`);

t = Date.now();
await suggestFromDivers(id);
const { data: s } = await db().from("suggestions").select("kind, origin, status, payload").eq("origin", "divers").order("created_at", { ascending: false }).limit(1);
console.log(`Suggestion depuis Divers (${((Date.now() - t) / 1000).toFixed(0)} s) :`, JSON.stringify(s?.[0] ? { status: s[0].status, reason: s[0].payload.reason, name: s[0].payload.fiche?.name, pitch: s[0].payload.fiche?.pitch, n: s[0].payload.trackIds?.length } : null));
