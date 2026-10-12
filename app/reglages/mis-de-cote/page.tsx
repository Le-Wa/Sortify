import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { setAsideTracks } from "@/lib/daily";
import { SetAsideList } from "./SetAsideList";

/** Titres que Sortify ne range jamais (mis de côté par la personne, ou sortis de Divers dans Spotify). */
export default async function MisDeCotePage() {
  const member = await requireMember();
  const tracks = await setAsideTracks(member.spotify_id);
  return (
    <main className="page page--bare">
      <Link href="/reglages" className="back">
        ‹ Réglages
      </Link>
      <h1 className="display">Mis de côté</h1>
      <p className="small muted" style={{ margin: 0 }}>
        Ces likes ne sont jamais rangés : podcasts, musique pour enfants, titres que tu ne veux dans aucun bac. « Remettre » les renvoie dans Divers.
      </p>
      {tracks.length === 0 ? <p className="small muted">Aucun titre mis de côté.</p> : <SetAsideList tracks={tracks} />}
    </main>
  );
}
