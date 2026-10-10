"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        signOut({ callbackUrl: "/" }).catch((error: unknown) => {
          console.error("Déconnexion impossible", error);
          setBusy(false);
        });
      }}
    >
      Se déconnecter
    </button>
  );
}
