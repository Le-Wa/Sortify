"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const GENRE_PALETTES = [
  { bg: "var(--sage-light)",      color: "var(--sage)",   border: "var(--sage-border)" },
  { bg: "var(--amber-light)",     color: "var(--amber)",  border: "rgba(216,170,66,0.28)" },
  { bg: "var(--terra-light)",     color: "var(--terra)",  border: "var(--terra-border)" },
  { bg: "rgba(136,120,208,0.13)", color: "#8878d0",       border: "rgba(136,120,208,0.26)" },
  { bg: "rgba(80,148,108,0.13)",  color: "#4e9468",       border: "rgba(80,148,108,0.24)" },
  { bg: "rgba(192,112,80,0.13)",  color: "#c07050",       border: "rgba(192,112,80,0.24)" },
  { bg: "rgba(120,120,180,0.13)", color: "#7878b4",       border: "rgba(120,120,180,0.24)" },
  { bg: "rgba(168,128,60,0.13)",  color: "#a8803c",       border: "rgba(168,128,60,0.24)" },
];
function genrePalette(genre: string) {
  let h = 0;
  for (const c of genre) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return GENRE_PALETTES[h % GENRE_PALETTES.length];
}

const SWATCH_COLORS = ["#c89840","#8878d0","#6a9070","#c87a52","#a06848","#508860","#7878b0","#c08060"];
function playlistSwatch(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return SWATCH_COLORS[h % SWATCH_COLORS.length];
}

interface PlaylistInfo {
  id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
}

interface PlaylistTrack {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artist_name: string | null;
  album_name: string | null;
  spotify_added_at: string | null;
  genres: string[];
  classification_level: number | null;
  confidence: number | null;
  pushed_to_spotify: string | null;
}

interface ApiResponse {
  playlist: PlaylistInfo;
  tracks: PlaylistTrack[];
  total: number;
  synced: number;
  not_synced: number;
  per_page: number;
}

type FilterValue = "all" | "synced" | "not_synced";
type SortValue = "default" | "name" | "confidence";

const PER_PAGE = 50;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function levelLabel(level: number | null): string {
  if (level === 1) return "L1";
  if (level === 2) return "L2";
  if (level === 3) return "LLM";
  return "—";
}

export default function PlaylistDetailClient({ playlistId }: { playlistId: string }) {
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [synced, setSynced] = useState(0);
  const [notSynced, setNotSynced] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("default");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/playlists/${playlistId}/tracks?page=1&per_page=${PER_PAGE}`)
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        setPlaylist(data.playlist);
        setTracks(data.tracks);
        setTotal(data.total);
        setSynced(data.synced);
        setNotSynced(data.not_synced);
        setHasMore(data.total > data.tracks.length);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(
        `/api/playlists/${playlistId}/tracks?page=${nextPage}&per_page=${PER_PAGE}`
      );
      const data: ApiResponse = await res.json();
      setTracks((prev) => [...prev, ...data.tracks]);
      setPage(nextPage);
      setHasMore(data.total > nextPage * data.per_page);
    } catch {
      // keep current state
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/sync`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { synced: number; errors: string[] };
      setSynced((prev) => prev + data.synced);
      setNotSynced((prev) => Math.max(0, prev - data.synced));
      if (data.synced > 0) {
        setTracks((prev) =>
          prev.map((t) =>
            t.pushed_to_spotify === null
              ? { ...t, pushed_to_spotify: new Date().toISOString() }
              : t
          )
        );
      }
    } catch (err) {
      alert(`Erreur sync : ${String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  const displayedTracks = useMemo(() => {
    let arr = tracks;
    if (filter === "synced") arr = arr.filter((t) => t.pushed_to_spotify !== null);
    else if (filter === "not_synced") arr = arr.filter((t) => t.pushed_to_spotify === null);
    if (sort === "name") arr = [...arr].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr"));
    else if (sort === "confidence") arr = [...arr].sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
    return arr;
  }, [tracks, filter, sort]);

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-dim)", fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-mid)", fontSize: 13 }}>
        Playlist introuvable
      </div>
    );
  }

  return (
    <main className="s-page">
      {/* Breadcrumb */}
      <Link
        href="/playlists"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-dim)", textDecoration: "none", marginBottom: 20 }}
      >
        ← Playlists
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="s-page-header">
          <div style={{ minWidth: 0 }}>
            <h1
              className="font-fraunces s-page-h1"
              style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.8px", color: playlistSwatch(playlist.id), lineHeight: 1.05 }}
            >
              {playlist.name}
            </h1>
            {playlist.description && (
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-dim)" }}>{playlist.description}</p>
            )}
          </div>
          {notSynced > 0 && (
            <button
              disabled={syncing}
              onClick={handleSync}
              className="s-btn s-btn-primary"
              style={{ flexShrink: 0 }}
            >
              {syncing ? "…" : `Sync (${notSynced})`}
            </button>
          )}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 12, color: "var(--ink-dim)" }}>
          <span style={{ color: "var(--ink-mid)" }}>{total} tracks</span>
          <span>{synced} synced</span>
          {notSynced > 0 && (
            <span style={{ color: "var(--terra)" }}>{notSynced} non synced</span>
          )}
        </div>
      </div>

      {/* Filter + sort bar */}
      <div className="s-filter-bar">
        <div className="s-filter-chips">
          <button
            className={`s-chip${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tous ({total})
          </button>
          <button
            className={`s-chip${filter === "synced" ? " active" : ""}`}
            onClick={() => setFilter("synced")}
          >
            Syncés ({synced})
          </button>
          <button
            className={`s-chip${filter === "not_synced" ? " active" : ""}`}
            onClick={() => setFilter("not_synced")}
          >
            Non syncés ({notSynced})
          </button>
        </div>
        <div className="s-filter-sep" />
        <select
          className="s-sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          aria-label="Trier par"
        >
          <option value="default">Ordre par défaut</option>
          <option value="name">Nom A→Z</option>
          <option value="confidence">Confiance ↓</option>
        </select>
      </div>

      {/* Track list */}
      {displayedTracks.length === 0 ? (
        <div style={{ display: "flex", minHeight: 160, alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", fontSize: 13, color: "var(--ink-mid)" }}>
          {filter !== "all" ? "Aucun track pour ce filtre" : "Aucun track dans cette playlist"}
        </div>
      ) : (
        <>
          <div className="s-table-wrap"><table className="s-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Track</th>
                <th>Genres</th>
                <th style={{ textAlign: "right" }}>Conf.</th>
                <th style={{ textAlign: "right" }}>Sync</th>
              </tr>
            </thead>
            <tbody>
              {displayedTracks.map((track) => (
                <tr key={track.id}>
                  <td>
                    <p style={{ fontWeight: 500, fontSize: 13 }}>
                      {track.artist_name && (
                        <span style={{ fontWeight: 300, color: "var(--ink-mid)" }}>
                          {track.artist_name} —{" "}
                        </span>
                      )}
                      {track.name ?? track.spotify_track_id}
                    </p>
                    <p style={{ marginTop: 2, fontSize: 10, color: "var(--ink-dim)" }}>
                      {formatDate(track.spotify_added_at)}
                      {track.classification_level !== null && (
                        <span style={{ marginLeft: 6, color: "var(--ink-dimmer)" }}>
                          {levelLabel(track.classification_level)}
                        </span>
                      )}
                    </p>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {track.genres.slice(0, 2).map((g) => {
                        const pal = genrePalette(g);
                        return (
                          <span
                            key={g}
                            style={{ background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6, padding: "1px 7px", fontSize: 10, color: pal.color }}
                          >
                            {g}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {track.confidence !== null ? (
                      <span
                        style={{
                          display: "inline-block",
                          borderRadius: 20,
                          padding: "2px 8px",
                          fontSize: 10,
                          fontWeight: 500,
                          background: track.confidence >= 0.55 ? "var(--sage-light)" : track.confidence >= 0.4 ? "var(--amber-light)" : "var(--terra-light)",
                          color: track.confidence >= 0.55 ? "var(--sage)" : track.confidence >= 0.4 ? "var(--amber)" : "var(--terra)",
                        }}
                      >
                        {Math.round(track.confidence * 100)}%
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-dimmer)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {track.pushed_to_spotify ? (
                      <span style={{ fontSize: 12, color: "var(--sage)" }}>✓</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--terra)" }}>○</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {hasMore && filter === "all" && sort === "default" && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="s-btn"
              style={{ width: "100%", marginTop: 16, padding: "10px 0", justifyContent: "center" }}
            >
              {loadingMore ? "Chargement…" : "Charger plus"}
            </button>
          )}
          {hasMore && (filter !== "all" || sort !== "default") && (
            <p style={{ marginTop: 12, fontSize: 11, color: "var(--ink-dim)", textAlign: "center" }}>
              {total - tracks.length} tracks non chargés · réinitialiser le filtre pour voir tout
            </p>
          )}
        </>
      )}
    </main>
  );
}
