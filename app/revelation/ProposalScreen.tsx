"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Sleeve } from "../ui/Sleeve";
import { usePreview } from "../ui/usePreview";
import { addCustomBac, createBacs, mergeBacs, otherIdea, renameBac, setKept, type ActionResult } from "./actions";
import { useRevelation } from "./useRevelation";
import { ProposalIntro } from "../ui/pedagogie/ProposalIntro";
import type { SleeveMark } from "@/lib/cover-shapes";

export interface ProposalBac {
  id: string;
  name: string;
  sleeve: string;
  mark: SleeveMark;
  pitch: string;
  axis: string;
  color: string;
  kept: boolean;
  count: number;
  /** Gardé : titres qui partiraient dans Divers si on le retirait. Retiré : titres qu'il sortirait de Divers. */
  alone: number;
  filling: boolean;
  examples: { track_id: string; title: string; artist: string; cover_url: string | null; isrc: string | null }[];
}

interface Props {
  divers: number;
  total: number;
  likes: number;
  period: string;
  bacs: ProposalBac[];
  filling: boolean;
  error: string | null;
}

export function ProposalScreen({ likes, period, bacs, divers, total, filling, error: jobError }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(bacs[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null); // id du bac (ou « create », « custom ») en cours
  // Travail de l'IA en cours : bacs concernés et message, montrés sur les fiches et en bas de l'écran.
  const [working, setWorking] = useState<{ ids: string[]; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [, startTransition] = useTransition();
  const preview = usePreview();

  // Un bac se remplit en arrière-plan : on suit le job, puis on recharge les compteurs.
  const { state, resume } = useRevelation("proposition", (s) => s.stage === "proposition" && s.filling);
  const stillFilling = state?.stage === "proposition" ? state.filling : filling;
  useEffect(() => {
    if (filling) resume();
  }, [filling, resume]);
  useEffect(() => {
    if (filling && state?.stage === "proposition" && !state.filling) router.refresh();
  }, [filling, state, router]);

  const kept = bacs.filter((b) => b.kept);

  function act(
    key: string,
    action: () => Promise<ActionResult>,
    after?: () => void,
    feedback?: { ids: string[]; label: string },
  ) {
    setBusy(key);
    setError(null);
    if (feedback) setWorking(feedback);
    startTransition(async () => {
      const result = await action().catch((e: unknown) => ({
        ok: false as const,
        message: e instanceof Error ? e.message : "Erreur inconnue.",
      }));
      setBusy(null);
      setWorking(null);
      if (!result.ok) setError(result.message);
      else after?.();
    });
  }

  const mergeSource = bacs.find((b) => b.id === mergeFrom);

  return (
    <>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row between label">
          <span>
            {likes.toLocaleString("fr-FR")} likes · {period}
          </span>
          <span>{kept.length} bacs</span>
        </div>
        <h1 className="display">
          Voici l&apos;âme de
          <br />
          ta discothèque.
        </h1>
      </div>

      <ProposalIntro />

      <p className={`notice ${total && divers / total > 0.3 ? "notice--warn" : ""}`} style={{ margin: 0 }}>
        <b>Divers : {divers.toLocaleString("fr-FR")} titres</b> ({total ? Math.round((100 * divers) / total) : 0} %) n&apos;ont pas de bac.
        {total && divers / total > 0.3 ? " C'est beaucoup : garde des bacs ou ajoute-en un sur mesure pour leur trouver une place." : ""}
      </p>

      {jobError ? (
        <p className="notice notice--error" role="alert">
          Le remplissage d&apos;un bac a échoué : {jobError}
        </p>
      ) : null}

      <div className="proposal">
        {bacs.map((bac, i) => {
          const expanded = open === bac.id;
          const cardBusy = busy === bac.id;
          const aiHere = working?.ids.includes(bac.id) ? working.label : null;
          return (
            <section key={bac.id} className={`bin ${expanded ? "bin--open" : ""}`} style={{ zIndex: i + 1 }}>
              <div className={`card bin__card ${bac.kept ? "" : "bin__card--off"} ${aiHere ? "is-working" : ""}`} aria-busy={Boolean(aiHere)}>
                {aiHere ? <div className="bin__working">{aiHere}</div> : null}
                <div className="row bin__top" style={{ alignItems: "flex-start", gap: 12 }}>
                  <button
                    type="button"
                    className="bin__head"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : bac.id)}
                  >
                    <span className="bin__name">
                      {bac.name}
                      {!expanded && bac.kept ? <span className="bin__count">{bac.filling ? "…" : bac.count}</span> : null}
                    </span>
                    <span className="bin__sub">
                      {bac.kept
                        ? bac.pitch
                        : `Retiré : ${bac.alone} titre${bac.alone > 1 ? "s" : ""} de plus dans Divers. Touche l'interrupteur pour le remettre, ou récupère-le plus tard depuis Bacs.`}
                    </span>
                    {expanded && bac.kept ? (
                      <span className="row" style={{ gap: 6 }}>
                        <span className="tag">{bac.axis}</span>
                        <span className="mono small muted">
                          {bac.filling ? "se remplit…" : `${bac.count} titres${bac.alone ? ` · ${bac.alone} iraient dans Divers sans lui` : ""}`}
                        </span>
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    role="switch"
                    className="switch"
                    aria-label={`Garder ${bac.name}`}
                    aria-checked={bac.kept}
                    disabled={cardBusy || busy !== null}
                    onClick={() => act(bac.id, () => setKept(bac.id, !bac.kept))}
                  />
                </div>

                {expanded && bac.kept ? (
                  <>
                    <div className="covers">
                      {bac.examples.slice(0, 5).map((ex) => (
                        <button
                          key={ex.track_id}
                          type="button"
                          className={`covers__item ${preview.playing === ex.isrc ? "is-playing" : ""}`}
                          aria-label={`Écouter un extrait : ${ex.artist} — ${ex.title}`}
                          disabled={!ex.isrc}
                          onClick={() => void preview.toggle(ex.isrc)}
                        >
                          {ex.cover_url ? <Image src={ex.cover_url} alt="" fill sizes="64px" /> : null}
                        </button>
                      ))}
                    </div>
                    {bac.examples.some((ex) => ex.isrc === preview.unavailable) ? (
                      <p className="small muted" style={{ margin: 0 }}>
                        Pas d&apos;extrait pour ce titre.
                      </p>
                    ) : null}

                    {renaming === bac.id ? (
                      <RenameForm
                        initial={bac.name}
                        busy={cardBusy}
                        onCancel={() => setRenaming(null)}
                        onSave={(name) => act(bac.id, () => renameBac(bac.id, name), () => setRenaming(null))}
                      />
                    ) : (
                      <div className="row" style={{ gap: 6 }}>
                        <button type="button" className="btn btn--ghost btn--sm grow" disabled={cardBusy || busy !== null} onClick={() => setRenaming(bac.id)}>
                          Renommer
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm grow"
                          disabled={busy !== null || stillFilling}
                          onClick={() =>
                            act(bac.id, () => otherIdea(bac.id), undefined, {
                              ids: [bac.id],
                              label: `L'IA cherche une autre idée que « ${bac.name} »…`,
                            })
                          }
                        >
                          Autre idée
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm grow"
                          disabled={busy !== null || kept.length < 2}
                          onClick={() => setMergeFrom(bac.id)}
                        >
                          Fusionner…
                        </button>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
              <Sleeve
                name={bac.sleeve}
                color={bac.kept ? bac.color : "#8E8F89"}
                mark={bac.mark}
                size={expanded ? 72 : 56}
                className="bin__sleeve"
              />
            </section>
          );
        })}
      </div>

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="proposal__footer">
        {working || stillFilling ? (
          <p className="ai-status" role="status">
            <span className="ai-status__dot" aria-hidden="true" />
            {working?.label ?? "Un bac se remplit avec tes titres…"}
          </p>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={() => setCustomOpen(true)}>
          + Il manque un bac ? Décris-le
        </button>
        <button
          type="button"
          className="btn"
          disabled={kept.length === 0 || busy !== null || stillFilling}
          onClick={() => act("create", createBacs, () => router.refresh())}
        >
          {busy === "create"
            ? "On lance la presse…"
            : stillFilling
              ? "Un bac se remplit…"
              : `Créer ${kept.length} bac${kept.length > 1 ? "s" : ""} dans Spotify`}
        </button>
      </div>

      <BottomSheet open={mergeFrom !== null} onClose={() => setMergeFrom(null)} title="Fusionner avec…">
        {mergeSource ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              L&apos;IA réécrit une fiche commune à « {mergeSource.name} » et au bac choisi, et lui trouve un nom.
            </p>
            {kept
              .filter((b) => b.id !== mergeSource.id)
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="choice"
                  disabled={busy !== null}
                  onClick={() => {
                    setMergeFrom(null);
                    act(mergeSource.id, () => mergeBacs(mergeSource.id, b.id), () => setOpen(null), {
                      ids: [mergeSource.id, b.id],
                      label: `L'IA fusionne « ${mergeSource.name} » et « ${b.name} »…`,
                    });
                  }}
                >
                  <Sleeve name={b.sleeve} color={b.color} size={36} mark={b.mark} />
                  <span className="grow">{b.name}</span>
                </button>
              ))}
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={customOpen} onClose={() => setCustomOpen(false)} title="Il manque un bac ?">
        <CustomForm
          busy={busy === "custom"}
          onSubmit={(text) => {
            setCustomOpen(false);
            act("custom", () => addCustomBac(text), undefined, { ids: [], label: "L'IA écrit la fiche de ton bac sur mesure…" });
          }}
        />
      </BottomSheet>
    </>
  );
}

function RenameForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="row"
      style={{ gap: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name);
      }}
    >
      <input className="field grow" value={name} maxLength={40} autoFocus aria-label="Nouveau nom" onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="btn btn--sm" disabled={busy}>
        OK
      </button>
      <button type="button" className="btn btn--quiet btn--sm" onClick={onCancel}>
        Annuler
      </button>
    </form>
  );
}

function CustomForm({ busy, onSubmit }: { busy: boolean; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="stack"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
      }}
    >
      <label className="small muted" htmlFor="custom-bac">
        Décris-le avec tes mots : un genre, une ambiance, un moment… L&apos;IA écrit la fiche et le remplit avec tes likes.
      </label>
      <textarea
        id="custom-bac"
        className="textarea"
        value={text}
        maxLength={500}
        placeholder="Ex. : du jazz pour cuisiner le dimanche"
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn" disabled={busy || text.trim().length < 3}>
        {busy ? "L'IA écrit la fiche…" : "Créer ce bac"}
      </button>
    </form>
  );
}
