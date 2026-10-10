"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

/** Lance la connexion Spotify ; au retour, la page d'accueil aiguille le membre. */
export function SpotifyButton({ label = "Se connecter avec Spotify" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        signIn("spotify", { callbackUrl: "/" }).catch((error: unknown) => {
          console.error("Connexion Spotify impossible", error);
          setBusy(false);
        });
      }}
    >
      {busy ? "Ouverture de Spotify…" : label}
    </button>
  );
}
