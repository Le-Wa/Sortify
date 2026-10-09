"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import S0Landing from "./screens/S0Landing";
import SInvite from "./screens/SInvite";
import S1Guide from "./screens/S1Guide";
import S2Credentials from "./screens/S2Credentials";

type Screen = "s0" | "s-invite" | "s1" | "s2";

export default function OnboardingV2Client() {
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");

  const [screen, setScreen] = useState<Screen>("s0");

  function handleCredentialsSuccess() {
    window.location.href = "/api/auth/spotify-byok/authorize";
  }

  async function handleDevBypass() {
    await fetch("/api/dev/byok-skip", { method: "POST" }).catch(() => {});
    router.replace("/dashboard");
  }

  async function handleInviteSuccess() {
    if (process.env.NODE_ENV !== "production") {
      const res = await fetch("/api/dev/byok-skip", { method: "POST" });
      const { token } = await res.json();
      const result = await signIn("byok-handoff", { token, redirect: false });
      if (result?.ok) router.replace("/dashboard");
      return;
    }
    window.location.href = "/api/auth/spotify-byok/authorize";
  }

  return (
    <div className="ob-wrapper">
      {error && (
        <div className="ob-error-banner">
          {error === "session_expired" && "Session expirée — recommence."}
          {error === "token_exchange_failed" && "Erreur de connexion Spotify — vérifie ton redirect URI."}
          {!["session_expired", "token_exchange_failed"].includes(error) && `Erreur : ${error}`}
        </div>
      )}

      {screen === "s0" && (
        <S0Landing onByok={() => setScreen("s1")} onInvite={() => setScreen("s-invite")} />
      )}

      {screen === "s-invite" && (
        <SInvite onSuccess={handleInviteSuccess} onBack={() => setScreen("s0")} />
      )}

      {screen === "s1" && (
        <S1Guide onNext={() => setScreen("s2")} onBack={() => setScreen("s0")} />
      )}

      {screen === "s2" && (
        <S2Credentials
          onSuccess={handleCredentialsSuccess}
          onDevBypass={handleDevBypass}
          onBack={() => setScreen("s1")}
        />
      )}
    </div>
  );
}
