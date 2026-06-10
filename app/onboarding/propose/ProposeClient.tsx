"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  ProposedPlaylist,
  TaxonomyProposal,
} from "@/app/api/onboarding/propose-taxonomy/route";

const SWATCH_COLORS = [
  "#c8935a",
  "#c4a440",
  "#b85c48",
  "#c4758a",
  "#7f77dd",
  "#4e8fa8",
  "#7a9e5a",
  "#3d7a70",
];

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type EditablePlaylist = ProposedPlaylist & {
  _id: string;
  _deleted: boolean;
  _origIndex: number;
};

function uid() { return Math.random().toString(36).slice(2); }

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 13, height: 13, borderRadius: "50%",
      border: "2px solid var(--terra)", borderTopColor: "transparent",
      animation: "spin 0.8s linear infinite", verticalAlign: "middle", flexShrink: 0,
    }} />
  );
}

// ── Tag input pour les genres ──────────────────────────────────────────────────

function GenreTagInput({
  genres,
  color,
  onChange,
}: {
  genres: string[];
  color: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag || genres.includes(tag)) { setDraft(""); return; }
    onChange([...genres, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    if (e.key === "Backspace" && !draft && genres.length > 0) {
      onChange(genres.slice(0, -1));
    }
  }

  const tagBg = hexToRgba(color, 0.12);
  const tagBorder = hexToRgba(color, 0.28);

  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center",
        background: hexToRgba(color, 0.05),
        border: `1px solid ${hexToRgba(color, 0.2)}`,
        borderRadius: 8, padding: "6px 8px", cursor: "text",
        minHeight: 36,
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {genres.map((g) => (
        <span key={g} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
          background: tagBg, color, border: `1px solid ${tagBorder}`,
        }}>
          {g}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(genres.filter(x => x !== g)); }}
            style={{ background: "none", border: "none", cursor: "pointer", color, fontSize: 11, padding: 0, lineHeight: 1, opacity: 0.7 }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
        placeholder={genres.length === 0 ? "Ajouter un genre… (Entrée)" : ""}
        style={{
          background: "none", border: "none", outline: "none",
          fontSize: 11, color: "var(--ink-dim)", minWidth: 120, flex: 1,
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function ProposeClient() {
  const router = useRouter();
  const [proposal, setProposal] = useState<TaxonomyProposal | null>(null);
  const [playlists, setPlaylists] = useState<EditablePlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpDraft, setHelpDraft] = useState("");
  const [unmatchedTracks, setUnmatchedTracks] = useState<{ name: string; artist: string }[]>([]);
  const [globalCoverage, setGlobalCoverage] = useState<{ matched: number; total: number; pct: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function fetchProposal(force = false) {
    try {
      const res = await fetch("/api/onboarding/propose-taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, target_count: 6 }),
      });
      const data = await res.json() as TaxonomyProposal & { error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Erreur inconnue"); return; }
      setProposal(data);
      setGlobalCoverage(data.global_coverage);
      setUnmatchedTracks(data.unmatched_tracks ?? []);
      setPlaylists(
        (data.playlists ?? []).map((p, i) => ({ ...p, _id: uid(), _deleted: false, _origIndex: i }))
      );
    } catch (e) { setError(String(e)); }
  }

  useEffect(() => {
    fetchProposal(false).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    await fetchProposal(true);
    setRegenerating(false);
  }

  async function recalculate() {
    setRecalculating(true);
    const active = playlists.filter((p) => !p._deleted);
    try {
      const res = await fetch("/api/onboarding/recalculate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anchors: active.map((p) => ({
            name: p.name,
            genres_include: p.genres_include,
            llm_help_text: p.llm_help_text,
          })),
        }),
      });
      const data = await res.json() as {
        new_playlists: typeof playlists[number][];
        unmatched_tracks: { name: string; artist: string }[];
        unmatched_count: number;
        global_coverage: { matched: number; total: number; pct: number };
        message?: string;
      };
      if ("error" in data) { setError((data as { error: string }).error); setRecalculating(false); return; }
      setGlobalCoverage(data.global_coverage);
      setUnmatchedTracks(data.unmatched_tracks);
      if (data.new_playlists?.length > 0) {
        setPlaylists((prev) => [
          ...prev,
          ...data.new_playlists.map((p) => ({
            ...p,
            _id: uid(),
            _deleted: false,
            _origIndex: -1,
          })),
        ]);
      }
    } catch (e) { setError(String(e)); }
    setRecalculating(false);
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
    setPlaylists((prev) => [...prev, {
      _id: uid(), _deleted: false, _origIndex: -1,
      name: "", description: "", llm_help_text: "",
      genres_include: [], genres_exclude: [], example_artists: [],
      coverage: { matched: 0, total: 0, pct: 0, sample_tracks: [] },
    }]);
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
          <div style={{ fontSize: 12, color: "var(--ink-dimmer)", marginTop: 4 }}>Quelques secondes</div>
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
  const lowCoverage = globalCoverage && globalCoverage.pct < 60;
  const remainingUnmatched = globalCoverage
    ? (globalCoverage.total - globalCoverage.matched) - unmatchedTracks.length
    : 0;
  const busy = regenerating || recalculating;

  return (
    <main className="s-page" style={{ paddingBottom: 120 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-fraunces" style={{ fontSize: 30, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: 8 }}>
          Ton organisation<br />proposée
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6, margin: "0 0 16px" }}>
          Sortify a analysé ta bibliothèque. Valide, renomme ou supprime les playlists avant de lancer le tri.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="s-btn" disabled={busy} onClick={recalculate} style={{ minHeight: 36 }}>
            {recalculating ? <><Spinner />&nbsp;Analyse…</> : "✦ Compléter avec le LLM"}
          </button>
          <button className="s-btn s-btn-sm" disabled={busy} onClick={regenerate} style={{ minHeight: 36 }}>
            {regenerating ? <><Spinner />&nbsp;…</> : "Régénérer"}
          </button>
        </div>
      </div>

      {/* Grille de playlists */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: busy ? 0.4 : 1, transition: "opacity 0.25s" }}>
        {active.map((pl, idx) => {
          const color = SWATCH_COLORS[idx % SWATCH_COLORS.length];
          const bg = hexToRgba(color, 0.07);
          const border = hexToRgba(color, 0.28);

          return (
            <div key={pl._id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden", position: "relative" }}>
              <div style={{ height: 3, background: color, opacity: 0.8 }} />
              <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Nom + supprimer */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    style={{
                      flex: 1, background: "transparent", border: "none",
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: 17, fontWeight: 700, color,
                      outline: "none", padding: 0, letterSpacing: "-0.2px",
                    }}
                    value={pl.name}
                    placeholder="Nom de la playlist"
                    onChange={(e) => updatePlaylist(pl._id, { name: e.target.value })}
                  />
                  <button
                    onClick={() => updatePlaylist(pl._id, { _deleted: true })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-dimmer)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, flexShrink: 0, transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--terra)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-dimmer)")}
                    title="Supprimer"
                    aria-label="Supprimer cette playlist"
                  >
                    ✕
                  </button>
                </div>

                {/* Help text éditable */}
                {editingId === pl._id ? (
                  <textarea
                    ref={textareaRef}
                    value={helpDraft}
                    onChange={(e) => setHelpDraft(e.target.value)}
                    onBlur={() => saveHelpText(pl)}
                    rows={3}
                    style={{
                      width: "100%", background: hexToRgba(color, 0.08),
                      border: `1px solid ${border}`, borderRadius: 8,
                      padding: "8px 10px", fontSize: 13, color: "var(--ink)",
                      lineHeight: 1.6, resize: "vertical", boxSizing: "border-box",
                      fontFamily: "var(--font-sans), sans-serif", outline: "none",
                    }}
                  />
                ) : (
                  <div
                    onClick={() => startEditHelp(pl)}
                    style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.65, cursor: "text", padding: "2px 0" }}
                    title="Cliquer pour modifier"
                  >
                    {pl.llm_help_text || (
                      <span style={{ color: "var(--ink-dimmer)", fontStyle: "italic" }}>Ajouter un texte de guidage…</span>
                    )}
                  </div>
                )}

                {/* Genres — tag input */}
                <GenreTagInput
                  genres={pl.genres_include}
                  color={color}
                  onChange={(next) => updatePlaylist(pl._id, { genres_include: next })}
                />

                {/* Sample tracks + couverture */}
                {(pl.coverage.sample_tracks.length > 0 || pl.coverage.total > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                    {pl.coverage.sample_tracks.slice(0, 3).map((t, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 99,
                        background: "var(--surface2)", color: "var(--ink-mid)",
                        border: "1px solid var(--border)",
                      }}>
                        {t.artist}
                      </span>
                    ))}
                    {pl.coverage.total > 0 && (
                      <span style={{ fontSize: 11, color, fontWeight: 600, marginLeft: 2 }}>
                        {pl.coverage.pct}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card "Non classés" */}
      {unmatchedTracks.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginTop: 12, opacity: busy ? 0.4 : 1, transition: "opacity 0.25s" }}>
          <div style={{ height: 3, background: "var(--ink-dimmer)" }} />
          <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span className="font-fraunces" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-dim)", letterSpacing: "-0.2px" }}>
                Non classés
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-dimmer)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--border)" }}>
                {globalCoverage ? globalCoverage.total - globalCoverage.matched : unmatchedTracks.length} tracks
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-dimmer)", margin: 0, lineHeight: 1.55 }}>
              Ces tracks ne rentrent dans aucune playlist. Clique sur <strong style={{ color: "var(--ink-mid)" }}>Compléter avec le LLM</strong> pour que Sortify propose de nouvelles playlists qui les couvrent.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {unmatchedTracks.map((t, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 99,
                  background: "var(--surface2)", color: "var(--ink-dimmer)",
                  border: "1px solid var(--border)",
                }}>
                  {t.artist}
                </span>
              ))}
              {remainingUnmatched > 0 && (
                <span style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 99,
                  background: "transparent", color: "var(--ink-dimmer)",
                  border: "1px dashed var(--border)",
                }}>
                  +{remainingUnmatched} autres
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ajouter */}
      <button className="s-btn" style={{ marginTop: 12 }} onClick={addPlaylist} disabled={busy}>
        + Ajouter une playlist
      </button>

      {/* Couverture globale */}
      {globalCoverage && (
        <div style={{
          marginTop: 20, padding: "12px 16px", borderRadius: 10,
          background: lowCoverage ? "rgba(200,152,64,.08)" : "var(--surface)",
          border: `1px solid ${lowCoverage ? "var(--amber-light)" : "var(--border)"}`,
        }}>
          <div style={{ fontSize: 13, color: lowCoverage ? "var(--amber)" : "var(--ink-mid)", fontWeight: 500 }}>
            {globalCoverage.matched} / {globalCoverage.total} tracks couvertes ({globalCoverage.pct}%)
          </div>
          {lowCoverage && (
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 5, lineHeight: 1.5 }}>
              Ajoute une playlist ou régénère pour couvrir plus de sons.
            </div>
          )}
        </div>
      )}

      {/* Barre de validation fixe */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(19,17,16,0.95)", backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--border)",
        padding: "12px 20px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between",
        zIndex: 50,
      }}>
        <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>
          {active.length} playlist{active.length !== 1 ? "s" : ""}
        </span>
        <button
          className="s-btn s-btn-primary"
          disabled={validating || active.length === 0 || busy}
          onClick={validate}
        >
          {validating ? "Création en cours…" : "Valider mon organisation →"}
        </button>
      </div>
    </main>
  );
}
