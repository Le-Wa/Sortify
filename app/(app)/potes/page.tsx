import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { potesOverview } from "@/lib/potes";
import { PoteCard, ShareSwitch } from "./PotesClient";

/** Bacs des potes : l'accord, puis la vitrine de chaque pote qui a dit oui (affinité, bacs, bac commun). */
export default async function PotesPage() {
  const member = await requireMember();
  const view = await potesOverview(member.spotify_id);
  return (
    <>
      <h1 className="display">Les potes</h1>
      {!view.sharing ? (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>
            Montre tes bacs à tes potes, et vois les leurs : votre affinité, leurs bacs, et une playlist à deux. Ils verront le nom, la pochette et les titres des
            bacs que tu choisis. Jamais Divers.
          </p>
          <ShareSwitch on={false} />
          <p className="small muted" style={{ margin: 0 }}>
            {view.waiting > 0 ? `${view.waiting} pote${view.waiting > 1 ? "s ont" : " a"} déjà dit oui.` : "Aucun pote n'a encore dit oui."} Tu choisis les bacs
            partagés dans les Réglages.
          </p>
        </>
      ) : view.potes.length === 0 ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            Tes bacs sont visibles. Aucun pote ne partage encore les siens : ils apparaîtront ici dès qu&apos;ils diront oui.
          </p>
          <ShareSwitch on />
        </>
      ) : (
        <>
          {view.potes.map((p) => (
            <PoteCard key={p.id} pote={p} />
          ))}
          <p className="small muted" style={{ margin: 0 }}>
            Affinité : moitié genres, moitié artistes en commun. Tes bacs partagés se choisissent dans les{" "}
            <Link href="/reglages">Réglages</Link>.
          </p>
        </>
      )}
    </>
  );
}
