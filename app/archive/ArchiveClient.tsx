"use client";

import { useState, useEffect } from "react";

interface ArchivedTrack {
  id: string;
  name: string | null;
  artist_name: string | null;
  album_name: string | null;
  genres: string[];
  spotify_added_at: string | null;
  is_archived: boolean;
}

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
      alert(`Erreur : ${String(err)}`);
    } finally {
      setBusy((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  return (
    <main className="s-page">
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>Archive</div>
        <h1
          className="font-fraunces"
          style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}
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

      {loading ? (
        <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-dim)", fontSize: 13 }}>
          Chargement…
        </div>
      ) : tracks.length === 0 ? (
        <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-mid)", fontSize: 13 }}>
          Aucun track archivé
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 6, listStyle: "none", padding: 0, margin: 0 }}>
          {tracks.map((track) => (
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
                    <span style={{ fontWeight: 300, color: "var(--ink-mid)" }}>{track.artist_name} — </span>
                  )}
                  {track.name ?? "Titre inconnu"}
                  {track.album_name && (
                    <span style={{ fontWeight: 300, color: "var(--ink-dim)" }}> ({track.album_name})</span>
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
                  <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>{formatDate(track.spotify_added_at)}</span>
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
    </main>
  );
}
