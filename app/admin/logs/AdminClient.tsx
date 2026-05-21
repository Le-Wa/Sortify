"use client";

import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  total_classified: number;
  auto_classified: number;
  needs_review_total: number;
  corrections: number;
  correction_rate: number;
  needs_review_rate: number;
  by_playlist: {
    playlist: string;
    classified: number;
    corrections: number;
    correction_rate: number;
    avg_confidence: number | null;
  }[];
  by_level: Record<string, number>;
}

interface AdminReport {
  last_cron_at: string | null;
  cron_overdue: boolean;
  last_run: {
    ran_at?: string;
    imported: number;
    already_existing: number;
    enriched: number;
    enrichment_failures: number;
    classified_auto: number;
    needs_review: number;
    errors: string[];
  } | null;
}

interface PlaylistDetail {
  id: string;
  name: string;
  confidence: number;
}

interface AdminLog {
  id: string;
  track_id: string;
  track_name: string | null;
  artist_name: string | null;
  enriched: boolean;
  level_used: number;
  suggested: string | null;
  confidence: number;
  reason: string | null;
  corrected_to: string | null;
  playlists_detail: PlaylistDetail[] | null;
  created_at: string;
}

interface Playlist {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LevelBadge({ level }: { level: number }) {
  const styles: Record<number, string> = {
    0: "bg-neutral-700 text-neutral-300",
    1: "bg-blue-900 text-blue-200",
    2: "bg-purple-900 text-purple-200",
    3: "bg-emerald-900 text-emerald-200",
  };
  const labels: Record<number, string> = { 0: "MAN", 1: "L1", 2: "L2", 3: "L3" };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${styles[level] ?? styles[0]}`}>
      {labels[level] ?? `L${level}`}
    </span>
  );
}

// ── Section 1 sub-components ──────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-600">{sub}</p>}
    </div>
  );
}

// ── Section 3 — Level bar ─────────────────────────────────────────────────────

function LevelBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pctVal = total > 0 ? count / total : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-8 font-mono text-xs text-neutral-400">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-neutral-800 h-3">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pctVal * 100}%` }} />
      </div>
      <span className="w-16 text-right tabular-nums text-xs text-neutral-400">
        {count} <span className="text-neutral-600">({Math.round(pctVal * 100)}%)</span>
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminClient() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [filterPlaylistId, setFilterPlaylistId] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterCorrectionsOnly, setFilterCorrectionsOnly] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const PER_PAGE = 50;

  // Load stats + report + playlists on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/report").then((r) => r.json()),
      fetch("/api/playlists").then((r) => r.json()),
    ]).then(([s, rep, pl]) => {
      setStats(s as AdminStats);
      setReport(rep as AdminReport);
      setPlaylists(pl as Playlist[]);
      setLoadingStats(false);
    }).catch(() => setLoadingStats(false));
  }, []);

  // Fetch logs on mount and filter change
  useEffect(() => {
    let cancelled = false;
    setLoadingLogs(true);
    const p = buildLogParams(1);
    fetch(`/api/admin/logs?${p}`)
      .then((r) => r.json())
      .then((data: { logs: AdminLog[]; total: number }) => {
        if (cancelled) return;
        setLogs(data.logs);
        setLogTotal(data.total);
        setLogPage(1);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingLogs(false); });
    return () => { cancelled = true; };
  }, [filterPlaylistId, filterLevel, filterCorrectionsOnly, filterFrom, filterTo]);

  function buildLogParams(page: number): URLSearchParams {
    const p = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (filterPlaylistId) p.set("playlist_id", filterPlaylistId);
    if (filterLevel) p.set("level", filterLevel);
    if (filterCorrectionsOnly) p.set("corrections_only", "true");
    if (filterFrom) p.set("from", filterFrom);
    if (filterTo) p.set("to", filterTo);
    return p;
  }

  async function loadMoreLogs() {
    const nextPage = logPage + 1;
    const res = await fetch(`/api/admin/logs?${buildLogParams(nextPage)}`);
    const data: { logs: AdminLog[]; total: number } = await res.json();
    setLogs((prev) => [...prev, ...data.logs]);
    setLogPage(nextPage);
  }

  const hasMoreLogs = logTotal > logPage * PER_PAGE;

  const levelTotal = stats
    ? (stats.by_level["1"] ?? 0) + (stats.by_level["2"] ?? 0) + (stats.by_level["3"] ?? 0)
    : 0;
  const l3Pct = levelTotal > 0 ? (stats?.by_level["3"] ?? 0) / levelTotal : 0;

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Admin — Qualité du classifier</h1>

      {/* ── Section 1 — Stats globales ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Stats globales
        </h2>

        {/* Cron overdue alert */}
        {report?.cron_overdue && (
          <div className="rounded-lg border border-yellow-800 bg-yellow-950 px-4 py-3 text-sm text-yellow-300">
            ⚠️ Cron non déclenché depuis plus de 8 jours
            {report.last_cron_at && (
              <span className="ml-2 text-yellow-600">
                (dernier : {formatDate(report.last_cron_at)})
              </span>
            )}
          </div>
        )}

        {loadingStats ? (
          <div className="h-20 animate-pulse rounded-xl bg-neutral-900" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Classifiés auto" value={stats?.auto_classified ?? 0} />
              <StatCard label="Taux needs_review" value={pct(stats?.needs_review_rate ?? 0)} />
              <StatCard label="Corrections" value={stats?.corrections ?? 0} />
              <StatCard label="Taux correction" value={pct(stats?.correction_rate ?? 0)} />
            </div>

            {/* Last cron run */}
            {report?.last_run && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <p className="mb-3 text-xs font-medium text-neutral-400">
                  Dernier cron{" "}
                  {report.last_run.ran_at && (
                    <span className="text-neutral-600">— {formatDate(report.last_run.ran_at)}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    ["Importés", report.last_run.imported],
                    ["Déjà existants", report.last_run.already_existing],
                    ["Enrichis", report.last_run.enriched],
                    ["Échecs enrichissement", report.last_run.enrichment_failures],
                    ["Classifiés auto", report.last_run.classified_auto],
                    ["Needs review", report.last_run.needs_review],
                  ].map(([label, val]) => (
                    <div key={label as string} className="text-center">
                      <p className="text-lg font-bold tabular-nums">{val}</p>
                      <p className="text-xs text-neutral-500">{label}</p>
                    </div>
                  ))}
                </div>
                {report.last_run.errors.length > 0 && (
                  <div className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">
                    {report.last_run.errors.length} erreur(s) : {report.last_run.errors.slice(0, 3).join(" · ")}
                    {report.last_run.errors.length > 3 && " …"}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Section 2 — Qualité par playlist ─────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Qualité par playlist
        </h2>
        {loadingStats ? (
          <div className="h-40 animate-pulse rounded-xl bg-neutral-900" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-left text-xs text-neutral-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Playlist</th>
                  <th className="px-4 py-2.5 text-right font-medium">Classifiés</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conf. moy.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Corrections</th>
                  <th className="px-4 py-2.5 text-right font-medium">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {(stats?.by_playlist ?? []).map((row) => (
                  <tr key={row.playlist} className="bg-neutral-900">
                    <td className="px-4 py-3 font-medium">{row.playlist}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                      {row.classified}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {row.avg_confidence !== null
                        ? `${Math.round(row.avg_confidence * 100)} %`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {row.corrections}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.correction_rate > 0.05
                            ? "bg-red-900 text-red-300"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {pct(row.correction_rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 3 — Distribution par level ──────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Distribution par level
        </h2>
        {l3Pct > 0.3 && (
          <p className="rounded-lg border border-yellow-800 bg-yellow-950 px-3 py-2 text-xs text-yellow-300">
            ⚠️ L3 représente {Math.round(l3Pct * 100)}% des tracks — revoir les règles L1/L2
          </p>
        )}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
          {[
            { key: "1", label: "L1", color: "bg-blue-700" },
            { key: "2", label: "L2", color: "bg-purple-700" },
            { key: "3", label: "L3", color: "bg-emerald-700" },
          ].map(({ key, label, color }) => (
            <LevelBar
              key={key}
              label={label}
              count={stats?.by_level[key] ?? 0}
              total={levelTotal}
              color={color}
            />
          ))}
        </div>
      </section>

      {/* ── Section 4 — Log table ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Logs de classification
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            value={filterPlaylistId}
            onChange={(e) => setFilterPlaylistId(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-300"
          >
            <option value="">Toutes les playlists</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-300"
          >
            <option value="">Tous les niveaux</option>
            <option value="1">L1 — Règles</option>
            <option value="2">L2 — Centroid</option>
            <option value="3">L3 — LLM</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={filterCorrectionsOnly}
              onChange={(e) => setFilterCorrectionsOnly(e.target.checked)}
              className="accent-neutral-400"
            />
            Corrections seulement
          </label>

          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300"
          />
          <span className="text-neutral-600">→</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300"
          />

          {(filterPlaylistId || filterLevel || filterCorrectionsOnly || filterFrom || filterTo) && (
            <button
              onClick={() => {
                setFilterPlaylistId("");
                setFilterLevel("");
                setFilterCorrectionsOnly(false);
                setFilterFrom("");
                setFilterTo("");
              }}
              className="text-xs text-neutral-500 hover:text-white"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <p className="text-xs text-neutral-600">
          {loadingLogs ? "Chargement…" : `${logTotal} entrée(s)`}
        </p>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          {logs.length === 0 && !loadingLogs ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-500">Aucun log trouvé</p>
          ) : (
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-neutral-800 text-left text-xs text-neutral-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Track</th>
                  <th className="px-4 py-2.5 font-medium">Enrichi</th>
                  <th className="px-4 py-2.5 font-medium">Niv.</th>
                  <th className="px-4 py-2.5 font-medium">Suggestion</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conf.</th>
                  <th className="px-4 py-2.5 font-medium">Raison</th>
                  <th className="px-4 py-2.5 font-medium">Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {logs.map((row) => (
                  <tr key={row.id} className="bg-neutral-900 hover:bg-neutral-800/50">
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      <p className="truncate font-medium text-white">
                        {row.artist_name && (
                          <span className="font-normal text-neutral-400">{row.artist_name} — </span>
                        )}
                        {row.track_name ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.enriched ? (
                        <span className="text-xs font-medium text-green-500">✓</span>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LevelBadge level={row.level_used} />
                    </td>
                    <td className="px-4 py-3">
                      {row.playlists_detail?.length ? (
                        <div className="space-y-0.5">
                          {row.playlists_detail.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              <span className={p.confidence >= 0.6 ? "text-white" : "text-neutral-500"}>
                                {p.name}
                              </span>
                              <span className={`tabular-nums font-medium ${
                                p.confidence >= 0.6 ? "text-emerald-400" : p.confidence >= 0.3 ? "text-yellow-500" : "text-red-500"
                              }`}>
                                {Math.round(p.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-300">{row.suggested ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {row.playlists_detail?.length ? "—" : `${Math.round(row.confidence * 100)} %`}
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p
                        className="truncate text-xs text-neutral-500"
                        title={row.reason ?? ""}
                      >
                        {row.reason ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-400">
                      {row.corrected_to ?? <span className="text-neutral-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {hasMoreLogs && (
          <button
            onClick={loadMoreLogs}
            className="w-full rounded-lg border border-neutral-700 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800"
          >
            Charger plus
          </button>
        )}
      </section>
    </div>
  );
}
