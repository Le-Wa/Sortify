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

type ImportMode = "months" | "songs";

export default function DashboardActions() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("months");
  const [importMonths, setImportMonths] = useState("12");
  const [importSongs, setImportSongs] = useState("500");

  const [classifyProgress, setClassifyProgress] = useState<{ done: number; total: number } | null>(null);

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

  async function importAll(mode: ImportMode, value: number) {
    setImportPanelOpen(false);
    setBusy(true);
    const months = mode === "months" ? value : 0;
    const maxTracks = mode === "songs" && value > 0 ? value : Infinity;
    let cursor: string | null = null;
    let total = 0;
    try {
      // 1. Import
      do {
        const res = await fetch("/api/tracks/import-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ months, cursor }),
        });
        const data = (await res.json()) as { pageImported: number; total: number; cursor: string | null };
        total += data.pageImported;
        cursor = data.cursor;
        setFeedback(`Import en cours… ${total} tracks`);
      } while (cursor !== null && total < maxTracks);

      // 2. Enrichissement automatique (genres + audio features)
      if (total > 0) {
        setFeedback(`Import terminé (${total}). Enrichissement en cours…`);
        let enriched = 0;
        let remaining = Infinity;
        while (remaining > 0) {
          const res = await fetch("/api/tracks/enrich", { method: "POST" });
          const data = (await res.json()) as { enriched: number; failed: number; remaining: number };
          enriched += data.enriched;
          remaining = data.remaining;
          if (data.enriched === 0) break;
          setFeedback(`Enrichissement… ${enriched} tracks`);
        }
        flash(`${total} importés · ${enriched} enrichis`);
      } else {
        flash(`Import terminé — aucun nouveau track`);
      }

      await loadStats();
    } catch {
      flash("Erreur lors de l'import");
    } finally {
      setBusy(false);
    }
  }

  function handleImportSubmit() {
    const value = importMode === "months"
      ? Math.max(0, parseInt(importMonths, 10) || 0)
      : Math.max(1, parseInt(importSongs, 10) || 1);
    void importAll(importMode, value);
  }

  async function resetNeedsReview() {
    setBusy(true);
    try {
      const res = await fetch("/api/tracks/reset-needs-review", { method: "POST" });
      const data = (await res.json()) as { reset: number };
      flash(`${data.reset} track${data.reset !== 1 ? "s" : ""} remis en file — relance le classifier`);
      await loadStats();
    } catch {
      flash("Erreur lors du reset");
    } finally {
      setBusy(false);
    }
  }

  async function enrichTracks() {
    setBusy(true);
    let enriched = 0;
    let remaining = Infinity;
    try {
      while (remaining > 0) {
        const res = await fetch("/api/tracks/enrich", { method: "POST" });
        const data = (await res.json()) as { enriched: number; failed: number; remaining: number };
        enriched += data.enriched;
        remaining = data.remaining;
        if (data.enriched === 0) break;
        setFeedback(`Enrichissement… ${enriched} tracks`);
      }
      flash(`Enrichissement terminé — ${enriched} track${enriched !== 1 ? "s" : ""}`);
      await loadStats();
    } catch {
      flash("Erreur lors de l'enrichissement");
    } finally {
      setBusy(false);
    }
  }

  async function runClassify(skipLlm = false) {
    setBusy(true);
    setClassifyProgress(null);
    let totalClassified = 0;
    let totalReview = 0;
    let totalErrors = 0;
    let grandTotal = 0;
    try {
      let remaining = Infinity;
      while (remaining > 0) {
        const res = await fetch("/api/classify/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skipLlm }),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          flash(`Erreur classifier (HTTP ${res.status}) : ${msg}`);
          break;
        }
        const data = (await res.json()) as {
          classified: number;
          needs_review: number;
          batch_size: number;
          remaining: number;
          total: number;
          errors: string[];
        };
        totalClassified += data.classified;
        totalReview += data.needs_review;
        totalErrors += data.errors.length;
        remaining = data.remaining;
        if (grandTotal === 0) grandTotal = data.total;
        const done = grandTotal - remaining;
        setClassifyProgress({ done, total: grandTotal });
        if (data.batch_size === 0) break;
      }
      const errPart = totalErrors > 0 ? ` · ${totalErrors} erreur${totalErrors > 1 ? "s" : ""}` : "";
      flash(`Terminé — ${totalClassified} classifiés · ${totalReview} en review${errPart}`);
      await loadStats();
    } catch (err) {
      flash(`Erreur : ${String(err)}`);
    } finally {
      setBusy(false);
      setClassifyProgress(null);
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
        <button
          disabled={busy}
          onClick={() => setImportPanelOpen((o) => !o)}
          className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Import historique {importPanelOpen ? "▴" : "▾"}
        </button>
        <ActionBtn
          label="Enrichir les tracks"
          onClick={enrichTracks}
          disabled={busy}
        />
        <ActionBtn
          label="Reset needs_review"
          onClick={resetNeedsReview}
          disabled={busy}
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

      {/* ── Import panel ───────────────────────────────────────────────────── */}
      {importPanelOpen && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-4">
          {/* Mode selector */}
          <div className="flex gap-4 text-sm">
            {(["months", "songs"] as ImportMode[]).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value={m}
                  checked={importMode === m}
                  onChange={() => setImportMode(m)}
                  className="accent-neutral-400"
                />
                <span className={importMode === m ? "text-white" : "text-neutral-400"}>
                  {m === "months" ? "Par mois" : "Par nombre de sons"}
                </span>
              </label>
            ))}
          </div>

          {/* Value input */}
          <div className="flex items-center gap-3">
            {importMode === "months" ? (
              <>
                <input
                  type="number"
                  min={0}
                  value={importMonths}
                  onChange={(e) => setImportMonths(e.target.value)}
                  className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
                <span className="text-sm text-neutral-400">mois</span>
                <span className="text-xs text-neutral-600">
                  {importMonths === "0" || importMonths === ""
                    ? "(tout l'historique)"
                    : `≈ ${parseInt(importMonths, 10) * 30} derniers jours`}
                </span>
              </>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={importSongs}
                  onChange={(e) => setImportSongs(e.target.value)}
                  className="w-28 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
                <span className="text-sm text-neutral-400">sons les plus récents</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleImportSubmit}
              className="rounded-lg bg-neutral-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-neutral-500"
            >
              Lancer l'import
            </button>
            <button
              onClick={() => setImportPanelOpen(false)}
              className="rounded-lg border border-neutral-700 px-4 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800"
            >
              Annuler
            </button>
          </div>
        </div>
      )}


      {/* Classify progress */}
      {classifyProgress && classifyProgress.total > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-green-600 transition-all duration-300"
              style={{ width: `${Math.round((classifyProgress.done / classifyProgress.total) * 100)}%` }}
            />
          </div>
          <p className="text-right text-xs tabular-nums text-neutral-500">
            {classifyProgress.done} / {classifyProgress.total}
          </p>
        </div>
      )}
      {/* ── Feedback + last sync ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{feedback ?? " "}</span>
        <span>Dernière sync : {relativeTime(stats?.last_sync_at ?? null)}</span>
      </div>
    </div>
  );
}
