import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { hasActiveBacs } from "@/lib/library";

/** Première visite : import, analyse et proposition des bacs (phases 2 et 3). */
export default async function RevelationPage() {
  const member = await requireMember();
  if (await hasActiveBacs(member.spotify_id)) redirect("/accueil");

  return (
    <main className="page page--bare">
      <div className="row between">
        <span className="display display--s">Sortify</span>
        <Link href="/reglages" className="btn btn--ghost btn--sm">
          Réglages
        </Link>
      </div>
      <h1 className="display">Salut {member.display_name ?? "toi"}.</h1>
      <p className="muted">L&apos;analyse de ta bibliothèque arrive bientôt ici.</p>
    </main>
  );
}
