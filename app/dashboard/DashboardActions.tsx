"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  spotify_total: number | null;
  imported: number;
  not_imported: number | null;
  in_playlists: number;
  not_in_playlist: number;
  needs_review: number;
  archived: number;
  last_sync_at: string | null;
  cron_enabled: boolean;
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
}: {
  label: string;
  value: string | number | null;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-5 text-center">
      <p className="text-3xl font-bold tabular-nums">
        {value === null ? <span className="text-neutral-600">—</span> : value}
      </p>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-600">{sub}</p>}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant?: "default" | "danger";
}) {
  const base =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const colors =
    variant === "danger"
      ? "bg-red-800 hover:bg-red-700 text-white"
      : "bg-neutral-700 hover:bg-neutral-600 text-white";
  return (
    <button className={`${base} ${colors}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export default function DashboardActions() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) setStats(await res.json() as Stats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 5000);
  }

  async function importRecent() {
    setBusy(true);
    try {
      const res = await fetch("/api/tracks/import-recent", { method: "POST" });
      const data = (await res.json()) as { imported: number; already_existing: number };
      flash(`${data.imported} nouveau${data.imported !== 1 ? "x" : ""} · ${data.already_existing} déjà présents`);
      await loadStats();
    } catch {
      flash("Erreur lors de l'import récent");
    } finally {
      setBusy(false);
    }
  }

  async function importAll() {
    if (!confirm("L'import complet peut prendre plusieurs minutes. Continuer ?")) return;
    setBusy(true);
    let cursor: string | null = null;
    let total = 0;
    try {
      do {
        const res = await fetch("/api/tracks/import-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        const data = (await res.json()) as { pageImported: number; total: number; cursor: string | null };
        total += data.pageImported;
        cursor = data.cursor;
        setFeedback(`Import en cours… ${total} tracks`);
      } while (cursor !== null);
      flash(`Import complet — ${total} tracks importés`);
      await loadStats();
    } catch {
      flash("Erreur lors de l'import complet");
    } finally {
      setBusy(false);
    }
  }

  async function runClassify(skipLlm = false) {
    setBusy(true);
    let totalClassified = 0;
    let totalReview = 0;
    try {
      let remaining = Infinity;
      while (remaining > 0) {
        const res = await fetch("/api/classify/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skipLlm }),
        });
        const data = (await res.json()) as {
          classified: number;
          needs_review: number;
          batch_size: number;
          remaining: number;
          errors: string[];
        };
        totalClassified += data.classified;
        totalReview += data.needs_review;
        remaining = data.remaining;
        if (data.batch_size === 0) break;
        setFeedback(`Classification… ${totalClassified} ok · ${totalReview} review`);
      }
      flash(`Terminé — ${totalClassified} classifiés · ${totalReview} en review`);
      await loadStats();
    } catch {
      flash("Erreur lors de la classification");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCron() {
    if (!stats) return;
    setBusy(true);
    try {
      const res = await fetch("/api/users/cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !stats.cron_enabled }),
      });
      const data = (await res.json()) as { cron_enabled: boolean };
      setStats((s) => s ? { ...s, cron_enabled: data.cron_enabled } : s);
      flash(`Cron hebdo ${data.cron_enabled ? "activé" : "désactivé"}`);
    } catch {
      flash("Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-900" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Liked sur Spotify"
          value={stats?.spotify_total ?? null}
        />
        <StatCard
          label="Importés en base"
          value={stats?.imported ?? 0}
          sub={stats?.spotify_total ? `/ ${stats.spotify_total}` : undefined}
        />
        <StatCard
          label="Dans une playlist"
          value={stats?.in_playlists ?? 0}
          sub={stats?.imported ? `/ ${stats.imported}` : undefined}
        />
        <StatCard
          label="En review"
          value={stats?.needs_review ?? 0}
        />
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <ActionBtn
          label="Importer les nouveaux"
          onClick={importRecent}
          disabled={busy}
        />
        <ActionBtn
          label="Import historique complet"
          onClick={importAll}
          disabled={busy}
          variant="danger"
        />
        <ActionBtn
          label="Classifier (LLM)"
          onClick={() => runClassify(false)}
          disabled={busy}
        />
        <ActionBtn
          label="Classifier rapide"
          onClick={() => runClassify(true)}
          disabled={busy}
        />
        <ActionBtn
          label={stats?.cron_enabled ? "Désactiver cron" : "Activer cron hebdo"}
          onClick={toggleCron}
          disabled={busy}
        />
      </div>

      {/* ── Feedback + last sync ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{feedback ?? " "}</span>
        <span>Dernière sync : {relativeTime(stats?.last_sync_at ?? null)}</span>
      </div>
    </div>
  );
}
