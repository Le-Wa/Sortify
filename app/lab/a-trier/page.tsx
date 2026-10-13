import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { activeBacs, chip, type PendingItem } from "@/lib/daily";
import { TriageScreen } from "../../(app)/a-trier/TriageScreen";

/**
 * Planche vivante d'À trier (développement seulement) : de vrais bacs, des titres de démonstration, rien n'est enregistré.
 * Pour essayer les filtres, le geste et la célébration du comptoir vide.
 */
export default async function TriageLab() {
  if (process.env.NODE_ENV === "production") notFound();
  const member = await requireMember();
  const bacs = await activeBacs(member.spotify_id);
  const chips = bacs.filter((b) => !b.is_divers).map((b) => ({ ...chip(b), is_divers: false }));
  const pick = (i: number) => chips[i % chips.length];
  const demo: PendingItem[] = Array.from({ length: 8 }, (_, i) => ({
    track_id: `demo${i}`,
    title: ["Ready", "Diana", "Aube", "Fade Away", "Jah", "Monalisa", "Lost Signal", "Body Drop"][i],
    artist: ["Dyce", "Fred again..", "Galion", "Kelly Boesch", "Kalash", "Kalipsxau", "Kelly Boesch", "HUGEL"][i],
    cover_url: null,
    isrc: null,
    reason: "Exemple de raison donnée par l'IA.",
    suggestions:
      i % 3 === 0
        ? [{ bac: pick(0), confidence: 0.46 }]
        : [
            { bac: pick(i % 2), confidence: 0.58 },
            { bac: pick(2 + (i % 3)), confidence: i % 2 ? 0.52 : 0.41 },
          ],
  }));
  return (
    <main className="page">
      <TriageScreen demo queue={demo} bacs={chips} nextTri="lundi vers 08:00" />
    </main>
  );
}
