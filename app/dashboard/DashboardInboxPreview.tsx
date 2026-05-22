"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface PreviewTrack {
  id: string;
  name: string | null;
  artist_name: string | null;
  suggested_playlist: string | null;
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

  useEffect(() => {
    fetch("/api/inbox?per_page=3&page=1")
      .then((r) => r.json())
      .then((data: { tracks: PreviewTrack[]; total: number }) => {
        setTracks(data.tracks);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        setExiting((p) => {
          const n = new Set(p);
          n.delete(trackId);
          return n;
        });
      }, 300);
    } catch (err) {
      alert(String(err));
    } finally {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(trackId);
        return n;
      });
    }
  }

  if (loading || (tracks.length === 0 && total === 0)) return null;

  return (
    <section style={{ marginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="s-section-title" style={{ marginBottom: 0 }}>
          Inbox — à valider
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {total > 3 && (
            <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>
              {total - tracks.length} de plus
            </span>
          )}
          <Link href="/inbox" className="s-btn" style={{ textDecoration: "none" }}>
            Voir tout →
          </Link>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tracks.map((track) => {
          const conf = track.confidence !== null ? Math.round(track.confidence * 100) : null;
          const isLow = track.confidence !== null && track.confidence < 0.55;
          const isExit = exiting.has(track.id);
          const isBusy = busy.has(track.id);
          return (
            <div
              key={track.id}
              className={`s-inbox-row${isLow ? " low-conf" : ""}`}
              style={{
                opacity: isExit ? 0 : 1,
                transform: isExit ? "scale(0.97)" : undefined,
                transition: "all 0.3s",
              }}
            >
              <div className="s-inbox-row-track">
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                  {track.name ?? "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                  {track.artist_name}
                </div>
              </div>

              {track.enrichment_source && (
                <span
                  className="s-inbox-row-method"
                  style={{
                    fontSize: 10,
                    color: "var(--ink-mid)",
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    padding: "3px 8px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {track.enrichment_source}
                </span>
              )}

              {track.suggested_playlist && (
                <span
                  className="s-inbox-row-pl"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--sage)",
                    background: "var(--sage-light)",
                    border: "1px solid var(--sage-border)",
                    padding: "4px 12px",
                    borderRadius: 20,
                    whiteSpace: "nowrap",
                    alignSelf: "start",
                  }}
                >
                  {track.suggested_playlist}
                </span>
              )}

              {conf !== null && (
                <span className={`s-inbox-row-conf${isLow ? " lo" : ""}`}>{conf}%</span>
              )}

              <div className="s-inbox-row-actions">
                <button
                  disabled={isBusy || !track.llm_suggestion_id}
                  onClick={() => validate(track.id)}
                  className="s-btn s-btn-primary"
                >
                  {isBusy ? "…" : "Valider"}
                </button>
                <Link
                  href="/inbox"
                  className="s-btn"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
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
