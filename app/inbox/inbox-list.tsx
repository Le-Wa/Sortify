"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_PARTICLES = [
  { left: 12, top: 18, size: 8,  color: "var(--terra)",  delay: 0,   dur: 1200 },
  { left: 25, top: 8,  size: 5,  color: "var(--sage)",   delay: 60,  dur: 1100 },
  { left: 38, top: 14, size: 9,  color: "var(--amber)",  delay: 120, dur: 1300 },
  { left: 52, top: 6,  size: 6,  color: "var(--terra)",  delay: 30,  dur: 1150 },
  { left: 65, top: 20, size: 7,  color: "var(--sage)",   delay: 90,  dur: 1200 },
  { left: 78, top: 10, size: 5,  color: "var(--amber)",  delay: 150, dur: 1100 },
  { left: 88, top: 16, size: 8,  color: "var(--terra)",  delay: 20,  dur: 1250 },
  { left: 18, top: 5,  size: 6,  color: "var(--amber)",  delay: 80,  dur: 1200 },
  { left: 45, top: 22, size: 7,  color: "var(--sage)",   delay: 40,  dur: 1150 },
  { left: 58, top: 12, size: 5,  color: "var(--terra)",  delay: 110, dur: 1300 },
  { left: 72, top: 4,  size: 9,  color: "var(--amber)",  delay: 70,  dur: 1100 },
  { left: 32, top: 25, size: 6,  color: "var(--sage)",   delay: 140, dur: 1200 },
];

function Confetti() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998 }}>
      {CONFETTI_PARTICLES.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            borderRadius: i % 3 === 0 ? "50%" : 2,
            background: p.color,
            animation: `confetti-fall ${p.dur}ms ${p.delay}ms ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

interface InboxTrack {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artist_name: string | null;
  album_name: string | null;
  isrc: string | null;
  genres: string[];
  enrichment_source: string | null;
  audio_features: { energy?: number; danceability?: number; tempo?: number } | null;
  llm_suggestion_id: string | null;
  suggested_playlist: string | null;
  suggested_playlist_spotify_id: string | null;
  confidence: number | null;
  classification_reason: string | null;
  is_unclassified: boolean;
  deezer_id: string | null;
}

type ConfidenceFilter = "all" | "uncertain" | "very_uncertain";

const CONFIDENCE_THRESHOLDS: Record<ConfidenceFilter, number> = {
  all: 1.0,
  uncertain: 0.55,
  very_uncertain: 0.4,
};

interface InboxPlaylist {
  id: string;
  spotify_playlist_id: string;
  name: string;
}

interface ApiResponse {
  tracks: InboxTrack[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

const GENRE_PALETTES = [
  { bg: "var(--sage-light)", color: "var(--sage)", border: "var(--sage-border)" },
  { bg: "var(--amber-light)", color: "var(--amber)", border: "rgba(200,152,64,0.25)" },
  { bg: "var(--terra-light)", color: "var(--terra)", border: "var(--terra-border)" },
  { bg: "rgba(136,120,208,0.12)", color: "#8878d0", border: "rgba(136,120,208,0.22)" },
];
function genrePalette(genre: string) {
  let h = 0;
  for (const c of genre) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return GENRE_PALETTES[h % GENRE_PALETTES.length];
}

function FeatureBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
      <span style={{ width: 72, flexShrink: 0, color: "var(--ink-dim)" }}>{label}</span>
      <div style={{ flex: 1, height: 3, borderRadius: 3, background: "var(--surface3)" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            background: "var(--ink-dim)",
            width: `${Math.round(value * 100)}%`,
          }}
        />
      </div>
      <span style={{ width: 24, textAlign: "right", color: "var(--ink-dim)" }}>
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

function TrackCard({
  track,
  playlists,
  playlistsLoading,
  isExiting,
  isBusy,
  isCorrectingThis,
  onStartCorrecting,
  onCancelCorrecting,
  onValidate,
  onCorrect,
  onArchive,
}: {
  track: InboxTrack;
  playlists: InboxPlaylist[];
  playlistsLoading: boolean;
  isExiting: boolean;
  isBusy: boolean;
  isCorrectingThis: boolean;
  isReasonExpanded: boolean;
  onStartCorrecting: () => void;
  onCancelCorrecting: () => void;
  onToggleReason: () => void;
  onValidate: () => void;
  onCorrect: (ids: string[]) => void;
  onArchive: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const conf = track.confidence !== null ? Math.round(track.confidence * 100) : null;
  const hasSuggestion = !!track.llm_suggestion_id && !!track.suggested_playlist;
  const borderColor = track.is_unclassified
    ? "rgba(136,120,208,0.35)"
    : hasSuggestion
    ? "rgba(200,147,90,0.35)"
    : "rgba(255,255,255,0.07)";

  const player = (
    <iframe
      title="spotify-embed"
      src={`https://open.spotify.com/embed/track/${track.spotify_track_id}?utm_source=sortify`}
      width="100%"
      height="80"
      frameBorder="0"
      loading="lazy"
      allow="encrypted-media; clipboard-write"
      style={{ borderRadius: 12, display: "block", colorScheme: "normal" }}
    />
  );

  return (
    <li
      className="s-track-card"
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${borderColor}`,
        padding: "14px 18px 14px 16px",
        boxShadow: "var(--shadow)",
        transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(48px) scale(0.96)" : "none",
      }}
    >
      {/* Header — titre + badge top-right */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, margin: 0 }}>
            {track.name ?? track.spotify_track_id}
          </p>
          {track.artist_name && (
            <p style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-mid)", marginTop: 2, margin: 0 }}>{track.artist_name}</p>
          )}
          {track.album_name && (
            <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 1, margin: 0 }}>({track.album_name})</p>
          )}
        </div>
        {/* Badge */}
        <div style={{ flexShrink: 0 }}>
          {track.is_unclassified ? (
            <span style={{
              fontSize: 10, fontWeight: 500, color: "#8878d0",
              background: "rgba(136,120,208,0.12)", border: "1px solid rgba(136,120,208,0.28)",
              padding: "3px 9px", borderRadius: 20, letterSpacing: "0.02em",
            }}>
              À classer
            </span>
          ) : hasSuggestion ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 500, color: "#c8935a",
              background: "rgba(200,147,90,0.12)", border: "1px solid rgba(200,147,90,0.28)",
              padding: "3px 10px", borderRadius: 20,
            }}>
              {track.suggested_playlist}
              {conf !== null && <span style={{ opacity: 0.75 }}>· {conf}%</span>}
            </span>
          ) : (
            <span style={{
              fontSize: 10, fontWeight: 500, color: "var(--ink-dimmer)",
              background: "var(--surface3)", border: "1px solid var(--border)",
              padding: "3px 9px", borderRadius: 20, letterSpacing: "0.02em",
            }}>
              Aucun signal
            </span>
          )}
        </div>
      </div>

      {/* Genres */}
      {track.genres.length > 0 && (
        <div className="s-track-card-genres" style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          {track.genres.slice(0, 4).map((g) => {
            const pal = genrePalette(g);
            return (
              <span key={g} style={{ background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 500, color: pal.color }}>
                {g}
              </span>
            );
          })}
          {track.enrichment_source && (
            <span style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "var(--ink-mid)" }}>
              {track.enrichment_source}
            </span>
          )}
        </div>
      )}

      {/* Raison LLM — texte complet, pas de truncate */}
      {track.classification_reason && (
        <div className="s-track-card-reason" style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--ink)", marginBottom: 10, lineHeight: 1.65 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mid)", display: "block", marginBottom: 3 }}>Raison</span>
          {track.classification_reason}
        </div>
      )}

      {/* Suggestion encart */}
      {hasSuggestion && (
        <div className="s-track-card-suggest" style={{ background: "var(--surface2)", border: "1px solid rgba(200,147,90,0.18)", borderRadius: 6, padding: "7px 12px", marginBottom: 10, fontSize: 13, fontWeight: 500, color: "#c8935a" }}>
          → {track.suggested_playlist}
        </div>
      )}

      {/* Body — deux colonnes sur desktop, en premier sur mobile */}
      {!isCorrectingThis ? (
        <div className="s-track-card-body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Player — left column */}
          <div style={{ flex: 1, minWidth: 0 }}>{player}</div>

          {/* Buttons — right column, empilés verticalement */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, width: 120 }}>
            {hasSuggestion && (
              <button
                disabled={isBusy}
                onClick={onValidate}
                className="s-btn s-btn-primary"
                style={{ minHeight: 36, width: "100%", justifyContent: "center" }}
              >
                {isBusy ? "…" : "Valider"}
              </button>
            )}
            <button
              disabled={isBusy}
              onClick={onStartCorrecting}
              className="s-btn"
              style={{ minHeight: 36, width: "100%", justifyContent: "center" }}
            >
              Changer
            </button>
            <button
              disabled={isBusy}
              onClick={onArchive}
              className="s-btn"
              title="Archiver"
              style={{ minHeight: 36, width: "100%", justifyContent: "center", color: "var(--ink-dim)" }}
            >
              ⊘
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", minHeight: 40 }}>
            {playlistsLoading ? (
              <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: "6px 0" }}>Chargement des playlists…</p>
            ) : playlists.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: "6px 0" }}>Aucune playlist configurée</p>
            ) : playlists.map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={(e) =>
                    setSelectedIds((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id))
                  }
                  style={{ accentColor: "var(--terra)" }}
                />
                <span style={{ color: selectedIds.includes(p.id) ? "var(--ink)" : "var(--ink-mid)" }}>{p.name}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={isBusy || selectedIds.length === 0}
              onClick={() => onCorrect(selectedIds)}
              className="s-btn s-btn-primary"
              style={{ flex: 1 }}
            >
              {isBusy ? "…" : `Assigner (${selectedIds.length})`}
            </button>
            <button disabled={isBusy} onClick={onCancelCorrecting} className="s-btn" aria-label="Annuler">↩</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function InboxClient() {
  const [tracks, setTracks] = useState<InboxTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filterPlaylistId, setFilterPlaylistId] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const maxConfidence = CONFIDENCE_THRESHOLDS[confidenceFilter];

  const [playlists, setPlaylists] = useState<InboxPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  const [correcting, setCorrecting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const prevTotalRef = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  // Confetti quand l'inbox se vide
  useEffect(() => {
    if (loading) return;
    if (prevTotalRef.current !== null && prevTotalRef.current > 0 && total === 0) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1600);
    }
    prevTotalRef.current = total;
  }, [total, loading]);

  const fetchPlaylists = useCallback(() => {
    setPlaylistsLoading(true);
    fetch("/api/playlists")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: InboxPlaylist[]) => {
        if (Array.isArray(data)) setPlaylists(data);
      })
      .catch(() => {})
      .finally(() => setPlaylistsLoading(false));
  }, []);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBatchMessage(null);

    const params = buildParams(1, filterPlaylistId, maxConfidence);
    fetch(`/api/inbox?${params}`)
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        setTracks(data.tracks);
        setTotal(data.total);
        setCurrentPage(1);
        setHasMore(data.total > data.tracks.length);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filterPlaylistId, maxConfidence]);

  function buildParams(page: number, pId: string, maxConf: number): URLSearchParams {
    const p = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (pId) p.set("playlist_id", pId);
    if (maxConf < 1.0) p.set("max_confidence", String(maxConf));
    return p;
  }

  function exitTrack(id: string) {
    setExiting((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      setExiting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 300);
  }

  async function handleAction(
    trackId: string,
    action: "validate" | "correct" | "archive",
    playlistIds?: string[]
  ) {
    setBusy((prev) => new Set([...prev, trackId]));
    try {
      const body: Record<string, unknown> = { action };
      if (playlistIds) body.playlist_ids = playlistIds;
      const res = await fetch(`/api/inbox/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setCorrecting((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
      exitTrack(trackId);
    } catch (err) {
      showToast(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    const params = buildParams(nextPage, filterPlaylistId, maxConfidence);
    try {
      const res = await fetch(`/api/inbox?${params}`);
      const data: ApiResponse = await res.json();
      setTracks((prev) => [...prev, ...data.tracks]);
      setCurrentPage(nextPage);
      setHasMore(data.total > nextPage * data.per_page);
    } catch {
      // keep current state
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleBatchValidate() {
    if (!window.confirm("Valider tous les tracks avec confidence ≥ 55% ?")) return;
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const res = await fetch("/api/inbox/batch-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_confidence: 0.55 }),
      });
      const data = await res.json() as { validated: number; errors: string[] };
      setBatchMessage(`${data.validated} track${data.validated !== 1 ? "s" : ""} validé${data.validated !== 1 ? "s" : ""}`);
      const params = buildParams(1, filterPlaylistId, maxConfidence);
      const fresh = await fetch(`/api/inbox?${params}`).then((r) => r.json()) as ApiResponse;
      setTracks(fresh.tracks);
      setTotal(fresh.total);
      setCurrentPage(1);
      setHasMore(fresh.total > fresh.tracks.length);
    } catch (err) {
      showToast(`Erreur batch : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <main className="s-page">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="s-inbox-page-header">
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>Inbox</div>
            <h1 className="font-fraunces" style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.6px", color: "var(--ink)", lineHeight: 1 }}>
              {loading ? (
                <span style={{ color: "var(--ink-dimmer)" }}>—</span>
              ) : (
                <>
                  <span style={{ color: "var(--terra)" }}>{total}</span>
                  <span style={{ fontSize: 16, fontWeight: 400, color: "var(--ink-mid)", marginLeft: 8 }}>
                    {total !== 1 ? "tracks" : "track"} à revoir
                  </span>
                </>
              )}
            </h1>
          </div>
          <button
            onClick={handleBatchValidate}
            disabled={batchLoading || total === 0 || loading}
            className="s-btn s-btn-primary"
          >
            {batchLoading ? "…" : "Tout valider (+55%)"}
          </button>
        </div>

        {/* Filters */}
        <div className="s-filter-bar">
          <div className="s-filter-chips">
            {([
              { key: "all", label: "Tous" },
              { key: "uncertain", label: "Incertains (<55%)" },
              { key: "very_uncertain", label: "Très incertains (<40%)" },
            ] as { key: ConfidenceFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`s-chip${confidenceFilter === key ? " active" : ""}`}
                onClick={() => setConfidenceFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="s-filter-sep" />
          <select
            value={filterPlaylistId}
            onChange={(e) => setFilterPlaylistId(e.target.value)}
            className="s-sort-select"
            aria-label="Filtrer par playlist"
          >
            <option value="">Toutes les playlists</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {batchMessage && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--sage)" }}>{batchMessage}</p>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-dim)", fontSize: 13 }}>
          Chargement…
        </div>
      ) : tracks.length === 0 ? (
        <div style={{ display: "flex", minHeight: 200, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Inbox vide</p>
          <p style={{ fontSize: 12, color: "var(--ink-mid)" }}>Tout est trié ✓</p>
        </div>
      ) : (
        <>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                playlists={playlists}
                playlistsLoading={playlistsLoading}
                isExiting={exiting.has(track.id)}
                isBusy={busy.has(track.id)}
                isCorrectingThis={correcting.has(track.id)}
                isReasonExpanded={expandedReasons.has(track.id)}
                onStartCorrecting={() =>
                  setCorrecting((prev) => new Set([...prev, track.id]))
                }
                onCancelCorrecting={() =>
                  setCorrecting((prev) => { const n = new Set(prev); n.delete(track.id); return n; })
                }
                onToggleReason={() =>
                  setExpandedReasons((prev) => {
                    const n = new Set(prev);
                    n.has(track.id) ? n.delete(track.id) : n.add(track.id);
                    return n;
                  })
                }
                onValidate={() => handleAction(track.id, "validate")}
                onCorrect={(ids) => handleAction(track.id, "correct", ids)}
                onArchive={() => handleAction(track.id, "archive")}
              />
            ))}
          </ul>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="s-btn"
              style={{ width: "100%", marginTop: 20, padding: "10px 0", justifyContent: "center" }}
            >
              {loadingMore ? "Chargement…" : "Charger plus"}
            </button>
          )}
        </>
      )}

      {toast && <div className="s-toast">{toast}</div>}
      {confetti && <Confetti />}
    </main>
  );
}
