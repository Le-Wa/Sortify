"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4 | 5;
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

const STEP_LABELS = ["Connexion", "Import", "Playlists", "Schedule", "Prêt"];

function ProgressBar({ step }: { step: Step }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 36,
        gap: 0,
      }}
    >
      {STEP_LABELS.map((label, i) => {
        const s = (i + 1) as Step;
        const done = s < step;
        const active = s === step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: done || active ? "var(--terra)" : "transparent",
                  border: done || active ? "1px solid var(--terra)" : "1px solid var(--border-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 600,
                  color: done || active ? "#fff" : "var(--ink-dim)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }}>
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              <span
                style={{
                  fontSize: 9,
                  color: active ? "var(--terra)" : "var(--ink-dimmer)",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < 4 && (
              <div
                style={{
                  width: 28,
                  height: 1,
                  background: done ? "var(--terra)" : "var(--border-strong)",
                  marginBottom: 14,
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: "none",
        color: "var(--ink-dim)",
        fontSize: 12,
        cursor: "pointer",
        padding: "0 0 20px",
        fontFamily: "inherit",
      }}
    >
      <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }}>
        <path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Retour
    </button>
  );
}

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

  const next = () => setStep((s) => Math.min(s + 1, 5) as Step);
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
                  fontSize: 26,
                  color: "var(--ink)",
                  letterSpacing: "-0.4px",
                  marginBottom: 10,
                }}
              >
                Bienvenue, {userName}
              </h1>
              <p style={{ fontSize: 14, color: "var(--ink-mid)", lineHeight: 1.7 }}>
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
              <span style={{ fontSize: 13, color: "var(--sage)" }}>Spotify connecté</span>
            </div>

            <button
              className="s-btn s-btn-primary"
              onClick={next}
              style={{ alignSelf: "stretch", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
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
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  Scope d&apos;import
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.65 }}>
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
                      padding: "12px 14px",
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
                      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: scope === value ? 500 : 400 }}>
                        {label}
                      </span>
                      {note && (
                        <span style={{ fontSize: 11, color: "var(--terra)", marginLeft: 8 }}>
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
                style={{ alignSelf: "stretch", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
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
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  Playlists cibles
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.65 }}>
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
                      <span style={{ fontSize: 13, color: "var(--ink)", flex: 1, minWidth: 0 }} className="truncate">
                        {pl.name}
                      </span>
                      {pl.spotifyId && learning.has(pl.spotifyId) && (
                        <span style={{ fontSize: 10, color: "var(--ink-dim)", whiteSpace: "nowrap" }}>
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
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-dim)", fontSize: 13 }}>
                    Chargement…
                  </div>
                )}
                {!playlistsLoading && playlists?.length === 0 && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-dim)", fontSize: 13 }}>
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
                          padding: "10px 14px",
                          borderBottom: "1px solid var(--border)",
                          opacity: linked_ ? 0.45 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{ fontSize: 13, color: "var(--ink)", fontWeight: 400 }}
                            className="truncate"
                          >
                            {pl.name}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                            {pl.tracks_total} titre{pl.tracks_total !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {linked_ ? (
                          <span style={{ fontSize: 11, color: "var(--ink-dim)", whiteSpace: "nowrap" }}>
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
                    style={{ flex: 1, fontSize: 13, padding: "9px 12px" }}
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
                style={{ alignSelf: "stretch", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
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
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  Tri hebdomadaire
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.65 }}>
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
                  <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>Tri automatique</p>
                  <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>Chaque lundi matin</p>
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
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>
                  Scope sélectionné :{" "}
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {SCOPE_LABELS[scope]}
                  </span>
                </span>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--terra)",
                    fontSize: 12,
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
                style={{ alignSelf: "stretch", padding: "12px 0", fontSize: 14, fontWeight: 500 }}
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
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  Tout est prêt
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.65 }}>
                  Sortify est configuré. Lance le premier tri pour remplir tes playlists.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "14px 16px",
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
                  onClick={() => finish(true)}
                  disabled={finishing}
                  style={{ alignSelf: "stretch", padding: "13px 0", fontSize: 14, fontWeight: 500 }}
                >
                  {finishing ? "Lancement…" : "Lancer le premier tri"}
                </button>
                <button
                  onClick={() => finish(false)}
                  disabled={finishing}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--ink-dim)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: "6px 0",
                    textAlign: "center",
                  }}
                >
                  Passer pour l&apos;instant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
