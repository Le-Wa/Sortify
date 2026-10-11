"use client";

import { signIn } from "next-auth/react";
import { useActionState, useEffect } from "react";
import { checkInvitation, type InvitationState } from "./actions";

export function InvitationForm() {
  const [state, action, pending] = useActionState<InvitationState, FormData>(checkInvitation, { status: "idle" });
  const redirecting = state.status === "ok";

  // Code accepté et mis en cookie : on enchaîne directement sur Spotify.
  useEffect(() => {
    if (!redirecting) return;
    signIn("spotify", { callbackUrl: "/" }).catch((error: unknown) => {
      console.error("Connexion Spotify impossible", error);
    });
  }, [redirecting]);

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
