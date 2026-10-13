"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BacTrack } from "@/lib/bac-admin";
import { PreviewCover } from "../../../ui/PreviewCover";
import { adjust, detach, editBrief, removeFromBac, setAutoFill, type ActionResult } from "../actions";

interface Props {
  bac: { id: string; name: string; brief: string; autoFill: boolean };
  tracks: (BacTrack & { label: string })[];
}

export function BacDetail({ bac, tracks }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [brief, setBrief] = useState(bac.brief);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [, startTransition] = useTransition();

  function act(key: string, action: () => Promise<ActionResult>, after?: () => void) {
    setBusy(key);
    setMessage(null);
    startTransition(async () => {
      const result = await action().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      setBusy(null);
      if (result.ok) {
        if (result.message) setMessage({ ok: true, text: result.message });
        after?.();
      } else setMessage({ ok: false, text: result.message });
    });
  }

  return (
    <>
      <section className="panel" aria-busy={busy === "adjust"}>
        <div className="row between">
          <span className="label">Ce que Sortify cherche ici</span>
          {!editing ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
              Modifier
            </button>
          ) : null}
        </div>
        {editing ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              act("brief", () => editBrief(bac.id, brief), () => setEditing(false));
            }}
          >
            <textarea className="textarea" value={brief} rows={6} onChange={(e) => setBrief(e.target.value)} aria-label="Fiche du bac" />
            <div className="row" style={{ gap: 6 }}>
              <button type="submit" className="btn btn--sm" disabled={busy !== null}>
                Enregistrer
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => {
                  setBrief(bac.brief);
                  setEditing(false);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Fiche repliée par défaut : c'est surtout pour l'IA, la personne n'a pas besoin de tout lire. */}
            <p
              className={`brief ${expanded ? "" : "brief--folded"} ${busy === "adjust" ? "is-working" : ""}`}
              style={{ margin: 0, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-line" }}
            >
              {bac.brief}
            </p>
            <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
              {expanded ? "Replier la fiche" : "Lire la fiche complète"}
            </button>
          </>
        )}
        <form
          className="stack"
          style={{ gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            act("adjust", () => adjust(bac.id, instruction), () => setInstruction(""));
          }}
        >
          <label htmlFor="ajuster" className="small muted">
            Ou demande à l&apos;IA de l&apos;ajuster
          </label>
          <div className="row" style={{ gap: 6 }}>
            <input
              id="ajuster"
              className="field grow"
              placeholder="Ex. : plus de rap, moins de pop"
              value={instruction}
              maxLength={300}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <button type="submit" className="btn btn--sm" disabled={busy !== null || instruction.trim().length < 3}>
              {busy === "adjust" ? "…" : "Ajuster"}
            </button>
          </div>
        </form>
        {busy === "adjust" ? (
          <p className="ai-status" role="status">
            <span className="ai-status__dot" aria-hidden="true" />
            L&apos;IA réécrit la fiche…
          </p>
        ) : null}
      </section>

      {message ? (
        <p className={message.ok ? "notice" : "notice notice--error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}

      <h2 className="label section-label" style={{ marginBottom: 0 }}>
        Arrivés récemment
      </h2>
      <ul className="recent">
        {tracks
          .filter((t) => !removed.has(t.track_id))
          .map((t) => (
            <li key={t.track_id} className="recent__item">
              <PreviewCover isrc={t.isrc} cover={t.cover_url} title={t.title} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="recent__title" style={{ display: "block" }}>
                  {t.title}
                </span>
                <span className="small muted">
                  {t.artist} · {t.label}
                </span>
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy === t.track_id}
                onClick={() =>
                  act(t.track_id, () => removeFromBac(bac.id, t.track_id), () => setRemoved((r) => new Set(r).add(t.track_id)))
                }
              >
                {busy === t.track_id ? "…" : "Retirer"}
              </button>
            </li>
          ))}
      </ul>
      <p className="small muted" style={{ margin: "-6px 4px 0" }}>
        Un titre retiré sort de la playlist et sert de contre-exemple à l&apos;IA ; s&apos;il n&apos;est dans aucun autre bac, il part dans Divers.
      </p>

      <div className="list">
        <div className="list__row">
          <span>Remplissage automatique</span>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-label="Remplissage automatique"
            aria-checked={bac.autoFill}
            disabled={busy !== null}
            onClick={() => act("autofill", () => setAutoFill(bac.id, !bac.autoFill))}
          />
        </div>
      </div>

      {confirmDetach ? (
        <div className="panel" style={{ border: "1.5px solid var(--ink)" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Retirer « {bac.name} » de Sortify ?</p>
          <p className="small muted" style={{ margin: 0 }}>
            La playlist reste dans Spotify, mais Sortify ne la remplira plus. Ses titres qui ne sont dans aucun autre bac partent dans Divers.
          </p>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn--ghost btn--sm grow" onClick={() => setConfirmDetach(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--sm grow"
              disabled={busy !== null}
              onClick={() => act("detach", () => detach(bac.id), () => router.push("/bacs"))}
            >
              {busy === "detach" ? "On retire…" : "Retirer"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" id="retirer" className="btn btn--quiet danger-btn" onClick={() => setConfirmDetach(true)}>
          Retirer ce bac de Sortify
        </button>
      )}
    </>
  );
}
