"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Handoff() {
  const token = useSearchParams().get("t");
  useEffect(() => {
    if (token) void signIn("power", { token, callbackUrl: "/" });
  }, [token]);
  return <p className="muted">{token ? "Connexion à Sortify…" : "Lien de connexion invalide."}</p>;
}

/** Dernière étape de la connexion power user : le jeton de passage ouvre la session. */
export default function PowerConnexionPage() {
  return (
    <main className="page page--bare">
      <Suspense>
        <Handoff />
      </Suspense>
    </main>
  );
}
