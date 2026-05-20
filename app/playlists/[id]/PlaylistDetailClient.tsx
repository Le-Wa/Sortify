"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

const PER_PAGE = 50;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function confidenceBadgeClass(c: number | null): string {
  if (c === null) return "bg-neutral-800 text-neutral-400";
  if (c >= 0.55) return "bg-green-900 text-green-300";
  if (c >= 0.4) return "bg-yellow-900 text-yellow-300";
  return "bg-red-900 text-red-300";
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
        // Optimistically mark visible tracks as synced
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

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-neutral-500">
        Chargement…
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex min-h-64 items-center justify-center text-neutral-500">
        Playlist introuvable
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/playlists"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-white"
      >
        ← Playlists
      </Link>

      {/* Header */}
      <div className="mb-6 mt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{playlist.name}</h1>
            {playlist.description && (
              <p className="mt-1 text-sm text-neutral-500">{playlist.description}</p>
            )}
          </div>
          {notSynced > 0 && (
            <button
              disabled={syncing}
              onClick={handleSync}
              className="shrink-0 rounded-lg border border-orange-900 px-4 py-1.5 text-sm font-medium text-orange-300 transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {syncing ? "…" : `Re-sync (${notSynced})`}
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-400">
          <span>{total} tracks</span>
          <span>{synced} synced</span>
          {notSynced > 0 && (
            <span className="font-medium text-orange-400">{notSynced} non synced</span>
          )}
        </div>
      </div>

      {/* Track list */}
      {tracks.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-neutral-800 text-sm text-neutral-500">
          Aucun track dans cette playlist
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-left">
                <tr className="text-xs text-neutral-600">
                  <th className="px-4 py-2.5 font-medium">Track</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Genres</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conf.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {tracks.map((track) => (
                  <tr key={track.id} className="bg-neutral-900 hover:bg-neutral-800/50">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {track.artist_name && (
                          <span className="font-normal text-neutral-400">
                            {track.artist_name} —{" "}
                          </span>
                        )}
                        {track.name ?? track.spotify_track_id}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        {formatDate(track.spotify_added_at)}
                        {track.classification_level !== null && (
                          <span className="ml-2 text-neutral-700">
                            {levelLabel(track.classification_level)}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {track.genres.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {track.confidence !== null ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(track.confidence)}`}
                        >
                          {Math.round(track.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {track.pushed_to_spotify ? (
                        <span className="text-xs font-medium text-green-600">✓</span>
                      ) : (
                        <span className="text-xs text-orange-500">○</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full rounded-lg border border-neutral-700 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 disabled:opacity-40"
            >
              {loadingMore ? "Chargement…" : "Charger plus"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
