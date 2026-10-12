"use client";

import Link from "next/link";

/** Première arrivée sur l'Accueil : ce qui vient, et deux réglages utiles. Une seule fois. */
export function WelcomeCard({ nextTri, onClose }: { nextTri: string; onClose: () => void }) {
  return (
    <section className="welcome">
      <span className="label">Bienvenue chez ton disquaire</span>
      <h2 className="display display--s" style={{ margin: 0, fontSize: 26 }}>
        Tes bacs sont dans Spotify.
      </h2>
      <ul className="welcome__list">
        <li>
          <span aria-hidden="true">✓</span>
          <span>Tes playlists Sortify sont créées, avec leur pochette.</span>
        </li>
        <li>
          <span aria-hidden="true">→</span>
          <span>
            Premier tri <b>{nextTri}</b> : tu likes, Sortify range.
          </span>
        </li>
        <li>
          <span aria-hidden="true">→</span>
          <span>
            <b>Installe Sortify</b> sur ton écran d&apos;accueil (iPhone : Partager → « Sur l&apos;écran d&apos;accueil ») et active{" "}
            <Link href="/reglages">« Prévenir le lundi »</Link>.
          </span>
        </li>
        <li>
          <span aria-hidden="true">→</span>
          <span>
            En bas : <b>À trier</b> quand l&apos;IA hésite, <b>Bacs</b> pour tout retoucher, <b>Arrivages</b> pour chaque semaine.
          </span>
        </li>
      </ul>
      <button type="button" className="btn btn--sm" onClick={onClose}>
        C&apos;est noté
      </button>
    </section>
  );
}
