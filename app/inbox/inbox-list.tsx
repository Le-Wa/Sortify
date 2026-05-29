"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { playlistSwatch } from "@/lib/playlist-swatch";

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

// ── Types ─────────────────────────────────────────────────────────────────────

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
  color: string | null;
  genre_includes: string[];
}

interface ApiResponse {
  tracks: InboxTrack[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pillVars(color: string): React.CSSProperties {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return {
    "--plbg": `rgba(${r},${g},${b},0.08)`,
    "--plb": color,
    "--plt": color,
    "--plts": "rgba(255,255,255,0.88)",
  } as React.CSSProperties;
}

function confBadge(conf: number | null): { cls: string; label: string } {
  if (conf === null) return { cls: "s-conf-none", label: "Aucun signal" };
  if (conf < 40) return { cls: "s-conf-vlow", label: `${conf}%` };
  return { cls: "s-conf-low", label: `${conf}%` };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlaylistPill({
  playlist,
  selected,
  isAI,
  onToggle,
}: {
  playlist: InboxPlaylist;
  selected: boolean;
  isAI: boolean;
  onToggle: () => void;
}) {
  const color = playlistSwatch(playlist.id, playlist.color);
  return (
    <button
      type="button"
      className={`s-pl-pill${selected ? " sel" : ""}`}
      style={pillVars(color)}
      onClick={onToggle}
    >
      <span className="pp-dot" />
      <span className="pp-name">{playlist.name}</span>
      {isAI && <span className="pp-ai">IA</span>}
    </button>
  );
}

function PlaylistCardSm({
  playlist,
  selected,
  onToggle,
}: {
  playlist: InboxPlaylist;
  selected: boolean;
  onToggle: () => void;
}) {
  const color = playlistSwatch(playlist.id, playlist.color);
  return (
    <button
      type="button"
      className={`s-pl-card-sm${selected ? " sel" : ""}`}
      style={pillVars(color)}
      onClick={onToggle}
    >
      <span className="pc-dot" />
      <span className="pc-name">{playlist.name}</span>
    </button>
  );
}

// ── TrackCard ─────────────────────────────────────────────────────────────────

function TrackCard({
  track,
  playlists,
  isExiting,
  isBusy,
  animDelay,
  onAssign,
  onArchive,
}: {
  track: InboxTrack;
  playlists: InboxPlaylist[];
  isExiting: boolean;
  isBusy: boolean;
  animDelay: number;
  onAssign: (ids: string[]) => void;
  onArchive: () => void;
}) {
  const [showReason, setShowReason] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (track.llm_suggestion_id) s.add(track.llm_suggestion_id);
    return s;
  });

  const conf = track.confidence !== null ? Math.round(track.confidence * 100) : null;
  const badge = confBadge(conf);
  const selCount = selectedIds.size;

  const suggestionId = track.llm_suggestion_id;
  const suggestedPlaylists = suggestionId ? playlists.filter((p) => p.id === suggestionId) : [];
  const otherPlaylists = playlists.filter((p) => p.id !== suggestionId);

  // For unclassified tracks: rank by genre overlap (L1 heuristic)
  const rankedOthers = suggestionId
    ? otherPlaylists
    : [...playlists].sort((a, b) => {
        const scoreA = track.genres.filter((g) =>
          a.genre_includes.some((gi) => g.toLowerCase().includes(gi.toLowerCase()) || gi.toLowerCase().includes(g.toLowerCase()))
        ).length;
        const scoreB = track.genres.filter((g) =>
          b.genre_includes.some((gi) => g.toLowerCase().includes(gi.toLowerCase()) || gi.toLowerCase().includes(g.toLowerCase()))
        ).length;
        return scoreB - scoreA;
      });

  const primaryPills = suggestedPlaylists.length > 0 ? suggestedPlaylists : rankedOthers.slice(0, 2);
  const expandPills = suggestedPlaylists.length > 0 ? otherPlaylists : rankedOthers.slice(2);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const reason = track.classification_reason?.startsWith("L3 error:")
    ? null
    : track.classification_reason;

  return (
    <li
      className="s-inbox-track-card"
      style={{
        animation: `s-slide-in 0.25s ${animDelay}ms ease forwards`,
        opacity: isExiting ? 0 : undefined,
        transform: isExiting ? "translateX(48px) scale(0.96)" : undefined,
        transition: isExiting ? "opacity 0.35s ease, transform 0.35s ease" : undefined,
      }}
    >
      {/* Main row */}
      <div className="itc-main">
        <div className="itc-info">
          <p className="itc-title">{track.name ?? track.spotify_track_id}</p>
          <p className="itc-sub">
            {track.artist_name}
            {track.album_name ? ` · ${track.album_name}` : ""}
          </p>
        </div>
        <div className="itc-right">
          <span className={`s-conf-badge ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      {/* Player embed — always visible */}
      <div className="itc-player-wrap">
        <iframe
          title="spotify-embed"
          src={`https://open.spotify.com/embed/track/${track.spotify_track_id}?utm_source=sortify`}
          width="100%"
          height="80"
          frameBorder="0"
          loading="lazy"
          allow="encrypted-media; clipboard-write"
          style={{ borderRadius: 10, display: "block", colorScheme: "normal" }}
        />
      </div>

      {/* Genre tags */}
      {track.genres.length > 0 && (
        <div className="itc-tags">
          {track.genres.slice(0, 4).map((g) => (
            <span key={g} className="itc-tag">{g}</span>
          ))}
        </div>
      )}

      {/* Playlist pills */}
      {playlists.length > 0 && (
        <>
          <div className="itc-pl-row">
            {primaryPills.map((p) => (
              <PlaylistPill
                key={p.id}
                playlist={p}
                selected={selectedIds.has(p.id)}
                isAI={p.id === suggestionId}
                onToggle={() => toggle(p.id)}
              />
            ))}
            {expandPills.length > 0 && (
              <button
                type="button"
                className="s-more-pl-btn"
                onClick={() => setShowMore((v) => !v)}
              >
                +{expandPills.length}{" "}
                <span style={{ fontSize: 9, marginLeft: 1 }}>{showMore ? "▴" : "▾"}</span>
              </button>
            )}
          </div>

          {showMore && (
            <div className="itc-pl-expand">
              {expandPills.map((p) => (
                <PlaylistCardSm
                  key={p.id}
                  playlist={p}
                  selected={selectedIds.has(p.id)}
                  onToggle={() => toggle(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Reason toggle — always visible */}
      <div className="itc-action-row">
        <button
          type="button"
          className={`s-action-chip${showReason ? " on" : ""}`}
          onClick={() => setShowReason((v) => !v)}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          Raison IA
        </button>
      </div>
      {showReason && (
        <div className="itc-reason">
          {reason ?? <span style={{ color: "var(--ink-dimmer)", fontStyle: "italic" }}>Aucune raison disponible</span>}
        </div>
      )}

      {/* Separator + actions */}
      <div className="itc-sep" />
      <div className="itc-actions">
        <button
          type="button"
          className={`s-assign-btn${selCount > 0 ? " ready" : ""}`}
          disabled={isBusy || selCount === 0}
          onClick={() => onAssign([...selectedIds])}
        >
          {isBusy
            ? "…"
            : selCount === 0
            ? "Assigner"
            : `Assigner (${selCount} playlist${selCount > 1 ? "s" : ""})`}
        </button>
        <button
          type="button"
          className="s-icon-btn"
          disabled={isBusy}
          onClick={onArchive}
          title="Archiver"
          aria-label="Archiver"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
          </svg>
        </button>
      </div>
    </li>
  );
}

// ── PlaylistDropdown ──────────────────────────────────────────────────────────

function PlaylistDropdown({
  playlists,
  value,
  onChange,
}: {
  playlists: InboxPlaylist[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const selected = playlists.find((p) => p.id === value);
  const label = selected ? selected.name : "Toutes les playlists";

  return (
    <div className="s-pl-dropdown-wrap" ref={ref}>
      <button
        type="button"
        className="s-pl-dropdown-btn"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <svg
          className={`s-pl-dropdown-arrow${open ? " open" : ""}`}
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <polyline points="4 6 8 10 12 6" transform="translate(4 4)" />
        </svg>
      </button>

      {open && (
        <div className="s-pl-dropdown-menu">
          <button
            type="button"
            className={`s-pl-dropdown-item${!value ? " active" : ""}`}
            onClick={() => { onChange(""); setOpen(false); }}
          >
            <span className="s-pl-dropdown-dot" style={{ background: "var(--ink-dimmer)" }} />
            Toutes les playlists
          </button>
          {playlists.map((p) => {
            const color = playlistSwatch(p.id, p.color);
            return (
              <button
                key={p.id}
                type="button"
                className={`s-pl-dropdown-item${value === p.id ? " active" : ""}`}
                onClick={() => { onChange(p.id); setOpen(false); }}
              >
                <span className="s-pl-dropdown-dot" style={{ background: color }} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── InboxClient ───────────────────────────────────────────────────────────────

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

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const prevTotalRef = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

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
      .then((data: Array<InboxPlaylist & { rules?: { genres?: { include?: string[] } } }>) => {
        if (Array.isArray(data)) {
          setPlaylists(data.map((p) => ({
            ...p,
            genre_includes: p.rules?.genres?.include ?? [],
          })));
        }
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

  function notifyInboxChanged() {
    window.dispatchEvent(new Event("sortify:inbox-changed"));
  }

  function exitTrack(id: string) {
    setExiting((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      setExiting((prev) => { const n = new Set(prev); n.delete(id); return n; });
      notifyInboxChanged();
    }, 350);
  }

  async function handleAssign(trackId: string, playlistIds: string[]) {
    setBusy((prev) => new Set([...prev, trackId]));
    try {
      const track = tracks.find((t) => t.id === trackId);
      const isSuggestionOnly =
        playlistIds.length === 1 && playlistIds[0] === track?.llm_suggestion_id;
      const body: Record<string, unknown> = isSuggestionOnly
        ? { action: "validate" }
        : { action: "correct", playlist_ids: playlistIds };

      const res = await fetch(`/api/inbox/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      exitTrack(trackId);
    } catch (err) {
      showToast(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
    }
  }

  async function handleArchive(trackId: string) {
    setBusy((prev) => new Set([...prev, trackId]));
    try {
      const res = await fetch(`/api/inbox/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) throw new Error(await res.text());
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
      notifyInboxChanged();
    } catch (err) {
      showToast(`Erreur batch : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <main className="s-page">
      {/* Hero header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "var(--ink-dimmer)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
          Inbox
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
          <span className={`inbox-hero-num${total === 0 && !loading ? " zero" : ""} font-fraunces`}>
            {loading ? "—" : total}
          </span>
          <span style={{ fontSize: 15, color: "var(--ink-mid)" }}>
            {total !== 1 ? "tracks à revoir" : "track à revoir"}
          </span>
        </div>
        {total > 0 && !loading && (
          <button
            onClick={handleBatchValidate}
            disabled={batchLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--terra)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: 99,
              border: "none",
              cursor: "pointer",
              marginBottom: 16,
              opacity: batchLoading ? 0.6 : 1,
              fontFamily: "inherit",
            }}
          >
            {batchLoading ? "…" : "Tout valider (+55%)"}
          </button>
        )}
      </div>

      {/* Confidence filters */}
      <div className="s-filter-chips" style={{ marginBottom: 12 }}>
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

      {/* Playlist filter dropdown */}
      {!playlistsLoading && playlists.length > 0 && (
        <PlaylistDropdown
          playlists={playlists}
          value={filterPlaylistId}
          onChange={setFilterPlaylistId}
        />
      )}

      {batchMessage && (
        <p style={{ marginBottom: 12, fontSize: 12, color: "var(--sage)" }}>{batchMessage}</p>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-dim)", fontSize: 13 }}>
          Chargement…
        </div>
      ) : tracks.length === 0 ? (
        <div style={{ display: "flex", minHeight: 200, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: 52, color: "var(--ink-dimmer)", margin: 0 }}>✓</p>
          <p style={{ fontSize: 15, color: "var(--ink-mid)", margin: 0 }}>Inbox vide — tout est classé.</p>
        </div>
      ) : (
        <>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {tracks.map((track, idx) => (
              <TrackCard
                key={track.id}
                track={track}
                playlists={playlists}
                isExiting={exiting.has(track.id)}
                isBusy={busy.has(track.id)}
                animDelay={idx * 60}
                onAssign={(ids) => handleAssign(track.id, ids)}
                onArchive={() => handleArchive(track.id)}
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
