"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SpotifyUserPlaylist } from "@/lib/spotify/fetchers";

interface Props {
  playlists: SpotifyUserPlaylist[];
}

export default function OnboardingClient({ playlists }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleConnect() {
    if (selected.size === 0) return;
    setLoading(true);

    const toSync = playlists.filter((p) => selected.has(p.id));
    setProgress({ done: 0, total: toSync.length });

    for (let i = 0; i < toSync.length; i++) {
      const pl = toSync[i];
      await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyPlaylistId: pl.id,
          name: pl.name,
          description: pl.description ?? "",
        }),
      });
      setProgress({ done: i + 1, total: toSync.length });
    }

    router.replace("/dashboard");
  }

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-12 text-white">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Configurer Sortify</h1>
        <p className="text-sm text-neutral-400">
          Sélectionne les playlists Spotify dans lesquelles Sortify triera tes liked songs.
        </p>
      </div>

      <ul className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800">
        {playlists.map((pl) => {
          const checked = selected.has(pl.id);
          return (
            <li key={pl.id}>
              <label className="flex cursor-pointer items-center gap-4 bg-neutral-900 px-4 py-3 transition-colors hover:bg-neutral-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(pl.id)}
                  className="h-4 w-4 accent-[#1DB954]"
                />
                {pl.images[0] && (
                  <img
                    src={pl.images[0].url}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pl.name}</p>
                  <p className="text-xs text-neutral-500">
                    {pl.tracks?.total ?? 0} titre{(pl.tracks?.total ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          {selected.size} sélectionnée{selected.size !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleConnect}
          disabled={loading || selected.size === 0}
          className="rounded-full bg-[#1DB954] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading && progress
            ? `Connexion… (${progress.done}/${progress.total})`
            : "Connecter"}
        </button>
      </div>
    </main>
  );
}
