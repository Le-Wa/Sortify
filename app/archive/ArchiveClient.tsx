"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface ArchivedTrack {
  id: string;
  name: string | null;
  artist_name: string | null;
  album_name: string | null;
  genres: string[];
  spotify_added_at: string | null;
  is_archived: boolean;
}

type AgeFilter = "all" | "recent";
const MS_30D = 30 * 24 * 60 * 60 * 1000;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ArchiveClient() {
  const [tracks, setTracks] = useState<ArchivedTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  useEffect(() => {
    fetch("/api/archive")
      .then((r) => r.json())
      .then((data: { tracks: ArchivedTrack[]; total: number }) => {
        setTracks(data.tracks);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function exitTrack(id: string) {
    setExiting((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      setExiting((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }, 300);
  }

  async function handleUnarchive(id: string) {
    setBusy((prev) => new Set([...prev, id]));
    try {
      const res = await fetch(`/api/archive/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unarchive" }),
      });
      if (!res.ok) throw new Error(await res.text());
      exitTrack(id);
    } catch (err) {
      showToast(`Erreur : ${String(err)}`);
    } finally {
      setBusy((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  const displayedTracks = useMemo(() => {
    if (ageFilter === "recent") {
      const now = Date.now();
      return tracks.filter((t) => t.spotify_added_at && now - new Date(t.spotify_added_at).getTime() < MS_30D);
    }
    return tracks;
  }, [tracks, ageFilter]);

  const recentCount = useMemo(() => {
    const now = Date.now();
    return tracks.filter((t) => t.spotify_added_at && now - new Date(t.spotify_added_at).getTime() < MS_30D).length;
  }, [tracks]);

  return (
    <main className="s-page">
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>Archive</div>
        <h1
          className="font-fraunces"
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.6px", color: "var(--ink)", lineHeight: 1.1 }}
        >
          {loading ? (
            <span style={{ color: "var(--ink-dimmer)" }}>…</span>
          ) : (
            <>
              <span style={{ color: "var(--terra)" }}>{total}</span>
              <em style={{ fontStyle: "italic", color: "var(--ink-mid)", fontSize: 20, fontWeight: 400, marginLeft: 8 }}>
                track{total !== 1 ? "s" : ""} archivé{total !== 1 ? "s" : ""}
              </em>
            </>
          )}
        </h1>
      </div>

      {!loading && total > 0 && (
        <div className="s-filter-bar" style={{ marginBottom: 16 }}>
          <div className="s-filter-chips">
            <button className={`s-chip${ageFilter === "all" ? " active" : ""}`} onClick={() => setAgeFilter("all")}>
              Tous ({total})
            </button>
            <button className={`s-chip${ageFilter === "recent" ? " active" : ""}`} onClick={() => setAgeFilter("recent")}>
              Récents &lt;30j ({recentCount})
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-dim)", fontSize: 13 }}>
          Chargement…
        </div>
      ) : total === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "56px 0", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--ink-mid)", margin: 0 }}>Aucun track archivé</p>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: 0 }}>Les tracks que tu archives depuis l'inbox apparaîtront ici.</p>
          <Link href="/inbox" className="s-btn" style={{ textDecoration: "none", marginTop: 4 }}>
            Aller à l'inbox
          </Link>
        </div>
      ) : displayedTracks.length === 0 ? (
        <div style={{ display: "flex", minHeight: 160, alignItems: "center", justifyContent: "center", color: "var(--ink-mid)", fontSize: 13 }}>
          Aucun track récent (&lt;30 jours)
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 6, listStyle: "none", padding: 0, margin: 0 }}>
          {displayedTracks.map((track) => (
            <li
              key={track.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "12px 16px",
                transition: "all 0.3s",
                opacity: exiting.has(track.id) ? 0 : 1,
                transform: exiting.has(track.id) ? "scale(0.97)" : "scale(1)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.artist_name && (
                    <span style={{ fontWeight: 400, color: "var(--ink-mid)" }}>{track.artist_name} — </span>
                  )}
                  {track.name ?? "Titre inconnu"}
                  {track.album_name && (
                    <span style={{ fontWeight: 400, color: "var(--ink-dim)" }}> ({track.album_name})</span>
                  )}
                </p>
                <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {track.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 7px", fontSize: 10, color: "var(--ink-mid)" }}
                    >
                      {g}
                    </span>
                  ))}
                  <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{formatDate(track.spotify_added_at)}</span>
                </div>
              </div>
              <button
                disabled={busy.has(track.id)}
                onClick={() => handleUnarchive(track.id)}
                className="s-btn"
                style={{ flexShrink: 0 }}
              >
                {busy.has(track.id) ? "…" : "Désarchiver"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {toast && <div className="s-toast">{toast}</div>}
    </main>
  );
}
