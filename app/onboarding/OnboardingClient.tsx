"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProgressBar from "./ProgressBar";
import BackButton from "./BackButton";
import SummaryRow from "./SummaryRow";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type ImportScope = "all" | "12" | "6" | "3";

interface SpotifyPl {
  id: string;
  name: string;
  tracks_total: number;
  already_linked: boolean;
}

interface LinkedPl {
  spotifyId: string;
  sortifyId: string;
  name: string;
}

interface Props {
  userName: string;
}

const SCOPE_OPTIONS: { value: ImportScope; label: string; note: string }[] = [
  { value: "all", label: "Depuis le début", note: "Toute ta bibliothèque" },
  { value: "12", label: "12 derniers mois", note: "Recommandé pour commencer" },
  { value: "6", label: "6 derniers mois", note: "" },
  { value: "3", label: "3 derniers mois", note: "" },
];

const SCOPE_LABELS: Record<ImportScope, string> = {
  all: "depuis le début",
  "12": "12 derniers mois",
  "6": "6 derniers mois",
  "3": "3 derniers mois",
};

export default function OnboardingClient({ userName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [scope, setScope] = useState<ImportScope>("12");
  const [playlists, setPlaylists] = useState<SpotifyPl[] | null>(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [linked, setLinked] = useState<LinkedPl[]>([]);
  const [linking, setLinking] = useState<Set<string>>(new Set());
  const [learning, setLearning] = useState<Set<string>>(new Set());
  const [cron, setCron] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Demo step state
  const [demoResults, setDemoResults] = useState<Array<{ name: string; artist: string; playlist_name: string }>>([]);
  const [demoTotal, setDemoTotal] = useState(0);
  const [demoRemaining, setDemoRemaining] = useState<number | null>(null);
  const [demoDone, setDemoDone] = useState(false);
  const [demoElapsed, setDemoElapsed] = useState(0);
  const [demoWaiting, setDemoWaiting] = useState(false);
  const demoActiveRef = useRef(false);
  const demoStartRef = useRef(0);
  const demoClassifiedRef = useRef(0);

  const fetchPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    try {
      const res = await fetch("/api/spotify/my-playlists");
      const data = await res.json();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch {
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && playlists === null) {
      fetchPlaylists();
    }
  }, [step, playlists, fetchPlaylists]);

  // Demo polling — runs when step reaches 6
  useEffect(() => {
    if (step !== 6 || demoActiveRef.current) return;
    demoActiveRef.current = true;
    demoStartRef.current = Date.now();

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/classify/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skipLlm: true }),
        });
        if (!res.ok) { setTimeout(poll, 3000); return; }
        const data = await res.json() as {
          classified: number;
          needs_review: number;
          batch_size: number;
          remaining: number;
          total: number;
          results?: Array<{ name: string; artist: string; playlist_name: string }>;
        };
        if (cancelled) return;

        demoClassifiedRef.current += data.classified + data.needs_review;

        if (data.total > 0) {
          setDemoTotal((prev) => (prev === 0 ? data.total : prev));
          setDemoWaiting(false);
        }
        if (data.results && data.results.length > 0) {
          setDemoResults((prev) => [...prev, ...data.results!]);
        }
        setDemoRemaining(data.remaining);

        if (data.remaining === 0) {
          if (data.batch_size === 0 && demoClassifiedRef.current === 0) {
            // Import still in progress
            setDemoWaiting(true);
            setTimeout(poll, 2000);
          } else {
            setDemoElapsed(Math.round((Date.now() - demoStartRef.current) / 1000));
            setDemoDone(true);
          }
        } else {
          setTimeout(poll, 400);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 3000);
      }
    }

    void poll();
    return () => { cancelled = true; };
  }, [step]);

  async function linkPlaylist(pl: SpotifyPl) {
    if (linking.has(pl.id) || isLinked(pl.id)) return;
    setLinking((s) => new Set(s).add(pl.id));

    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyPlaylistId: pl.id, name: pl.name }),
      });
      const data = await res.json();
      const sortifyId = data.id as string;

      setLearning((s) => new Set(s).add(pl.id));
      fetch(`/api/playlists/${sortifyId}/learn`, { method: "POST" }).finally(() => {
        setLearning((s) => {
          const n = new Set(s);
          n.delete(pl.id);
          return n;
        });
      });

      setLinked((prev) => [...prev, { spotifyId: pl.id, sortifyId, name: pl.name }]);
    } finally {
      setLinking((s) => {
        const n = new Set(s);
        n.delete(pl.id);
        return n;
      });
    }
  }

  function isLinked(spotifyId: string) {
    return linked.some((l) => l.spotifyId === spotifyId);
  }

  async function createPlaylist() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      setLinked((prev) => [
        ...prev,
        { spotifyId: "", sortifyId: data.id, name: newName.trim() },
      ]);
      setNewName("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function startDemo() {
    if (finishing) return;
    setFinishing(true);
    await fetch("/api/users/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: true,
        import_since: scope === "all" ? null : parseInt(scope),
        cron_enabled: cron,
      }),
    });
    const months = scope === "all" ? null : parseInt(scope);
    fetch("/api/tracks/import-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(months ? { months } : {}),
    });
    setFinishing(false);
    setStep(6);
  }

  async function finish(launch: boolean) {
    if (finishing) return;
    setFinishing(true);

    await fetch("/api/users/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: true,
        import_since: scope === "all" ? null : parseInt(scope),
        cron_enabled: cron,
      }),
    });

    if (launch) {
      const months = scope === "all" ? null : parseInt(scope);
      fetch("/api/tracks/import-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(months ? { months } : {}),
      });
    }

    router.replace("/dashboard");
  }

  const next = () => setStep((s) => Math.min(s + 1, 6) as Step);
  const back = () => setStep((s) => Math.max(s - 1, 1) as Step);

  return (
    <div
      style={{
        maxWidth: 440,
        margin: "0 auto",
        padding: "40px 20px 80px",
        minHeight: "calc(100svh - 60px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ProgressBar step={step} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div
            className="s-card"
            style={{ padding: "32px 28px", display: "flex", flexDirection: "column", gap: 24 }}
          >
            <div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--terra-light)",
                  border: "1px solid var(--terra-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20, color: "var(--terra)" }}>
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </div>
              <h1
                className="font-fraunces"
                style={{
                  fontStyle: "italic",
                  fontWeight: 600,
                  fontSize: 28,
                  color: "var(--ink)",
                  letterSpacing: "-0.4px",
                  marginBottom: 10,
                }}
              >
                Bienvenue, {userName}
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 400, lineHeight: 1.65 }}>
                Ton compte Spotify est connecté. Configurons Sortify en quelques étapes.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(106, 144, 112, 0.1)",
                border: "1px solid rgba(106, 144, 112, 0.2)",
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14, flexShrink: 0, color: "var(--sage)" }}>
                <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--sage)" }}>Spotify connecté</span>
            </div>

            <button
              className="s-btn s-btn-primary"
              onClick={next}
              style={{ alignSelf: "stretch", justifyContent: "center", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
            >
              Commencer
            </button>
          </div>
        )}

        {/* ── Step 2: Import scope ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <BackButton onBack={back} />
            <div
              className="s-card"
              style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 8 }}>
                  Scope d&apos;import
                </h2>
                <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 400, lineHeight: 1.65 }}>
                  Quelles liked songs importer pour le premier tri&nbsp;?
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SCOPE_OPTIONS.map(({ value, label, note }) => (
                  <label
                    key={value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      borderRadius: 10,
                      border: `1px solid ${scope === value ? "var(--terra)" : "var(--border-strong)"}`,
                      background: scope === value ? "var(--terra-light)" : "var(--surface2)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={value}
                      checked={scope === value}
                      onChange={() => setScope(value)}
                      style={{ accentColor: "var(--terra)", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: scope === value ? 600 : 500 }}>
                        {label}
                      </span>
                      {note && (
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--terra)", marginLeft: 8 }}>
                          {note}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <button
                className="s-btn s-btn-primary"
                onClick={next}
                style={{ alignSelf: "stretch", justifyContent: "center", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Playlists ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <BackButton onBack={back} />
            <div
              className="s-card"
              style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 8 }}>
                  Playlists cibles
                </h2>
                <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 400, lineHeight: 1.65 }}>
                  Choisis où Sortify triera tes liked songs. Minimum 1 requise.
                </p>
              </div>

              {linked.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {linked.map((pl) => (
                    <div
                      key={pl.sortifyId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(106, 144, 112, 0.08)",
                        border: "1px solid rgba(106, 144, 112, 0.18)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13, color: "var(--sage)", flexShrink: 0 }}>
                        <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", flex: 1, minWidth: 0 }} className="truncate">
                        {pl.name}
                      </span>
                      {pl.spotifyId && learning.has(pl.spotifyId) && (
                        <span style={{ fontSize: 11, color: "var(--ink-mid)", whiteSpace: "nowrap" }}>
                          Apprentissage…
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                }}
              >
                {playlistsLoading && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-mid)", fontSize: 14 }}>
                    Chargement…
                  </div>
                )}
                {!playlistsLoading && playlists?.length === 0 && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-mid)", fontSize: 14 }}>
                    Aucune playlist Spotify trouvée.
                  </div>
                )}
                {!playlistsLoading &&
                  playlists?.map((pl) => {
                    const linked_ = pl.already_linked || isLinked(pl.id);
                    const loading_ = linking.has(pl.id);
                    return (
                      <div
                        key={pl.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "11px 14px",
                          borderBottom: "1px solid var(--border)",
                          opacity: linked_ ? 0.45 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}
                            className="truncate"
                          >
                            {pl.name}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--ink-mid)", fontWeight: 400 }}>
                            {pl.tracks_total} titre{pl.tracks_total !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {linked_ ? (
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mid)", whiteSpace: "nowrap" }}>
                            Liée
                          </span>
                        ) : (
                          <button
                            className="s-btn s-btn-sm"
                            onClick={() => linkPlaylist(pl)}
                            disabled={loading_}
                            style={{ whiteSpace: "nowrap", fontSize: 12 }}
                          >
                            {loading_ ? "…" : "Importer"}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>

              {showCreate ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="s-input"
                    placeholder="Nom de la playlist"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                    autoFocus
                    style={{ flex: 1, fontSize: 14, padding: "9px 12px" }}
                  />
                  <button
                    className="s-btn s-btn-sm"
                    onClick={createPlaylist}
                    disabled={!newName.trim() || creating}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {creating ? "…" : "Créer"}
                  </button>
                  <button
                    className="s-btn s-btn-sm"
                    onClick={() => { setShowCreate(false); setNewName(""); }}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  className="s-btn s-btn-sm"
                  onClick={() => setShowCreate(true)}
                  style={{ alignSelf: "flex-start" }}
                >
                  + Créer nouvelle
                </button>
              )}

              <button
                className="s-btn s-btn-primary"
                onClick={next}
                disabled={linked.length === 0}
                style={{ alignSelf: "stretch", justifyContent: "center", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Schedule ── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <BackButton onBack={back} />
            <div
              className="s-card"
              style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 24 }}
            >
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 8 }}>
                  Tri hebdomadaire
                </h2>
                <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 400, lineHeight: 1.65 }}>
                  Sortify peut trier tes nouveaux likes automatiquement chaque lundi matin.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface2)",
                }}
              >
                <div>
                  <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>Tri automatique</p>
                  <p style={{ fontSize: 13, color: "var(--ink-mid)", fontWeight: 400, marginTop: 3 }}>Chaque lundi matin</p>
                </div>
                <button
                  onClick={() => setCron((v) => !v)}
                  style={{
                    position: "relative",
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: cron ? "var(--terra)" : "var(--border-strong)",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                  role="switch"
                  aria-checked={cron}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: cron ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--ink-mid)", fontWeight: 400 }}>
                  Scope :{" "}
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {SCOPE_LABELS[scope]}
                  </span>
                </span>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--terra)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  Modifier
                </button>
              </div>

              <button
                className="s-btn s-btn-primary"
                onClick={next}
                style={{ alignSelf: "stretch", justifyContent: "center", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Ready ── */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <BackButton onBack={back} />
            <div
              className="s-card"
              style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}
            >
              <div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--terra-light)",
                    border: "1px solid var(--terra-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, color: "var(--terra)" }}>
                    <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 8 }}>
                  Tout est prêt
                </h2>
                <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 400, lineHeight: 1.65 }}>
                  Sortify est configuré. Lance le premier tri pour voir l&apos;IA en action.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "16px",
                  borderRadius: 10,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                }}
              >
                <SummaryRow
                  label="Playlists"
                  value={`${linked.length} playlist${linked.length !== 1 ? "s" : ""} liée${linked.length !== 1 ? "s" : ""}`}
                />
                <SummaryRow label="Import" value={SCOPE_LABELS[scope]} />
                <SummaryRow label="Tri auto" value={cron ? "Activé (lundi matin)" : "Désactivé"} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  className="s-btn s-btn-primary"
                  onClick={() => void startDemo()}
                  disabled={finishing}
                  style={{ alignSelf: "stretch", justifyContent: "center", padding: "13px 0", fontSize: 14, fontWeight: 500 }}
                >
                  {finishing ? "Lancement…" : "Voir la démo →"}
                </button>
                <button
                  onClick={() => void finish(false)}
                  disabled={finishing}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    background: "none",
                    border: "none",
                    color: "var(--ink-mid)",
                    fontSize: 13,
                    fontWeight: 400,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: "6px 0",
                  }}
                >
                  Passer pour l&apos;instant
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Live classification demo ── */}
        {step === 6 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              className="s-card"
              style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}
            >
              {/* Header */}
              {!demoDone ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: demoWaiting ? "var(--ink-dim)" : "var(--terra)",
                      flexShrink: 0,
                    }} />
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px" }}>
                      {demoWaiting ? "Import en cours…" : "Tri en cours…"}
                    </h2>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--ink-dim)", fontWeight: 400 }}>
                    {demoWaiting
                      ? "Tes liked songs sont en cours d'import. La classification démarrera automatiquement."
                      : `${demoResults.length} titre${demoResults.length !== 1 ? "s" : ""} traité${demoResults.length !== 1 ? "s" : ""}`}
                  </p>
                  {!demoWaiting && demoTotal > 0 && (
                    <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        background: "var(--terra)",
                        borderRadius: 2,
                        width: `${Math.min(100, demoRemaining !== null ? ((demoTotal - demoRemaining) / demoTotal) * 100 : 0)}%`,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--terra-light)",
                    border: "1px solid var(--terra-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}>
                    <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, color: "var(--terra)" }}>
                      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 6 }}>
                    {demoResults.length} titre{demoResults.length !== 1 ? "s" : ""} classé{demoResults.length !== 1 ? "s" : ""} en {demoElapsed}s.
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--ink-dim)", fontWeight: 400 }}>
                    Bienvenue dans Sortify.
                  </p>
                </div>
              )}

              {/* Live results list */}
              {demoResults.length > 0 && (
                <div style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                }}>
                  {demoResults.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderBottom: i < demoResults.length - 1 ? "1px solid var(--border)" : "none",
                        animation: "s-fade-in 0.2s ease",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--ink-dim)", flexShrink: 0 }}>↪</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--ink)",
                          fontWeight: 500,
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}{r.artist ? ` · ${r.artist}` : ""}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: "var(--terra)",
                        fontWeight: 500,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        maxWidth: 110,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        → {r.playlist_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              {demoDone ? (
                <Link
                  href="/dashboard"
                  className="s-btn s-btn-primary"
                  style={{
                    alignSelf: "stretch",
                    justifyContent: "center",
                    padding: "13px 0",
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  Voir mes playlists →
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-mid)",
                    fontSize: 13,
                    fontWeight: 400,
                    textDecoration: "none",
                    padding: "4px 0",
                  }}
                >
                  Passer →
                </Link>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
