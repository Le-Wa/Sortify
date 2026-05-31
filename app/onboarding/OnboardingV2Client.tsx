"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import S0Landing from "./screens/S0Landing";
import SInvite from "./screens/SInvite";
import S1Guide from "./screens/S1Guide";
import S2Credentials from "./screens/S2Credentials";
import S3Mode from "./screens/S3Mode";
import S3bSubMode from "./screens/S3bSubMode";
import S4Import from "./screens/S4Import";
import SAnalyse from "./screens/SAnalyse";
import S6Scratch from "./screens/S6Scratch";
import S7ScratchVibe from "./screens/S7ScratchVibe";
import SAppPreview from "./screens/SAppPreview";

type Screen =
  | "s0"
  | "s-invite"
  | "s1"
  | "s2"
  | "s3"
  | "s3b"
  | "s4"
  | "s-analyse"
  | "s6"
  | "s7"
  | "s-preview";

type Mode = "import" | "analyse" | "scratch" | null;

interface Props {
  initialStep?: number | null;
  initialMode?: string | null;
  /** 'pending' | 'in_progress' | 'complete' | null (not authenticated) */
  initialStatus?: string | null;
}

export default function OnboardingV2Client({ initialStep, initialMode, initialStatus }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");

  // Routing logic:
  //  - Not authenticated (initialStatus null) → S0 landing
  //  - Authenticated, status pending, step 0 → S0 (dev persona fresh, or user before they chose a path)
  //  - Authenticated, status in_progress, step 0 → S3 (just completed OAuth, pick mode)
  //  - Authenticated, step > 0 → S-Preview (job running)
  const startScreen: Screen = (() => {
    if (initialStatus == null) return "s0";
    if (initialStatus === "pending") return "s0";
    if ((initialStep ?? 0) > 0) return "s-preview";
    return "s3";
  })();

  const [screen, setScreen] = useState<Screen>(startScreen);
  const [mode, setMode] = useState<Mode>((initialMode as Mode) ?? null);
  const [scratchName, setScratchName] = useState("");

  // ── Persist mode to DB when it changes ──
  async function saveMode(m: Mode) {
    setMode(m);
    if (m) {
      await fetch("/api/users/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: m }),
      }).catch(() => {});
    }
  }

  // ── Handle credential validation → start OAuth flow ──
  function handleCredentialsSuccess() {
    window.location.href = "/api/auth/spotify-byok/authorize";
  }

  // ── Dev bypass: skip OAuth, go straight to S3 ──
  function handleDevBypass() {
    setScreen("s3");
  }

  // ── Handle invite validation → start OAuth flow ──
  function handleInviteSuccess() {
    window.location.href = "/api/auth/spotify-byok/authorize";
  }

  // ── Handle S4 import selection → start job + enter app ──
  async function handleImportSelected(spotifyPlaylistIds: string[]) {
    // Create playlists in DB and start job
    await fetch("/api/onboarding/import-playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlist_ids: spotifyPlaylistIds }),
    }).catch(() => {});
    setScreen("s-preview");
  }

  // ── Handle scratch playlist creation ──
  async function handleScratchVibe(vibe: string, artists: string[]) {
    await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: scratchName,
        llm_help_text: vibe || null,
        rules: artists.length > 0 ? { example_artists: artists } : undefined,
      }),
    }).catch(() => {});
    setScreen("s-preview");
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
        <S2Credentials onSuccess={handleCredentialsSuccess} onDevBypass={handleDevBypass} onBack={() => setScreen("s1")} />
      )}

      {screen === "s3" && (
        <S3Mode
          onYes={() => setScreen("s3b")}
          onNo={async () => {
            await saveMode("analyse");
            setScreen("s-analyse");
          }}
        />
      )}

      {screen === "s3b" && (
        <S3bSubMode
          onImport={async () => {
            await saveMode("import");
            setScreen("s4");
          }}
          onScratch={async () => {
            await saveMode("scratch");
            setScreen("s6");
          }}
          onBack={() => setScreen("s3")}
        />
      )}

      {screen === "s4" && (
        <S4Import onNext={handleImportSelected} onBack={() => setScreen("s3b")} />
      )}

      {screen === "s-analyse" && (
        <SAnalyse onEnter={() => setScreen("s-preview")} onBack={() => setScreen("s3")} />
      )}

      {screen === "s6" && (
        <S6Scratch
          onNext={(name) => {
            setScratchName(name);
            setScreen("s7");
          }}
          onBack={() => setScreen("s3b")}
        />
      )}

      {screen === "s7" && (
        <S7ScratchVibe
          playlistName={scratchName}
          onNext={handleScratchVibe}
          onBack={() => setScreen("s6")}
        />
      )}

      {screen === "s-preview" && <SAppPreview />}
    </div>
  );
}
