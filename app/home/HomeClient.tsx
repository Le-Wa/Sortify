"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  total: number;
  synced: number;
  not_synced: number;
  enabled: boolean;
  priority: number;
}

const SWATCH = ["#c89840","#8878d0","#6a9070","#c87a52","#a06848","#508860","#7878b0","#c08060"];
function playlistSwatch(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return SWATCH[h % SWATCH.length];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne après-midi";
  return "Bonsoir";
}

export default function HomeClient() {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  useEffect(() => {
    Promise.all([
      fetch("/api/playlists").then((r) => r.json()),
      fetch("/api/dashboard/stats").then((r) => r.json()),
    ])
      .then(([pls, stats]: [Playlist[], { needs_review?: number }]) => {
        setPlaylists(
          pls
            .filter((p) => p.enabled)
            .sort((a, b) => a.priority - b.priority)
        );
        setInboxCount(stats.needs_review ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  async function syncPlaylist(id: string) {
    setSyncing(id);
    try {
      const res = await fetch(`/api/playlists/${id}/sync`, { method: "POST" });
      const data = (await res.json()) as { synced: number };
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, not_synced: Math.max(0, p.not_synced - data.synced) }
            : p
        )
      );
      showToast(`${data.synced} track${data.synced > 1 ? "s" : ""} syncé${data.synced > 1 ? "s" : ""}`);
    } catch {
      showToast("Erreur sync");
    } finally {
      setSyncing(null);
    }
  }

  const totalPending = playlists.reduce((s, p) => s + p.not_synced, 0);

  return (
    <main className="s-page">

      {/* Greeting */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 16, fontWeight: 300, color: "var(--ink-mid)", marginBottom: 8 }}>
          {greeting()}{firstName ? ", " : ""}
          <span style={{ color: "var(--terra)", fontWeight: 400 }}>{firstName}</span>
        </div>
        <h1
          className="font-fraunces s-page-h1"
          style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}
        >
          {loading ? (
            <span style={{ color: "var(--ink-dimmer)" }}>…</span>
          ) : (
            <>
              {playlists.length}{" "}
              <em style={{ fontStyle: "italic", color: "var(--terra)" }}>
                playlist{playlists.length !== 1 ? "s" : ""}
              </em>
            </>
          )}
        </h1>
        {!loading && totalPending > 0 && (
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--ink-dim)" }}>
            {totalPending} track{totalPending > 1 ? "s" : ""} en attente de sync
          </p>
        )}
      </div>

      {/* Inbox banner */}
      {inboxCount > 0 && (
        <Link
          href="/inbox"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--terra-light)",
            border: "1px solid var(--terra-border)",
            borderRadius: 14,
            padding: "16px 20px",
            textDecoration: "none",
            marginBottom: 28,
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--terra)" }}>
              {inboxCount} track{inboxCount > 1 ? "s" : ""} à revoir
            </p>
            <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 3 }}>
              Ouvrir l'inbox →
            </p>
          </div>
          <span
            className="font-fraunces"
            style={{ fontSize: 36, fontWeight: 600, color: "var(--terra)", lineHeight: 1, opacity: 0.8 }}
          >
            {inboxCount}
          </span>
        </Link>
      )}

      {/* Actions header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="s-section-title" style={{ marginBottom: 0 }}>Playlists</div>
        <Link href="/playlists" className="s-btn s-btn-primary" style={{ textDecoration: "none" }}>
          + Nouvelle
        </Link>
      </div>

      {/* Playlist list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 76,
                borderRadius: 14,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: 180, gap: 12, color: "var(--ink-mid)", fontSize: 13, textAlign: "center",
        }}>
          <p>Aucune playlist active</p>
          <Link href="/playlists" className="s-btn s-btn-primary" style={{ textDecoration: "none" }}>
            Créer une playlist
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {playlists.map((pl) => {
            const color = playlistSwatch(pl.id);
            return (
              <div
                key={pl.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                {/* Swatch bar */}
                <div style={{ height: 3, background: color, opacity: 0.85 }} />

                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
                  {/* Navigate zone */}
                  <Link
                    href={`/playlists/${pl.id}`}
                    style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
                  >
                    <p
                      className="font-fraunces"
                      style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}
                    >
                      {pl.name}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 3 }}>
                      {pl.total} track{pl.total !== 1 ? "s" : ""}
                      {pl.not_synced > 0 && (
                        <span style={{ color: "var(--terra)", marginLeft: 8 }}>
                          · {pl.not_synced} en attente
                        </span>
                      )}
                    </p>
                  </Link>

                  {/* Sync button — only if pending */}
                  {pl.not_synced > 0 && (
                    <button
                      className="s-btn s-btn-sm"
                      disabled={syncing === pl.id}
                      onClick={() => void syncPlaylist(pl.id)}
                      style={{ flexShrink: 0, color: "var(--terra)", borderColor: "var(--terra-border)" }}
                    >
                      {syncing === pl.id ? "…" : `Sync ${pl.not_synced}`}
                    </button>
                  )}

                  {/* Chevron */}
                  <Link
                    href={`/playlists/${pl.id}`}
                    aria-hidden
                    style={{ color: "var(--ink-dimmer)", textDecoration: "none", fontSize: 18, flexShrink: 0, lineHeight: 1 }}
                  >
                    ›
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className="s-toast">{toast}</div>}
    </main>
  );
}
