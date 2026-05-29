"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { playlistSwatch } from "@/lib/playlist-swatch";

interface PreviewTrack {
  id: string;
  name: string | null;
  artist_name: string | null;
  suggested_playlist: string | null;
  suggested_playlist_color: string | null;
  confidence: number | null;
  enrichment_source: string | null;
  llm_suggestion_id: string | null;
}

export default function DashboardInboxPreview() {
  const [tracks, setTracks] = useState<PreviewTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  function loadInbox() {
    fetch("/api/inbox?per_page=3&page=1")
      .then((r) => r.json())
      .then((data: { tracks: PreviewTrack[]; total: number }) => {
        setTracks(data.tracks);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadInbox();
    window.addEventListener("classify:complete", loadInbox);
    return () => window.removeEventListener("classify:complete", loadInbox);
  }, []);

  async function validate(trackId: string) {
    setBusy((p) => new Set([...p, trackId]));
    try {
      const res = await fetch(`/api/inbox/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setExiting((p) => new Set([...p, trackId]));
      setTimeout(() => {
        setTracks((p) => p.filter((t) => t.id !== trackId));
        setTotal((p) => p - 1);
        setExiting((p) => { const n = new Set(p); n.delete(trackId); return n; });
      }, 300);
    } catch (err) {
      alert(String(err));
    } finally {
      setBusy((p) => { const n = new Set(p); n.delete(trackId); return n; });
    }
  }

  if (loading || (tracks.length === 0 && total === 0)) return null;

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="s-section-title" style={{ marginBottom: 0 }}>Inbox — à valider</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {total > 3 && (
            <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{total - tracks.length} de plus</span>
          )}
          <Link href="/inbox" className="s-btn" style={{ textDecoration: "none" }}>
            Voir tout →
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tracks.map((track) => {
          const conf = track.confidence !== null ? Math.round(track.confidence * 100) : null;
          const confLow = track.confidence !== null && track.confidence < 0.55;
          const isExit = exiting.has(track.id);
          const isBusy = busy.has(track.id);

          const swatchColor = track.llm_suggestion_id
            ? playlistSwatch(track.llm_suggestion_id, track.suggested_playlist_color)
            : null;
          const r = swatchColor ? parseInt(swatchColor.slice(1, 3), 16) : 0;
          const g = swatchColor ? parseInt(swatchColor.slice(3, 5), 16) : 0;
          const b = swatchColor ? parseInt(swatchColor.slice(5, 7), 16) : 0;

          return (
            <div
              key={track.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "13px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                opacity: isExit ? 0 : 1,
                transform: isExit ? "scale(0.97)" : undefined,
                transition: "all 0.3s",
                boxShadow: "var(--shadow)",
              }}
            >
              {/* Track info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.name ?? "—"}
                </p>
                <p style={{ fontSize: 12, color: "var(--ink-mid)", margin: "2px 0 0" }}>
                  {track.artist_name}
                </p>
              </div>

              {/* Playlist pill */}
              {track.suggested_playlist && swatchColor && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 9px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 500,
                    border: `1.5px solid ${swatchColor}`,
                    background: `rgba(${r},${g},${b},0.08)`,
                    color: swatchColor,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: swatchColor, flexShrink: 0 }} />
                  {track.suggested_playlist}
                </span>
              )}

              {/* Confidence */}
              {conf !== null && (
                <span
                  className={confLow ? "s-conf-low" : "s-conf-none"}
                  style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {conf}%
                </span>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  disabled={isBusy || !track.llm_suggestion_id}
                  onClick={() => validate(track.id)}
                  className="s-btn s-btn-primary s-btn-sm"
                >
                  {isBusy ? "…" : "Valider"}
                </button>
                <Link
                  href="/inbox"
                  className="s-btn s-btn-sm"
                  style={{ textDecoration: "none" }}
                >
                  Changer
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
