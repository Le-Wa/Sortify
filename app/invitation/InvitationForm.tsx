"use client";

import { signIn } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { StoryGuide } from "../ui/pedagogie/StoryGuide";
import { checkInvitation, type InvitationState } from "./actions";

/**
 * Code d'invitation, puis mini-guide, puis Spotify. La démo (`/lab/onboarding`) passe sa propre vérification
 * (`check`) et sa suite (`onReady`) à la place de la connexion Spotify.
 */
export function InvitationForm({
  check = checkInvitation,
  onReady,
}: {
  check?: (prev: InvitationState, formData: FormData) => Promise<InvitationState>;
  onReady?: () => void;
}) {
  const [state, action, pending] = useActionState<InvitationState, FormData>(check, { status: "idle" });
  // Code accepté et mis en cookie : le mini-guide (qu'on peut passer), puis Spotify.
  const [guideDone, setGuideDone] = useState(false);
  const redirecting = state.status === "ok" && guideDone;

  useEffect(() => {
    if (!redirecting) return;
    if (onReady) {
      onReady();
      return;
    }
    signIn("spotify", { callbackUrl: "/" }).catch((error: unknown) => {
      console.error("Connexion Spotify impossible", error);
    });
  }, [redirecting, onReady]);

  if (state.status === "ok" && !guideDone) return <StoryGuide onDone={() => setGuideDone(true)} />;

  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <label className="label" htmlFor="code">
        Code
      </label>
      <input
        id="code"
        name="code"
        // React vide le formulaire après l'envoi : on remet le code saisi en cas d'erreur.
        key={state.status === "error" ? state.code : "vide"}
        defaultValue={state.status === "error" ? state.code : ""}
        className="code-input"
        placeholder="DISQ-XXXXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "code-error" : "code-help"}
      />
      {state.status === "error" ? (
        <p id="code-error" className="notice notice--error" role="alert" style={{ margin: 0 }}>
          {state.message}
        </p>
      ) : null}
      <p id="code-help" className="small muted" style={{ margin: 0 }}>
        Le code est valable une fois. Ton compte Spotify doit aussi être autorisé par la personne qui t&apos;invite.
      </p>
      <button type="submit" className="btn" disabled={pending || redirecting}>
        {redirecting ? "Ouverture de Spotify…" : pending ? "Vérification…" : "Valider et se connecter"}
      </button>
    </form>
  );
}

export function InvitationIntro() {
  return (
    <>
      <h1 className="display">Ton code d&apos;invitation</h1>
      <p className="muted" style={{ margin: 0 }}>
        Un pote t&apos;a fait entrer dans Sortify ? Tape le code qu&apos;il t&apos;a donné, puis connecte-toi avec Spotify.
      </p>
    </>
  );
}
