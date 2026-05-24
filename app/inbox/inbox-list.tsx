"use client";

import { useState, useEffect } from "react";

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
  deezer_id: string | null;
}

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
  const accentColor = hasSuggestion ? "#c8935a" : "var(--ink-dimmer)";
  const borderColor = hasSuggestion ? "rgba(200,147,90,0.35)" : "rgba(255,255,255,0.07)";

  const player = track.deezer_id ? (
    <iframe
      title="deezer-widget"
      src={`https://widget.deezer.com/widget/dark/track/${track.deezer_id}`}
      width="100%"
      height="80"
      frameBorder="0"
      allow="encrypted-media"
      style={{ borderRadius: 8, display: "block" }}
    />
  ) : (
    <a
      href={`https://open.spotify.com/track/${track.spotify_track_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="s-btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
    >
      Ouvrir dans Spotify ↗
    </a>
  );

  return (
    <li
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${borderColor}`,
        padding: "14px 18px 14px 16px",
        boxShadow: "var(--shadow)",
        transition: "opacity 0.3s, transform 0.3s",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "scale(0.97)" : "scale(1)",
      }}
    >
      {/* Header — titre + badge top-right */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, margin: 0 }}>
            {track.name ?? track.spotify_track_id}
          </p>
          {track.artist_name && (
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2, margin: 0 }}>{track.artist_name}</p>
          )}
          {track.album_name && (
            <p style={{ fontSize: 10, color: "var(--ink-dimmer)", marginTop: 1, margin: 0 }}>({track.album_name})</p>
          )}
        </div>
        {/* Badge */}
        <div style={{ flexShrink: 0 }}>
          {hasSuggestion ? (
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          {track.genres.slice(0, 4).map((g) => {
            const pal = genrePalette(g);
            return (
              <span key={g} style={{ background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: pal.color }}>
                {g}
              </span>
            );
          })}
          {track.enrichment_source && (
            <span style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "var(--ink-dim)" }}>
              {track.enrichment_source}
            </span>
          )}
        </div>
      )}

      {/* Raison LLM — texte complet, pas de truncate */}
      {track.classification_reason && (
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--ink-mid)", marginBottom: 10, lineHeight: 1.6 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-dim)", display: "block", marginBottom: 3 }}>Raison</span>
          {track.classification_reason}
        </div>
      )}

      {/* Suggestion encart */}
      {hasSuggestion && (
        <div style={{ background: "var(--surface2)", border: "1px solid rgba(200,147,90,0.18)", borderRadius: 6, padding: "7px 12px", marginBottom: 10, fontSize: 12, color: "#c8935a" }}>
          → {track.suggested_playlist}
        </div>
      )}

      {/* Body — deux colonnes sur desktop */}
      {!isCorrectingThis ? (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
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
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
            {playlists.map((p) => (
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
  const [sliderValue, setSliderValue] = useState(1.0);
  const [maxConfidence, setMaxConfidence] = useState(1.0);

  const [playlists, setPlaylists] = useState<InboxPlaylist[]>([]);

  const [correcting, setCorrecting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => r.json())
      .then((data: InboxPlaylist[]) => setPlaylists(data))
      .catch(() => {});
  }, []);

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
      alert(`Erreur : ${String(err)}`);
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
      alert(`Erreur batch : ${String(err)}`);
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
            <h1 className="font-fraunces" style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1 }}>
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={filterPlaylistId}
            onChange={(e) => setFilterPlaylistId(e.target.value)}
            className="s-input"
          >
            <option value="">Toutes les playlists</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 11, color: "var(--ink-dim)", flexShrink: 0 }}>
              Max : {sliderValue < 1.0 ? `${Math.round(sliderValue * 100)}%` : "tous"}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sliderValue}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              onMouseUp={(e) => setMaxConfidence(parseFloat((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => setMaxConfidence(parseFloat((e.target as HTMLInputElement).value))}
              style={{ flex: 1, accentColor: "var(--terra)" }}
            />
          </div>
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
          <p style={{ fontSize: 13, color: "var(--ink-mid)" }}>Inbox vide</p>
          <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>Tout est trié ✓</p>
        </div>
      ) : (
        <>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                playlists={playlists}
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
    </main>
  );
}
