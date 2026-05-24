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
  return (
    <button
      className={`s-btn${variant === "danger" ? " s-btn-danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
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
    const value =
      importMode === "months"
        ? Math.max(0, parseInt(importMonths, 10) || 0)
        : Math.max(1, parseInt(importSongs, 10) || 1);
    void importAll(importMode, value);
  }

  async function resetNeedsReview() {
    setBusy(true);
    try {
      const res = await fetch("/api/tracks/reset-needs-review", { method: "POST" });
      const data = (await res.json()) as { reset: number };
      flash(`${data.reset} track${data.reset !== 1 ? "s" : ""} remis en file`);
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
    setClassifyProgress({ done: 0, total: 0 });
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
      window.dispatchEvent(new CustomEvent("classify:complete"));
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
      setStats((s) => (s ? { ...s, cron_enabled: data.cron_enabled } : s));
      flash(`Cron hebdo ${data.cron_enabled ? "activé" : "désactivé"}`);
    } catch {
      flash("Erreur");
    } finally {
      setBusy(false);
    }
  }

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stat cards */}
      <div className="s-stats-grid">
        <StatCard label="Inbox" value={stats?.needs_review ?? 0} sub="à valider" accent />
        <StatCard label="Classifiés" value={stats?.in_playlists ?? 0} sub="au total" />
        <StatCard label="Importés" value={stats?.imported ?? 0} sub={stats?.spotify_total ? `/ ${stats.spotify_total}` : undefined} />
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

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionBtn label="Importer les nouveaux" onClick={importRecent} disabled={busy} />
        <button
          disabled={busy}
          onClick={() => setImportPanelOpen((o) => !o)}
          className="s-btn"
        >
          Import historique {importPanelOpen ? "▴" : "▾"}
        </button>
        <ActionBtn label="Enrichir les tracks" onClick={enrichTracks} disabled={busy} />
        <ActionBtn label="Reset needs_review" onClick={resetNeedsReview} disabled={busy} />
        <ActionBtn label="Classifier (LLM)" onClick={() => runClassify(false)} disabled={busy} />
        <ActionBtn label="Classifier rapide" onClick={() => runClassify(true)} disabled={busy} />
        <ActionBtn
          label={stats?.cron_enabled ? "Désactiver cron" : "Activer cron hebdo"}
          onClick={toggleCron}
          disabled={busy}
        />
      </div>

      {/* Import panel */}
      {importPanelOpen && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            {(["months", "songs"] as ImportMode[]).map((m) => (
              <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="importMode"
                  value={m}
                  checked={importMode === m}
                  onChange={() => setImportMode(m)}
                  style={{ accentColor: "var(--terra)" }}
                />
                <span style={{ color: importMode === m ? "var(--ink)" : "var(--ink-mid)" }}>
                  {m === "months" ? "Par mois" : "Par nombre de sons"}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {importMode === "months" ? (
              <>
                <input
                  type="number"
                  min={0}
                  value={importMonths}
                  onChange={(e) => setImportMonths(e.target.value)}
                  className="s-input"
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>mois</span>
                <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>
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
                  className="s-input"
                  style={{ width: 96 }}
                />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>sons les plus récents</span>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleImportSubmit} className="s-btn s-btn-primary">
              Lancer l'import
            </button>
            <button onClick={() => setImportPanelOpen(false)} className="s-btn">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Classify progress */}
      {classifyProgress && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ height: 2, borderRadius: 2, background: "var(--border-strong)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: "var(--sage)",
                transition: classifyProgress.total === 0 ? "none" : "width 0.3s",
                width: classifyProgress.total === 0
                  ? "100%"
                  : `${Math.round((classifyProgress.done / classifyProgress.total) * 100)}%`,
                animation: classifyProgress.total === 0 ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            />
          </div>
          <p style={{ textAlign: "right", fontSize: 10, color: "var(--ink-dim)" }}>
            {classifyProgress.total === 0 ? "…" : `${classifyProgress.done} / ${classifyProgress.total}`}
          </p>
        </div>
      )}

      {/* Feedback */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-dim)" }}>
        <span style={{ color: feedback ? "var(--terra)" : "transparent" }}>{feedback ?? "·"}</span>
        <span>Dernière sync : {relativeTime(stats?.last_sync_at ?? null)}</span>
      </div>
    </div>
  );
}
