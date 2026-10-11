"use client";

import { useState, useTransition } from "react";
import type { Suggestion } from "@/lib/suggestions";
import { Sleeve } from "../../ui/Sleeve";
import { accept, refuse } from "../bacs/actions";
import { markFor } from "@/lib/cover-shapes";

const WORKING: Record<Suggestion["kind"], string> = {
  ajouter: "L'IA remplit le nouveau bac et crée la playlist…",
  supprimer: "On retire le bac…",
  fusionner: "On fusionne les deux bacs et on crée la playlist…",
};

export function SuggestionCards({ suggestions }: { suggestions: Suggestion[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(id);
    setMessage(null);
    startTransition(async () => {
      const result = await action().catch((e: unknown) => ({ ok: false, message: e instanceof Error ? e.message : "Erreur" }));
      setBusy(null);
      if (result.message) setMessage({ ok: result.ok, text: result.message });
    });
  }

  return (
    <>
      {suggestions.map((s) => {
        const p = s.payload;
        const working = busy === s.id;
        const title =
          s.kind === "ajouter"
            ? `Nouveau bac : « ${p.fiche?.name} » ?`
            : s.kind === "supprimer"
              ? `Retirer « ${p.bacNames?.[0]} » ?`
              : `Fusionner « ${p.bacNames?.[0]} » et « ${p.bacNames?.[1]} » ?`;
        return (
          <section key={s.id} className={`suggestion card ${working ? "is-working" : ""}`} aria-busy={working}>
            {p.fiche ? <Sleeve name={p.fiche.sleeve_name ?? p.fiche.name} color="#111111" size={64} mark={markFor(p.fiche)} code="NOUVEAU" /> : null}
            <div className="grow stack" style={{ gap: 6 }}>
              <b style={{ fontSize: 15, lineHeight: 1.25 }}>{title}</b>
              <span style={{ fontSize: 13, lineHeight: 1.35 }}>{p.reason}</span>
              {p.fiche ? (
                <span className="small muted" style={{ lineHeight: 1.3 }}>
                  {s.kind === "fusionner" ? `Le nouveau bac « ${p.fiche.name} » : ${p.fiche.pitch}` : p.fiche.pitch}
                </span>
              ) : null}
              {working ? (
                <span className="ai-status" role="status" style={{ boxShadow: "none", padding: 0, minHeight: 32, background: "none" }}>
                  <span className="ai-status__dot" aria-hidden="true" />
                  {WORKING[s.kind]}
                </span>
              ) : (
                <span className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => run(s.id, () => accept(s.id))}>
                    {s.kind === "ajouter" ? "Créer" : s.kind === "supprimer" ? "Retirer" : "Fusionner"}
                  </button>
                  <button type="button" className="btn btn--quiet btn--sm" disabled={busy !== null} onClick={() => run(s.id, () => refuse(s.id))}>
                    Non merci
                  </button>
                </span>
              )}
            </div>
          </section>
        );
      })}
      {message ? (
        <p className={message.ok ? "notice" : "notice notice--error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </>
  );
}
