"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassifierResult {
  playlist_id: string | null;
  playlist_name: string | null;
  confidence: number;
  level: number;
  needs_review: boolean;
  reason: string | null;
  detail: { id: string; name: string; confidence: number }[];
}

interface Label {
  correct_playlist_ids: string[];
  correct_playlist_names: string[];
  notes: string | null;
  labeled_at: string;
}

interface BenchmarkTrack {
  track_id: string;
  name: string;
  artist: string;
  album: string;
  genres: string[];
  af_energy: number | null;
  af_danceability: number | null;
  af_valence: number | null;
  af_acousticness: number | null;
  af_tempo: number | null;
  current_playlist_id: string | null;
  current_playlist_name: string | null;
  v1_playlist_id: string | null;
  v1_playlist_name: string | null;
  v1_confidence: number;
  v1_level: number;
  v1_needs_review: boolean;
  v1_reason: string | null;
  v1_detail: { id: string; name: string; confidence: number }[];
  v2_playlist_id: string | null;
  v2_playlist_name: string | null;
  v2_confidence: number;
  v2_level: number;
  v2_needs_review: boolean;
  v2_reason: string | null;
  v2_detail: { id: string; name: string; confidence: number }[];
  label: Label | null;
}

interface Playlist {
  id: string;
  name: string;
  llm_help_text: string | null;
}

interface TrainSuggestion {
  playlist_id: string;
  playlist_name: string;
  current_llm_help_text: string | null;
  suggested_llm_help_text: string;
  reasoning: string;
  examples_count: number;
}

type FilterTab = "all" | "disagree" | "unlabeled" | "labeled";

// ── Helpers ───────────────────────────────────────────────────────────────────

function agree(t: BenchmarkTrack): boolean {
  // Classifiers agree if they chose the same primary playlist (both null = both inbox)
  return t.v1_playlist_id === t.v2_playlist_id;
}

function inCorrect(playlistId: string | null, needsReview: boolean, label: Label): boolean {
  const isInbox = label.correct_playlist_ids.length === 0;
  if (isInbox) return needsReview;
  return playlistId !== null && label.correct_playlist_ids.includes(playlistId);
}

function confColor(c: number): string {
  if (c >= 0.75) return "var(--sage)";
  if (c >= 0.50) return "var(--amber)";
  return "var(--terra)";
}

function who(t: BenchmarkTrack): "v1" | "v2" | "both" | "neither" | null {
  if (!t.label) return null;
  const v1ok = inCorrect(t.v1_playlist_id, t.v1_needs_review, t.label);
  const v2ok = inCorrect(t.v2_playlist_id, t.v2_needs_review, t.label);
  if (v1ok && v2ok) return "both";
  if (v1ok) return "v1";
  if (v2ok) return "v2";
  return "neither";
}

function WhoWon({ t }: { t: BenchmarkTrack }) {
  const w = who(t);
  if (!w) return null;
  const map: Record<string, { label: string; color: string }> = {
    both: { label: "v1+v2 ✓", color: "var(--sage)" },
    v1: { label: "v1 ✓", color: "var(--amber)" },
    v2: { label: "v2 ✓", color: "var(--terra)" },
    neither: { label: "aucun", color: "var(--ink-dimmer)" },
  };
  const { label, color } = map[w];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em" }}>{label}</span>
  );
}

function AfBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10, color: "var(--ink-dim)", width: 48, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, background: "var(--terra)", width: `${value * 100}%`, opacity: 0.7 }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--ink-mid)", width: 28, textAlign: "right" }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

// ── Label panel (expanded inline) ────────────────────────────────────────────

function LabelPanel({
  track,
  playlists,
  onSave,
  onClear,
  saving,
}: {
  track: BenchmarkTrack;
  playlists: Playlist[];
  onSave: (playlistIds: string[], notes: string) => void;
  onClear: () => void;
  saving: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(track.label?.correct_playlist_ids ?? [])
  );
  const [notes, setNotes] = useState(track.label?.notes ?? "");

  function togglePlaylist(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isInbox = selectedIds.size === 0;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "14px 16px",
        background: "var(--surface2)",
        display: "grid",
        gap: 14,
      }}
    >
      {/* Audio features */}
      {(track.af_energy !== null || track.af_danceability !== null) && (
        <div style={{ display: "grid", gap: 4 }}>
          <AfBar label="Energy" value={track.af_energy} />
          <AfBar label="Dance" value={track.af_danceability} />
          <AfBar label="Valence" value={track.af_valence} />
          <AfBar label="Acoustic" value={track.af_acousticness} />
          {track.af_tempo !== null && (
            <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>{Math.round(track.af_tempo)} BPM</span>
          )}
        </div>
      )}

      {/* Reasons */}
      <div style={{ display: "grid", gap: 6 }}>
        {track.v1_reason && (
          <div style={{ fontSize: 11, color: "var(--ink-mid)" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>v1 :</span> {track.v1_reason}
          </div>
        )}
        {track.v2_reason && (
          <div style={{ fontSize: 11, color: "var(--ink-mid)" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>v2 :</span> {track.v2_reason}
          </div>
        )}
      </div>

      {/* Playlist picker — multi-select */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-mid)", marginBottom: 8 }}>
          Bonne(s) playlist(s) — sélection multiple :
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              border: isInbox ? "1.5px solid var(--ink-mid)" : "1px solid var(--border)",
              background: isInbox ? "var(--surface3)" : "var(--surface)",
              color: isInbox ? "var(--ink-mid)" : "var(--ink-dimmer)",
              cursor: "pointer",
            }}
          >
            Inbox / Ambigu
          </button>
          {playlists.map((p) => {
            const active = selectedIds.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlaylist(p.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  border: active ? "1.5px solid var(--terra)" : "1px solid var(--border)",
                  background: active ? "var(--terra-light)" : "var(--surface)",
                  color: active ? "var(--terra)" : "var(--ink-mid)",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              >
                {active ? "✓ " : ""}{p.name}
              </button>
            );
          })}
        </div>
        {selectedIds.size > 1 && (
          <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 6 }}>
            {selectedIds.size} playlists sélectionnées — ce track appartient aux deux
          </p>
        )}
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note (optionnel) — pourquoi ce choix, cas limite…"
        rows={2}
        className="s-input"
        style={{ fontSize: 11, resize: "none" }}
      />

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => onSave([...selectedIds], notes)}
          disabled={saving}
          className="s-btn s-btn-sm"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {track.label && (
          <button
            onClick={onClear}
            disabled={saving}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 11,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--ink-dim)",
              cursor: "pointer",
            }}
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

// ── TrackRow ─────────────────────────────────────────────────────────────────

function TrackRow({
  track,
  playlists,
  onLabel,
}: {
  track: BenchmarkTrack;
  playlists: Playlist[];
  onLabel: (trackId: string, playlistIds: string[], notes: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAgree = agree(track);

  async function handleSave(playlistIds: string[], notes: string) {
    setSaving(true);
    try {
      await onLabel(track.track_id, playlistIds, notes);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await fetch(`/api/admin/benchmark/label?track_id=${track.track_id}`, { method: "DELETE" });
      await onLabel(track.track_id, [], "");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const hasLabel = !!track.label;
  const labelNames = track.label?.correct_playlist_names ?? [];
  const labelDisplay = !track.label
    ? null
    : labelNames.length === 0
    ? "Inbox"
    : labelNames.length === 1
    ? labelNames[0]
    : `${labelNames[0]} +${labelNames.length - 1}`;

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${isAgree ? "var(--border)" : "rgba(200,100,60,0.25)"}`,
        background: isAgree ? "var(--surface)" : "rgba(200,100,60,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Main row */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Track info */}
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {track.name}
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span>{track.artist}</span>
            {track.genres.slice(0, 2).map((g) => (
              <span key={g} style={{ color: "var(--ink-dimmer)" }}>· {g}</span>
            ))}
          </p>
        </div>

        {/* v1 result */}
        <div style={{ textAlign: "right", minWidth: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
            {track.v1_needs_review ? <span style={{ color: "var(--ink-dimmer)" }}>inbox</span> : (track.v1_playlist_name ?? "—")}
          </p>
          <p style={{ fontSize: 10, color: confColor(track.v1_confidence) }}>{track.v1_confidence.toFixed(2)}</p>
        </div>

        {/* v2 result */}
        <div style={{ textAlign: "right", minWidth: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: isAgree ? "var(--ink)" : "var(--terra)" }}>
            {track.v2_needs_review ? <span style={{ color: "var(--ink-dimmer)" }}>inbox</span> : (track.v2_playlist_name ?? "—")}
          </p>
          <p style={{ fontSize: 10, color: confColor(track.v2_confidence) }}>{track.v2_confidence.toFixed(2)}</p>
        </div>

        {/* Label status */}
        <div style={{ textAlign: "right", minWidth: 70 }}>
          {hasLabel ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--sage)",
                  background: "var(--sage-light)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                ✓ {labelDisplay}
              </span>
              <WhoWon t={track} />
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "var(--ink-dimmer)" }}>À labelliser</span>
          )}
        </div>
      </div>

      {/* Expand */}
      {open && (
        <LabelPanel
          track={track}
          playlists={playlists}
          onSave={handleSave}
          onClear={handleClear}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Train modal ───────────────────────────────────────────────────────────────

function TrainModal({
  suggestions,
  onClose,
  onApply,
}: {
  suggestions: TrainSuggestion[];
  onClose: () => void;
  onApply: (playlistId: string, text: string) => Promise<void>;
}) {
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, string>>(
    Object.fromEntries(suggestions.map((s) => [s.playlist_id, s.suggested_llm_help_text]))
  );

  async function handleApply(id: string) {
    setApplying(id);
    try {
      await onApply(id, edited[id]);
      setApplied((prev) => new Set(prev).add(id));
    } finally {
      setApplying(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
        padding: "0 0 0 0",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          overflow: "auto",
          padding: "24px 20px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            Suggestions d'entraînement
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--ink-dim)", padding: "4px 8px" }}
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--ink-mid)" }}>
          Basé sur tes {suggestions.reduce((s, x) => s + x.examples_count, 0)} corrections.
          Édite si besoin, puis applique playlist par playlist.
        </p>

        {suggestions.map((s) => (
          <div
            key={s.playlist_id}
            style={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{s.playlist_name}</p>
                <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
                  {s.examples_count} track{s.examples_count > 1 ? "s" : ""} labelisés · {s.reasoning}
                </p>
              </div>
              <button
                onClick={() => void handleApply(s.playlist_id)}
                disabled={applying === s.playlist_id || applied.has(s.playlist_id)}
                className="s-btn s-btn-sm"
                style={{ opacity: applying === s.playlist_id ? 0.6 : 1, flexShrink: 0 }}
              >
                {applied.has(s.playlist_id) ? "✓ Appliqué" : applying === s.playlist_id ? "…" : "Appliquer"}
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {s.current_llm_help_text && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-dimmer)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Actuel</p>
                  <p style={{ fontSize: 11, color: "var(--ink-dim)", lineHeight: 1.5 }}>{s.current_llm_help_text}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--terra)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Suggéré</p>
                <textarea
                  value={edited[s.playlist_id]}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [s.playlist_id]: e.target.value }))}
                  rows={4}
                  className="s-input"
                  style={{ fontSize: 12, resize: "vertical", width: "100%", boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BenchmarkClient() {
  const [tracks, setTracks] = useState<BenchmarkTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [filterPlaylist, setFilterPlaylist] = useState("");
  const [trainSuggestions, setTrainSuggestions] = useState<TrainSuggestion[] | null>(null);
  const [training, setTraining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/benchmark");
      const data = (await res.json()) as {
        snapshot: { ran_at: string; results: BenchmarkTrack[] } | null;
        playlists: Playlist[];
      };
      setPlaylists(data.playlists ?? []);
      if (data.snapshot) {
        setTracks(data.snapshot.results);
        setRanAt(data.snapshot.ran_at);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRun() {
    setRunning(true);
    setRunProgress("Lancement de la classification v1 + v2…");
    try {
      const res = await fetch("/api/admin/benchmark/run", { method: "POST" });
      const data = (await res.json()) as { count: number; ran_at: string };
      setRunProgress(`✓ ${data.count} tracks classifiés`);
      await load();
      setTimeout(() => setRunProgress(null), 3000);
    } catch {
      setRunProgress("Erreur");
    } finally {
      setRunning(false);
    }
  }

  async function handleLabel(trackId: string, playlistIds: string[], notes: string) {
    await fetch("/api/admin/benchmark/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id: trackId, correct_playlist_ids: playlistIds, notes }),
    });
    await load();
  }

  async function handleTrain() {
    setTraining(true);
    try {
      const res = await fetch("/api/admin/benchmark/train", { method: "POST" });
      const data = (await res.json()) as { suggestions?: TrainSuggestion[]; error?: string };
      if (data.error) { alert(data.error); return; }
      setTrainSuggestions(data.suggestions ?? []);
    } finally {
      setTraining(false);
    }
  }

  async function handleApply(playlistId: string, text: string) {
    await fetch(`/api/playlists/${playlistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm_help_text: text }),
    });
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalTracks = tracks.length;
  const disagreements = tracks.filter((t) => !agree(t)).length;
  const labeled = tracks.filter((t) => t.label).length;
  const v1Inbox = tracks.filter((t) => t.v1_needs_review).length;
  const v2Inbox = tracks.filter((t) => t.v2_needs_review).length;
  const v1Wins = tracks.filter((t) => who(t) === "v1").length;
  const v2Wins = tracks.filter((t) => who(t) === "v2").length;
  const bothWin = tracks.filter((t) => who(t) === "both").length;

  // ── Filtered list ───────────────────────────────────────────────────────────

  let filtered = tracks;
  if (filter === "disagree") filtered = filtered.filter((t) => !agree(t));
  if (filter === "unlabeled") filtered = filtered.filter((t) => !t.label);
  if (filter === "labeled") filtered = filtered.filter((t) => !!t.label);
  if (filterPlaylist) {
    filtered = filtered.filter(
      (t) => t.v1_playlist_id === filterPlaylist || t.v2_playlist_id === filterPlaylist || t.current_playlist_id === filterPlaylist
    );
  }

  if (loading) {
    return (
      <div className="s-page" style={{ paddingTop: 24 }}>
        <p style={{ color: "var(--ink-mid)" }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="s-page" style={{ paddingTop: 20, paddingBottom: 48, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="s-section-title" style={{ marginBottom: 4 }}>Benchmark A/B</h1>
          {ranAt && (
            <p style={{ fontSize: 11, color: "var(--ink-dimmer)" }}>
              Dernier run : {new Date(ranAt).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {labeled > 0 && (
            <button
              onClick={() => void handleTrain()}
              disabled={training}
              className="s-btn s-btn-sm"
              style={{ opacity: training ? 0.6 : 1, background: "var(--terra)", color: "#fff", border: "none" }}
            >
              {training ? "Analyse…" : `Générer suggestions (${labeled})`}
            </button>
          )}
          <button
            onClick={() => void handleRun()}
            disabled={running}
            className="s-btn s-btn-sm"
            style={{ opacity: running ? 0.6 : 1 }}
          >
            {running ? "Calcul…" : tracks.length === 0 ? "Lancer le benchmark" : "Relancer"}
          </button>
          {runProgress && <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{runProgress}</span>}
        </div>
      </div>

      {/* Stats bar */}
      {totalTracks > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 8,
          }}
        >
          {[
            { label: "Tracks", value: totalTracks, accent: false },
            { label: "Désaccords", value: `${disagreements} (${Math.round(disagreements / totalTracks * 100)}%)`, accent: disagreements > 0 },
            { label: "Inbox v1", value: `${v1Inbox} (${Math.round(v1Inbox / totalTracks * 100)}%)`, accent: false },
            { label: "Inbox v2", value: `${v2Inbox} (${Math.round(v2Inbox / totalTracks * 100)}%)`, accent: false },
            { label: "Labellisés", value: `${labeled}/${totalTracks}`, accent: labeled > 0 },
            ...(labeled > 0 ? [
              { label: "v1+v2 ✓", value: bothWin, accent: false },
              { label: "v1 seul ✓", value: v1Wins, accent: false },
              { label: "v2 seul ✓", value: v2Wins, accent: v2Wins > v1Wins },
            ] : []),
          ].map((s) => (
            <div key={s.label} className="s-stat-card" style={{ padding: "10px 12px" }}>
              <p style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 3 }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.accent ? "var(--terra)" : "var(--ink)", lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {totalTracks > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {(["all", "disagree", "unlabeled", "labeled"] as FilterTab[]).map((f) => {
            const labels: Record<FilterTab, string> = {
              all: `Tous (${totalTracks})`,
              disagree: `Désaccords (${disagreements})`,
              unlabeled: `À labelliser (${totalTracks - labeled})`,
              labeled: `Labellisés (${labeled})`,
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  border: filter === f ? "1.5px solid var(--ink)" : "1px solid var(--border)",
                  background: filter === f ? "var(--ink)" : "var(--surface)",
                  color: filter === f ? "var(--bg)" : "var(--ink-mid)",
                  cursor: "pointer",
                }}
              >
                {labels[f]}
              </button>
            );
          })}
          <select
            value={filterPlaylist}
            onChange={(e) => setFilterPlaylist(e.target.value)}
            className="s-input"
            style={{ fontSize: 11, padding: "5px 10px" }}
          >
            <option value="">Toutes les playlists</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Column headers */}
      {totalTracks > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: 12,
            padding: "0 14px",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-dimmer)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Track</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-dimmer)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right", width: 80 }}>v1</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--terra)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right", width: 80 }}>v2</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-dimmer)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right", width: 70 }}>Label</span>
        </div>
      )}

      {/* Tracks list */}
      {totalTracks === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-mid)" }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>Aucun résultat de benchmark.</p>
          <p style={{ fontSize: 12, color: "var(--ink-dimmer)" }}>Lance le benchmark pour classer tous tes tracks.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-dimmer)", fontSize: 12 }}>
          Aucun track dans ce filtre.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((t) => (
            <TrackRow
              key={t.track_id}
              track={t}
              playlists={playlists}
              onLabel={handleLabel}
            />
          ))}
        </div>
      )}

      {/* Train modal */}
      {trainSuggestions && (
        <TrainModal
          suggestions={trainSuggestions}
          onClose={() => setTrainSuggestions(null)}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
