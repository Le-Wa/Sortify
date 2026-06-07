"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  ProposedPlaylist,
  TaxonomyProposal,
} from "@/app/api/onboarding/propose-taxonomy/route";

type EditablePlaylist = ProposedPlaylist & {
  _id: string;
  _deleted: boolean;
  _origIndex: number;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14, borderRadius: "50%",
      border: "2px solid var(--terra)", borderTopColor: "transparent",
      animation: "spin 0.8s linear infinite",
      verticalAlign: "middle",
    }} />
  );
}

export default function ProposeClient() {
  const router = useRouter();
  const [proposal, setProposal] = useState<TaxonomyProposal | null>(null);
  const [playlists, setPlaylists] = useState<EditablePlaylist[]>([]);
  const [targetCount, setTargetCount] = useState(4);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // Inline editing of llm_help_text
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpDraft, setHelpDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function fetchProposal(force = false, count = targetCount) {
    try {
      const res = await fetch("/api/onboarding/propose-taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, target_count: count }),
      });
      const data = await res.json() as TaxonomyProposal & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Erreur inconnue");
        return;
      }
      setProposal(data);
      setTargetCount(data.target_count ?? count);
      setPlaylists(
        (data.playlists ?? []).map((p, i) => ({
          ...p,
          _id: uid(),
          _deleted: false,
          _origIndex: i,
        }))
      );
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    fetchProposal(false, 4).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerate(count = targetCount) {
    setRegenerating(true);
    setError(null);
    await fetchProposal(true, count);
    setRegenerating(false);
  }

  async function handleSegmentChange(delta: number) {
    const next = Math.min(8, Math.max(2, targetCount + delta));
    setTargetCount(next);
    await regenerate(next);
  }

  function updatePlaylist(id: string, patch: Partial<EditablePlaylist>) {
    setPlaylists((prev) => prev.map((p) => p._id === id ? { ...p, ...patch } : p));
  }

  function startEditHelp(pl: EditablePlaylist) {
    setEditingId(pl._id);
    setHelpDraft(pl.llm_help_text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function saveHelpText(pl: EditablePlaylist) {
    setEditingId(null);
    if (helpDraft === pl.llm_help_text) return;
    updatePlaylist(pl._id, { llm_help_text: helpDraft });
    await fetch("/api/onboarding/taxonomy-proposal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlist_index: pl._origIndex, llm_help_text: helpDraft }),
    }).catch(() => {});
  }

  function addPlaylist() {
    setPlaylists((prev) => [
      ...prev,
      {
        _id: uid(),
        _deleted: false,
        _origIndex: -1,
        name: "",
        description: "",
        llm_help_text: "",
        genres_include: [],
        genres_exclude: [],
        example_artists: [],
        coverage: { matched: 0, total: 0, pct: 0, sample_tracks: [] },
      },
    ]);
  }

  async function validate() {
    setValidating(true);
    const toCreate = playlists.filter((p) => !p._deleted && p.name.trim());

    for (const pl of toCreate) {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pl.name,
          description: pl.description || null,
          rules: {
            genres: { include: pl.genres_include, exclude: pl.genres_exclude ?? [] },
            audio_features: {},
            hard_constraints: { max_age_days: null, require_genre_signal: false },
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setError(err.error ?? `Erreur création "${pl.name}" (${res.status})`);
        setValidating(false);
        return;
      }
    }

    // Effacer la proposition temporaire
    await fetch("/api/onboarding/taxonomy-proposal", { method: "DELETE" }).catch(() => {});

    await fetch("/api/onboarding/jobs/start", { method: "POST" });
    router.replace("/dashboard");
  }

  if (loading) {
    return (
      <main className="s-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: "var(--ink-dim)" }}>
          <Spinner />
          <div style={{ fontSize: 14, marginTop: 12 }}>Analyse de ta bibliothèque…</div>
          <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>Quelques secondes</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="s-page">
        <div style={{ color: "var(--terra)", fontSize: 13 }}>Erreur : {error}</div>
        <button className="s-btn s-btn-primary" style={{ marginTop: 16 }} onClick={() => router.replace("/dashboard")}>
          Retour au dashboard
        </button>
      </main>
    );
  }

  const active = playlists.filter((p) => !p._deleted);
  const globalCoverage = proposal?.global_coverage;
  const lowCoverage = globalCoverage && globalCoverage.pct < 60;

  return (
    <main className="s-page" style={{ paddingBottom: 120 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h1 className="font-fraunces" style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            Ton organisation proposée
          </h1>
          <button
            className="s-btn s-btn-sm"
            disabled={regenerating}
            onClick={() => regenerate()}
            style={{ flexShrink: 0, marginTop: 4, whiteSpace: "nowrap" }}
          >
            {regenerating ? <><Spinner />&nbsp;…</> : "Régénérer"}
          </button>
        </div>
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Sortify a analysé ta bibliothèque. Valide, renomme ou supprime les playlists.
        </p>
      </div>

      {/* Contrôle de segmentation (A5) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginTop: 20, marginBottom: 20,
        padding: "10px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        width: "fit-content",
      }}>
        <button
          className="s-btn s-btn-sm"
          disabled={regenerating || targetCount <= 2}
          onClick={() => handleSegmentChange(-1)}
          style={{ minWidth: 32, padding: "4px 10px" }}
        >
          −
        </button>
        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, minWidth: 76, textAlign: "center" }}>
          {targetCount} playlists
        </span>
        <button
          className="s-btn s-btn-sm"
          disabled={regenerating || targetCount >= 8}
          onClick={() => handleSegmentChange(+1)}
          style={{ minWidth: 32, padding: "4px 10px" }}
        >
          +
        </button>
        {regenerating && (
          <span style={{ fontSize: 12, color: "var(--ink-dim)", marginLeft: 4 }}>
            <Spinner /> &nbsp;Génération…
          </span>
        )}
      </div>

      {/* Cartes de playlists */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: regenerating ? 0.4 : 1, transition: "opacity 0.2s" }}>
        {active.map((pl) => (
          <div key={pl._id} className="s-card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px" }}>
            {/* Ligne nom + supprimer */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                className="ob-input"
                style={{ flex: 1, fontWeight: 600, fontFamily: "var(--font-fraunces), serif", fontSize: 16 }}
                value={pl.name}
                placeholder="Nom de la playlist"
                onChange={(e) => updatePlaylist(pl._id, { name: e.target.value })}
              />
              <button
                className="s-btn s-btn-sm s-btn-danger"
                onClick={() => updatePlaylist(pl._id, { _deleted: true })}
                title="Supprimer"
              >
                ✕
              </button>
            </div>

            {/* Help text (A9) — affiché, éditable inline */}
            {editingId === pl._id ? (
              <textarea
                ref={textareaRef}
                value={helpDraft}
                onChange={(e) => setHelpDraft(e.target.value)}
                onBlur={() => saveHelpText(pl)}
                rows={3}
                style={{
                  width: "100%", background: "var(--surface2)",
                  border: "1px solid var(--terra)", borderRadius: 6,
                  padding: "8px 10px", fontSize: 13, color: "var(--ink)",
                  lineHeight: 1.6, resize: "vertical", boxSizing: "border-box",
                  fontFamily: "var(--font-sans), sans-serif",
                }}
              />
            ) : (
              <div
                onClick={() => startEditHelp(pl)}
                style={{
                  fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6,
                  cursor: "text", padding: "6px 8px",
                  border: "1px solid transparent", borderRadius: 6,
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
                title="Cliquer pour modifier"
              >
                {pl.llm_help_text || <span style={{ color: "var(--ink-dimmer)", fontStyle: "italic" }}>Ajouter un texte de guidage…</span>}
              </div>
            )}

            {/* Couverture (A4) */}
            {pl.coverage.total > 0 && (
              <div style={{ fontSize: 12, color: "var(--ink-mid)" }}>
                {pl.coverage.matched} tracks correspondent · {pl.coverage.pct}%
              </div>
            )}

            {/* Tracks exemples (A8) */}
            {pl.coverage.sample_tracks.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pl.coverage.sample_tracks.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: "3px 9px", borderRadius: 99,
                    background: "var(--surface3)", color: "var(--ink-mid)",
                    border: "1px solid var(--border)",
                  }}>
                    {t.artist} — {t.name}
                  </span>
                ))}
              </div>
            )}

            {/* Genres (A8) */}
            {pl.genres_include.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pl.genres_include.map((g) => (
                  <span key={g} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 99,
                    background: "var(--terra-light)", color: "var(--terra)",
                    border: "1px solid var(--terra-border)",
                  }}>
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        className="s-btn"
        style={{ marginTop: 8, alignSelf: "flex-start" }}
        onClick={addPlaylist}
        disabled={regenerating}
      >
        + Ajouter une playlist
      </button>

      {/* Indicateur global de couverture (A4) */}
      {globalCoverage && (
        <div style={{
          marginTop: 24, padding: "14px 16px", borderRadius: 10,
          background: lowCoverage ? "rgba(200,152,64,.08)" : "var(--surface)",
          border: `1px solid ${lowCoverage ? "var(--amber-light)" : "var(--border)"}`,
        }}>
          <div style={{ fontSize: 13, color: lowCoverage ? "var(--amber)" : "var(--ink-mid)", fontWeight: 500 }}>
            {globalCoverage.matched} / {globalCoverage.total} tracks couvertes ({globalCoverage.pct}%)
          </div>
          {lowCoverage && (
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 6, lineHeight: 1.5 }}>
              Certains sons ne rentrent dans aucune playlist. Affine la segmentation ou ajoute une playlist.
            </div>
          )}
        </div>
      )}

      {/* Barre de validation */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(19,17,16,0.95)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--border)",
        padding: "12px 20px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between",
        zIndex: 50,
      }}>
        <span style={{ fontSize: 12, color: "var(--ink-dim)", alignSelf: "center" }}>
          {active.length} playlist{active.length !== 1 ? "s" : ""} sélectionnée{active.length !== 1 ? "s" : ""}
        </span>
        <button
          className="s-btn s-btn-primary"
          disabled={validating || active.length === 0 || regenerating}
          onClick={validate}
        >
          {validating ? "Création en cours…" : "Valider mon organisation →"}
        </button>
      </div>
    </main>
  );
}
