"use client";

import { useState } from "react";
import Link from "next/link";

interface PlaylistData {
  id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  total: number;
  synced: number;
  not_synced: number;
}

export default function PlaylistsClient({ playlists: initial }: { playlists: PlaylistData[] }) {
  const [playlists, setPlaylists] = useState(initial);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());

  async function handleSync(playlistId: string) {
    setSyncing((prev) => new Set([...prev, playlistId]));
    try {
      const res = await fetch(`/api/playlists/${playlistId}/sync`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { synced: number; errors: string[] };
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                synced: p.synced + data.synced,
                not_synced: Math.max(0, p.not_synced - data.synced),
              }
            : p
        )
      );
    } catch (err) {
      alert(`Erreur sync : ${String(err)}`);
    } finally {
      setSyncing((prev) => {
        const n = new Set(prev);
        n.delete(playlistId);
        return n;
      });
    }
  }

  if (playlists.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center text-neutral-500">
        Aucune playlist configurée —{" "}
        <Link href="/onboarding" className="ml-1 underline hover:text-white">
          onboarding
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Playlists</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {playlists.map((p) => {
          const isSyncing = syncing.has(p.id);
          return (
            <div
              key={p.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-white">{p.name}</h2>
                  {p.description && (
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{p.description}</p>
                  )}
                </div>
                {p.not_synced > 0 && (
                  <span className="shrink-0 rounded-full bg-orange-900/60 px-2 py-0.5 text-xs font-medium text-orange-300">
                    {p.not_synced} non sync
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="mb-4 flex gap-3 text-xs text-neutral-500">
                <span>{p.total} tracks</span>
                <span className="text-neutral-700">·</span>
                <span>{p.synced} synced</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/playlists/${p.id}`}
                  className="flex-1 rounded-lg border border-neutral-700 py-1.5 text-center text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  Voir →
                </Link>
                {p.not_synced > 0 && (
                  <button
                    disabled={isSyncing}
                    onClick={() => handleSync(p.id)}
                    className="rounded-lg border border-orange-900 px-3 py-1.5 text-sm font-medium text-orange-300 transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {isSyncing ? "…" : "Sync"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
