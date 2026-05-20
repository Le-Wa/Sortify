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
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        {loading
          ? "Archive"
          : `${total} track${total !== 1 ? "s" : ""} archivé${total !== 1 ? "s" : ""}`}
      </h1>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-neutral-500">
          Chargement…
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center text-neutral-500">
          Aucun track archivé
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tracks.map((track) => (
            <li
              key={track.id}
              className={`flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 transition-all duration-300 ${
                exiting.has(track.id) ? "scale-95 opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {track.artist_name && (
                    <span className="font-normal text-neutral-400">{track.artist_name} — </span>
                  )}
                  {track.name ?? "Titre inconnu"}
                  {track.album_name && (
                    <span className="font-normal text-neutral-600"> ({track.album_name})</span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {track.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400"
                    >
                      {g}
                    </span>
                  ))}
                  <span className="text-xs text-neutral-600">{formatDate(track.spotify_added_at)}</span>
                </div>
              </div>
              <button
                disabled={busy.has(track.id)}
                onClick={() => handleUnarchive(track.id)}
                className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-40"
              >
                {busy.has(track.id) ? "…" : "Désarchiver"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
