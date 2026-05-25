"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  spotify_total: number | null;
  imported: number;
  in_playlists: number;
  needs_review: number;
  last_sync_at: string | null;
}

interface InitialCounts {
  needs_review: number;
  imported: number;
  in_playlists: number;
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

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function autoRatePhrase(imported: number, needsReview: number): string {
  if (imported === 0) return "";
  const auto = imported - needsReview;
  const g = gcd(auto, imported);
  const num = auto / g;
  const den = imported / g;
  if (den <= 10) {
    const verb = num > 1 ? "sont rangés" : "est rangé";
    return `${num} titre${num > 1 ? "s" : ""} sur ${den} ${verb} sans que tu y touches.`;
  }
  return `${Math.round((auto / imported) * 100)}% de tes titres sont rangés automatiquement.`;
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
    <div className="s-stat-card" style={{ padding: "12px 14px" }}>
      <p style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-mid)", marginBottom: 4 }}>{label}</p>
      <p
        className="font-fraunces"
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: accent ? "var(--terra)" : "var(--ink)",
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        {value === null ? <span style={{ color: "var(--ink-dimmer)" }}>—</span> : value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 3 }}>{sub}</p>
      )}
    </div>
  );
}

export default function DashboardActions({ initialCounts }: { initialCounts?: InitialCounts }) {
  const [stats, setStats] = useState<Stats | null>(
    initialCounts
      ? { ...initialCounts, spotify_total: null }
      : null
  );
  const [loading, setLoading] = useState(!initialCounts);

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
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="s-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ height: 8, width: "48%", borderRadius: 4, background: "var(--surface3)", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 18, width: "65%", borderRadius: 4, background: "var(--surface3)", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 8, width: "36%", borderRadius: 4, background: "var(--surface3)", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const autoPhrase = stats ? autoRatePhrase(stats.imported, stats.needs_review) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="s-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatCard label="Inbox" value={stats?.needs_review ?? 0} sub="à valider" accent />
        <StatCard label="Classifiés" value={stats?.in_playlists ?? 0} sub="au total" />
        <StatCard
          label="Importés"
          value={stats?.imported ?? 0}
          sub={stats?.spotify_total ? `/ ${stats.spotify_total}` : undefined}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {autoPhrase ? (
          <p style={{ fontSize: 12, color: "var(--ink-mid)", margin: 0 }}>
            {autoPhrase}
          </p>
        ) : <span />}
        <p style={{ fontSize: 12, color: "var(--ink-mid)", margin: 0, flexShrink: 0 }}>
          Dernière sync : {relativeTime(stats?.last_sync_at ?? null)}
        </p>
      </div>
    </div>
  );
}
