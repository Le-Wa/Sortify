"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  spotify_total: number | null;
  imported: number;
  in_playlists: number;
  needs_review: number;
  last_sync_at: string | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number | null;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="s-stat-card">
      <p style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 6 }}>{label}</p>
      <p
        className="font-fraunces"
        style={{
          fontSize: 34,
          fontWeight: 600,
          color: accent ? "var(--terra)" : "var(--ink)",
          letterSpacing: "-1px",
          lineHeight: 1,
        }}
      >
        {value === null ? <span style={{ color: "var(--ink-dimmer)" }}>—</span> : value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}>{sub}</p>
      )}
    </div>
  );
}

export default function DashboardActions() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) setStats(await res.json() as Stats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  if (loading) {
    return (
      <div className="s-stats-grid">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              height: 88,
              borderRadius: 14,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="s-stats-grid">
        <StatCard label="Inbox" value={stats?.needs_review ?? 0} sub="à valider" accent />
        <StatCard label="Classifiés" value={stats?.in_playlists ?? 0} sub="au total" />
        <StatCard
          label="Importés"
          value={stats?.imported ?? 0}
          sub={stats?.spotify_total ? `/ ${stats.spotify_total}` : undefined}
        />
        <StatCard
          label="Taux auto"
          value={
            stats && stats.imported > 0
              ? `${Math.round(((stats.imported - stats.needs_review) / stats.imported) * 100)}%`
              : null
          }
          sub="sans review"
        />
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-dim)", textAlign: "right" }}>
        Dernière sync : {relativeTime(stats?.last_sync_at ?? null)}
      </p>
    </div>
  );
}
