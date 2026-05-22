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

const SWATCH_COLORS = [
  "#c89840", "#8878d0", "#6a9070", "#c87a52",
  "#a06848", "#508860", "#7878b0", "#c08060",
];

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
      <div style={{ display: "flex", minHeight: 200, alignItems: "center", justifyContent: "center", color: "var(--ink-mid)", fontSize: 13 }}>
        Aucune playlist configurée —{" "}
        <Link href="/onboarding" style={{ marginLeft: 4, color: "var(--terra)", textDecoration: "none" }}>
          onboarding
        </Link>
      </div>
    );
  }

  return (
    <main className="s-page">
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>Bibliothèque</div>
        <h1
          className="font-fraunces"
          style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}
        >
          {playlists.length}{" "}
          <em style={{ fontStyle: "italic", color: "var(--terra)" }}>
            playlist{playlists.length !== 1 ? "s" : ""}
          </em>
        </h1>
      </div>

      <div className="s-pl-grid">
        {playlists.map((p, i) => {
          const isSyncing = syncing.has(p.id);
          const swatchColor = SWATCH_COLORS[i % SWATCH_COLORS.length];
          return (
            <div key={p.id} className="s-pl-card">
              {/* Color swatch */}
              <div
                style={{
                  width: 28,
                  height: 3,
                  borderRadius: 2,
                  background: swatchColor,
                  marginBottom: 12,
                  opacity: 0.8,
                }}
              />

              {/* Name */}
              <h2
                className="font-fraunces"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "-0.3px",
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                {p.name}
              </h2>

              {/* Description */}
              {p.description && (
                <p style={{ fontSize: 10, color: "var(--ink-dim)", lineHeight: 1.7 }}>
                  {p.description}
                </p>
              )}

              {/* Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span
                  className="font-fraunces"
                  style={{ fontSize: 22, fontWeight: 600, color: "var(--ink-mid)" }}
                >
                  {p.total}
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {p.not_synced > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--terra)",
                        background: "var(--terra-light)",
                        border: "1px solid var(--terra-border)",
                        padding: "2px 8px",
                        borderRadius: 20,
                      }}
                    >
                      +{p.not_synced}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Link
                  href={`/playlists/${p.id}`}
                  className="s-btn"
                  style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: "6px 0" }}
                >
                  Voir →
                </Link>
                {p.not_synced > 0 && (
                  <button
                    disabled={isSyncing}
                    onClick={() => handleSync(p.id)}
                    className="s-btn s-btn-primary"
                  >
                    {isSyncing ? "…" : "Sync"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
