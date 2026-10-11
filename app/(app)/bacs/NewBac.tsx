"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { createBac } from "./actions";

/** « Nouveau bac » : une description libre, l'IA écrit la fiche, remplit le bac et crée la playlist. */
export function NewBac() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await createBac(text).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (result.ok) {
        setOpen(false);
        setText("");
        setMessage({ ok: true, text: result.message ?? "Bac créé." });
        router.refresh();
      } else setMessage({ ok: false, text: result.message });
    });
  }

  return (
    <>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
        + Nouveau bac
      </button>
      {message?.ok ? (
        <p className="notice" role="status">
          {message.text}
        </p>
      ) : null}

      <BottomSheet open={open} onClose={() => !pending && setOpen(false)} title="Nouveau bac">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            className="textarea"
            rows={3}
            maxLength={500}
            value={text}
            disabled={pending}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex. : le rap US des années 2000 ; ce que j'écoute en courant ; Kalash et la Martinique"
            aria-label="Décris ton nouveau bac"
          />
          <p className="small muted" style={{ margin: 0 }}>
            L&apos;IA écrit la fiche, cherche les titres dans toute ta bibliothèque et crée la playlist dans Spotify. Compte 1 à 2 minutes.
          </p>
          {message && !message.ok ? (
            <p className="notice notice--error" role="alert">
              {message.text}
            </p>
          ) : null}
          <button type="submit" className="btn" disabled={pending || text.trim().length < 3}>
            {pending ? "L'IA crée ton bac…" : "Créer le bac"}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
