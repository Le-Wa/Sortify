"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Sleeve } from "./Sleeve";
import { HowItWorks } from "./pedagogie/HowItWorks";

type Target = "invitation" | "power";

/**
 * Écran de connexion, partagé par la page d'accueil publique et la démo de l'onboarding (`/lab/onboarding`).
 * `primary` : le bouton Spotify ; `onNavigate` (démo) remplace les liens vers le code d'invitation et le power user.
 */
export function ConnexionView({ error, primary, onNavigate }: { error?: string; primary: ReactNode; onNavigate?: (target: Target) => void }) {
  const style = { alignSelf: "center", display: "flex", alignItems: "center" } as const;
  const go = (target: Target, className: string, children: ReactNode) =>
    onNavigate ? (
      <button type="button" className={className} style={style} onClick={() => onNavigate(target)}>
        {children}
      </button>
    ) : (
      <Link href={`/${target}`} className={className} style={style}>
        {children}
      </Link>
    );
  return (
    <main className="page page--bare">
      <div className="row between label">
        <span className="display display--s">Sortify</span>
        <span>Disquaire perso · bac 00</span>
      </div>

      <div className="hero-stack" aria-hidden="true">
        <Sleeve name="Soirée potes" color="#FF6A13" size={196} mark={{ shape: "starburst", outline: true }} rotate={-9} className="hero-a" />
        <Sleeve name="Club 2h du mat'" color="#2448D8" size={196} mark={{ shape: "bolt", outline: false }} rotate={6} className="hero-b" />
        <Sleeve name="Dimanche lent" color="#FF9FCB" size={196} mark={{ shape: "crescent", outline: true }} rotate={-1.5} className="hero-c" />
      </div>

      <h1 className="display display--xl">
        Tu likes.
        <br />
        Sortify range.
      </h1>

      <ol className="steps">
        <li>
          <span className="mono">01</span>
          <span>
            <b>Tu likes sur Spotify</b>, comme d&apos;habitude.
          </span>
        </li>
        <li>
          <span className="mono">02</span>
          <span>
            <b>L&apos;IA imagine tes bacs</b> à partir de tes 1 000 derniers likes.
          </span>
        </li>
        <li>
          <span className="mono">03</span>
          <span>
            <b>Elle range chaque nouveau like</b>, chaque semaine.
          </span>
        </li>
      </ol>

      <HowItWorks />

      <div className="grow" />

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="stack">
        {primary}
        <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
          Tes playlists actuelles ne sont pas touchées.
        </p>
        {go("invitation", "link-btn", <>Première fois ? J&apos;ai un code d&apos;invitation</>)}
        {go("power", "link-btn small", "Power user : utiliser ma propre app Spotify")}
      </div>
    </main>
  );
}
