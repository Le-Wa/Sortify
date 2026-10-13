"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bacsFromDivers } from "../actions";

/** « Fais-moi des bacs avec Divers » : l'IA cherche maintenant (pas besoin d'attendre le lundi). */
export function MakeBacs() {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="crate-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }} aria-busy={pending}>
      <b style={{ fontSize: 15 }}>Beaucoup de titres attendent ici.</b>
      <span className="small">L&apos;IA peut y chercher des groupes qui méritent leur bac. Environ une minute.</span>
      <button
        type="button"
        className="btn btn--sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await bacsFromDivers().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
            setMessage({ ok: result.ok, text: result.message ?? "" });
            if (result.ok) router.refresh();
          })
        }
      >
        {pending ? "L'IA fouille la caisse…" : "Fais-moi des bacs avec Divers"}
      </button>
      {message?.text ? (
        <span className="small" role={message.ok ? "status" : "alert"}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
