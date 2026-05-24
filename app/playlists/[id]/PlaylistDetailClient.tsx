"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { playlistSwatch } from "@/lib/playlist-swatch";

// ── Palette genre (24 couleurs) ───────────────────────────────────────────────

const GENRE_PALETTES = [
  { bg: "rgba(212,90,80,0.13)",   color: "#d45a50",  border: "rgba(212,90,80,0.26)" },
  { bg: "rgba(210,110,70,0.13)",  color: "#d26e46",  border: "rgba(210,110,70,0.26)" },
  { bg: "rgba(204,128,85,0.13)",  color: "#cc8055",  border: "rgba(204,128,85,0.26)" },
  { bg: "rgba(200,152,60,0.13)",  color: "#c8983c",  border: "rgba(200,152,60,0.26)" },
  { bg: "rgba(192,170,56,0.13)",  color: "#c0aa38",  border: "rgba(192,170,56,0.26)" },
  { bg: "rgba(140,180,70,0.13)",  color: "#8cb446",  border: "rgba(140,180,70,0.26)" },
  { bg: "rgba(100,170,90,0.13)",  color: "#64aa5a",  border: "rgba(100,170,90,0.26)" },
  { bg: "rgba(110,152,122,0.13)", color: "#6e987a",  border: "rgba(110,152,122,0.26)" },
  { bg: "rgba(70,148,100,0.13)",  color: "#469464",  border: "rgba(70,148,100,0.26)" },
  { bg: "rgba(60,148,140,0.13)",  color: "#3c948c",  border: "rgba(60,148,140,0.26)" },
  { bg: "rgba(60,130,160,0.13)",  color: "#3c82a0",  border: "rgba(60,130,160,0.26)" },
  { bg: "rgba(70,110,190,0.13)",  color: "#466ebe",  border: "rgba(70,110,190,0.26)" },
  { bg: "rgba(90,100,210,0.13)",  color: "#5a64d2",  border: "rgba(90,100,210,0.26)" },
  { bg: "rgba(120,90,210,0.13)",  color: "#785ad2",  border: "rgba(120,90,210,0.26)" },
  { bg: "rgba(136,120,208,0.13)", color: "#8878d0",  border: "rgba(136,120,208,0.26)" },
  { bg: "rgba(155,100,200,0.13)", color: "#9b64c8",  border: "rgba(155,100,200,0.26)" },
  { bg: "rgba(170,90,180,0.13)",  color: "#aa5ab4",  border: "rgba(170,90,180,0.26)" },
  { bg: "rgba(190,80,150,0.13)",  color: "#be5096",  border: "rgba(190,80,150,0.26)" },
  { bg: "rgba(200,80,120,0.13)",  color: "#c85078",  border: "rgba(200,80,120,0.26)" },
  { bg: "rgba(200,90,90,0.13)",   color: "#c85a5a",  border: "rgba(200,90,90,0.26)" },
  { bg: "rgba(160,120,70,0.13)",  color: "#a07846",  border: "rgba(160,120,70,0.26)" },
  { bg: "rgba(140,100,70,0.13)",  color: "#8c6446",  border: "rgba(140,100,70,0.26)" },
  { bg: "rgba(120,110,80,0.13)",  color: "#786e50",  border: "rgba(120,110,80,0.26)" },
  { bg: "rgba(130,120,110,0.13)", color: "#82786e",  border: "rgba(130,120,110,0.26)" },
];

function genrePalette(genre: string) {
  let h = 0;
  for (const c of genre) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return GENRE_PALETTES[h % GENRE_PALETTES.length];
}

interface PlaylistInfo {
  id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  color: string | null;
  enabled?: boolean;
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
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
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
  const [enabled, setEnabled] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bottomSheet, setBottomSheet] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [descText, setDescText] = useState("");
  const [descLoading, setDescLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/playlists/${playlistId}/tracks?page=1&per_page=${PER_PAGE}`)
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        setPlaylist(data.playlist);
        setEnabled(data.playlist.enabled ?? true);
        setTracks(data.tracks);
        setTotal(data.total);
        setSynced(data.synced);
        setNotSynced(data.not_synced);
        setHasMore(data.total > data.tracks.length);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playlistId]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks?page=${nextPage}&per_page=${PER_PAGE}`);
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
        setTracks((prev) => prev.map((t) =>
          t.pushed_to_spotify === null ? { ...t, pushed_to_spotify: new Date().toISOString() } : t
        ));
      }
    } catch (err) {
      showToast(`Erreur sync : ${String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleLearn() {
    setActionLoading("learn");
    setBottomSheet(false);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/learn`, { method: "POST" });
      const data = await res.json() as { error?: string; rules?: unknown; llm_help_text?: string | null };
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur");
      await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: data.rules,
          llm_help_text: data.llm_help_text ?? null,
          learned_at: new Date().toISOString(),
        }),
      });
      showToast("Analyse terminée");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Analyse échouée");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggle() {
    setActionLoading("toggle");
    setBottomSheet(false);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error();
      setEnabled((v) => !v);
      showToast(!enabled ? "Playlist activée" : "Playlist désactivée");
    } catch {
      showToast("Erreur");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRecompute() {
    setActionLoading("recompute");
    setBottomSheet(false);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/recompute-centroid`, { method: "POST" });
      if (!res.ok) throw new Error();
      showToast("Centroïde recalculé");
    } catch {
      showToast("Erreur recompute");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDescSubmit() {
    if (!descText.trim()) return;
    setDescLoading(true);
    try {
      const res = await fetch("/api/playlists/from-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descText.trim() }),
      });
      const data = await res.json() as { error?: string; llm_help_text?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur");
      await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm_help_text: data.llm_help_text, learned_at: new Date().toISOString() }),
      });
      setDescText("");
      setDescOpen(false);
      showToast("Vibe sauvegardée");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDescLoading(false);
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

  const swatch = playlistSwatch(playlist.id, playlist.color);

  return (
    <main className="s-page">
      <Link href="/playlists" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-dim)", textDecoration: "none", marginBottom: 20 }}>
        ← Playlists
      </Link>

      <div style={{ marginBottom: 24 }}>
        {/* Barre couleur accent */}
        <div style={{ height: 3, width: 48, borderRadius: 2, background: swatch, marginBottom: 14 }} />

        <div className="s-page-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="font-fraunces s-page-h1" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}>
              {playlist.name}
            </h1>
            {playlist.description && (
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-dim)", paddingLeft: 20 }}>{playlist.description}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start" }}>
            {notSynced > 0 && (
              <button disabled={syncing} onClick={handleSync} className="s-btn s-btn-primary" style={{ flexShrink: 0 }}>
                {syncing ? "…" : `Sync (${notSynced})`}
              </button>
            )}
            <button className="s-btn" onClick={() => setBottomSheet(true)} disabled={!!actionLoading} aria-label="Actions" style={{ fontSize: 16, padding: "4px 10px" }}>
              {actionLoading ? "…" : "⋯"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--ink-dim)", alignItems: "center" }}>
          <span style={{ color: "var(--ink-mid)" }}>{total} tracks</span>
          <span>{synced} syncés</span>
          {notSynced > 0 && <span style={{ color: "var(--terra)" }}>{notSynced} non syncés</span>}
          {!enabled && (
            <span style={{ color: "var(--ink-dimmer)", background: "var(--surface2)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              inactif
            </span>
          )}
        </div>
      </div>

      {descOpen && (
        <div style={{ marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 8 }}>Décris la vibe de cette playlist</p>
          <textarea
            autoFocus
            className="s-input"
            rows={3}
            style={{ width: "100%", resize: "vertical", lineHeight: 1.6, marginBottom: 10 }}
            placeholder="Ex : Rap français boom-bap des années 2000, pas de trap…"
            value={descText}
            onChange={(e) => setDescText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleDescSubmit(); }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="s-btn" onClick={() => { setDescOpen(false); setDescText(""); }}>Annuler</button>
            <button className="s-btn s-btn-primary" disabled={descLoading || !descText.trim()} onClick={() => void handleDescSubmit()}>
              {descLoading ? "Génération…" : "Générer →"}
            </button>
          </div>
        </div>
      )}

      <div className="s-filter-bar">
        <div className="s-filter-chips">
          {(["all", "synced", "not_synced"] as FilterValue[]).map((f) => (
            <button key={f} className={`s-chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? `Tous (${total})` : f === "synced" ? `Syncés (${synced})` : `Non syncés (${notSynced})`}
            </button>
          ))}
        </div>
        <div className="s-filter-sep" />
        <select className="s-sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortValue)} aria-label="Trier par">
          <option value="default">Ordre par défaut</option>
          <option value="name">Nom A→Z</option>
          <option value="confidence">Confiance ↓</option>
        </select>
      </div>

      {displayedTracks.length === 0 ? (
        <div style={{ display: "flex", minHeight: 160, alignItems: "center", justifyContent: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", fontSize: 13, color: "var(--ink-mid)" }}>
          {filter !== "all" ? "Aucun track pour ce filtre" : "Aucun track dans cette playlist"}
        </div>
      ) : (
        <>
          <div className="s-table-wrap">
            <table className="s-table" style={{ width: "100%" }}>
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
                        {track.artist_name && <span style={{ fontWeight: 300, color: "var(--ink-mid)" }}>{track.artist_name} — </span>}
                        {track.name ?? track.spotify_track_id}
                      </p>
                      <p style={{ marginTop: 2, fontSize: 10, color: "var(--ink-dim)" }}>
                        {formatDate(track.spotify_added_at)}
                        {track.classification_level !== null && <span style={{ marginLeft: 6, color: "var(--ink-dimmer)" }}>{levelLabel(track.classification_level)}</span>}
                      </p>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {track.genres.slice(0, 2).map((g) => {
                          const pal = genrePalette(g);
                          return <span key={g} style={{ background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 6, padding: "1px 7px", fontSize: 10, color: pal.color }}>{g}</span>;
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {track.confidence !== null ? (
                        <span style={{
                          display: "inline-block", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 500,
                          background: track.confidence >= 0.55 ? "var(--sage-light)" : track.confidence >= 0.4 ? "var(--amber-light)" : "var(--terra-light)",
                          color: track.confidence >= 0.55 ? "var(--sage)" : track.confidence >= 0.4 ? "var(--amber)" : "var(--terra)",
                        }}>{Math.round(track.confidence * 100)}%</span>
                      ) : <span style={{ color: "var(--ink-dimmer)", fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {track.pushed_to_spotify ? <span style={{ fontSize: 12, color: "var(--sage)" }}>✓</span> : <span style={{ fontSize: 12, color: "var(--terra)" }}>○</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && filter === "all" && sort === "default" && (
            <button onClick={loadMore} disabled={loadingMore} className="s-btn" style={{ width: "100%", marginTop: 16, padding: "10px 0", justifyContent: "center" }}>
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

      {bottomSheet && (
        <>
          <div className="s-bs-backdrop" onClick={() => setBottomSheet(false)} />
          <div className="s-bs" role="dialog" aria-modal="true" aria-label={`Actions — ${playlist.name}`}>
            <div className="s-bs-handle" />
            <p className="s-bs-title" style={{ color: swatch }}>{playlist.name}</p>
            <button className="s-bs-item" disabled={actionLoading === "learn"} onClick={() => void handleLearn()}>
              {actionLoading === "learn" ? "Analyse…" : "Analyser"}
            </button>
            <button className="s-bs-item" onClick={() => { setBottomSheet(false); setDescOpen(true); }}>
              Décrire la vibe
            </button>
            <button className="s-bs-item" disabled={actionLoading === "toggle"} onClick={() => void handleToggle()}>
              {enabled ? "Désactiver" : "Activer"}
            </button>
            <div className="s-bs-sep" />
            <button className="s-bs-item" disabled={actionLoading === "recompute"} onClick={() => void handleRecompute()}>
              {actionLoading === "recompute" ? "Calcul…" : "Recompute centroïde"}
            </button>
            <div className="s-bs-sep" style={{ marginTop: 4 }} />
            <button className="s-bs-item s-bs-item-dim" onClick={() => setBottomSheet(false)}>Annuler</button>
          </div>
        </>
      )}

      {toast && <div className="s-toast">{toast}</div>}
    </main>
  );
}
