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

// ── Sub-components ────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: number }) {
  const styles: Record<number, React.CSSProperties> = {
    0: { background: "var(--surface3)", color: "var(--ink-mid)", border: "1px solid var(--border-strong)" },
    1: { background: "var(--sage-light)", color: "var(--sage)", border: "1px solid var(--sage-border)" },
    2: { background: "var(--amber-light)", color: "var(--amber)", border: "1px solid rgba(200,152,64,0.25)" },
    3: { background: "var(--terra-light)", color: "var(--terra)", border: "1px solid var(--terra-border)" },
  };
  const labels: Record<number, string> = { 0: "MAN", 1: "L1", 2: "L2", 3: "L3" };
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 6,
        padding: "1px 7px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
        ...(styles[level] ?? styles[0]),
      }}
    >
      {labels[level] ?? `L${level}`}
    </span>
  );
}

function AdminStatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="s-stat-card">
      <p style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 6 }}>{label}</p>
      <p
        className="font-fraunces"
        style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-1px", lineHeight: 1, color: "var(--ink)" }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function LevelBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pctVal = total > 0 ? count / total : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          width: 28,
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 600,
          color: "var(--ink-mid)",
          fontFamily: "var(--font-geist-mono)",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          borderRadius: 4,
          background: "var(--surface3)",
          height: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 4,
            background: color,
            transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            width: `${pctVal * 100}%`,
          }}
        />
      </div>
      <span
        style={{
          width: 72,
          textAlign: "right",
          fontSize: 10,
          color: "var(--ink-dim)",
          flexShrink: 0,
        }}
      >
        {count}{" "}
        <span style={{ color: "var(--ink-dimmer)" }}>({Math.round(pctVal * 100)}%)</span>
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

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/report").then((r) => r.json()),
      fetch("/api/playlists").then((r) => r.json()),
    ])
      .then(([s, rep, pl]) => {
        setStats(s as AdminStats);
        setReport(rep as AdminReport);
        setPlaylists(pl as Playlist[]);
        setLoadingStats(false);
      })
      .catch(() => setLoadingStats(false));
  }, []);

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
      .finally(() => {
        if (!cancelled) setLoadingLogs(false);
      });
    return () => {
      cancelled = true;
    };
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
  const hasFilters = !!(filterPlaylistId || filterLevel || filterCorrectionsOnly || filterFrom || filterTo);

  const levelTotal = stats
    ? (stats.by_level["1"] ?? 0) + (stats.by_level["2"] ?? 0) + (stats.by_level["3"] ?? 0)
    : 0;
  const l3Pct = levelTotal > 0 ? (stats?.by_level["3"] ?? 0) / levelTotal : 0;

  const skeletonStyle: React.CSSProperties = {
    borderRadius: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    animation: "pulse 1.5s ease-in-out infinite",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

      {/* Page title */}
      <div>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>Admin</div>
        <h1
          className="font-fraunces s-page-h1"
          style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}
        >
          Qualité du{" "}
          <em style={{ fontStyle: "italic", color: "var(--terra)" }}>classifier</em>
        </h1>
      </div>

      {/* ── Section 1 — Stats globales ──────────────────────────────────────── */}
      <section>
        <div className="s-section-title">Stats globales</div>

        {report?.cron_overdue && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(200,152,64,0.3)",
              background: "rgba(200,152,64,0.08)",
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--amber)",
              marginBottom: 16,
            }}
          >
            Cron non déclenché depuis plus de 8 jours
            {report.last_cron_at && (
              <span style={{ color: "rgba(200,152,64,0.6)", marginLeft: 8 }}>
                — dernier : {formatDate(report.last_cron_at)}
              </span>
            )}
          </div>
        )}

        {loadingStats ? (
          <div className="s-stats-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ ...skeletonStyle, height: 88 }} />
            ))}
          </div>
        ) : (
          <>
            <div className="s-stats-grid">
              <AdminStatCard label="Classifiés auto" value={stats?.auto_classified ?? 0} />
              <AdminStatCard label="Taux needs_review" value={pct(stats?.needs_review_rate ?? 0)} />
              <AdminStatCard label="Corrections" value={stats?.corrections ?? 0} />
              <AdminStatCard label="Taux correction" value={pct(stats?.correction_rate ?? 0)} />
            </div>

            {report?.last_run && (
              <div
                style={{
                  marginTop: 16,
                  background: "var(--surface)",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  padding: "16px 20px",
                  boxShadow: "var(--shadow)",
                }}
              >
                <p style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 14 }}>
                  Dernier cron
                  {report.last_run.ran_at && (
                    <span style={{ color: "var(--ink-dimmer)", marginLeft: 6 }}>
                      — {formatDate(report.last_run.ran_at)}
                    </span>
                  )}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                  {(
                    [
                      ["Importés", report.last_run.imported],
                      ["Déjà existants", report.last_run.already_existing],
                      ["Enrichis", report.last_run.enriched],
                      ["Échecs enrichissement", report.last_run.enrichment_failures],
                      ["Classifiés auto", report.last_run.classified_auto],
                      ["Needs review", report.last_run.needs_review],
                    ] as [string, number][]
                  ).map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <p
                        className="font-fraunces"
                        style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}
                      >
                        {val}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}>{label}</p>
                    </div>
                  ))}
                </div>
                {report.last_run.errors.length > 0 && (
                  <div
                    style={{
                      marginTop: 14,
                      borderRadius: 8,
                      background: "var(--terra-light)",
                      border: "1px solid var(--terra-border)",
                      padding: "8px 12px",
                      fontSize: 11,
                      color: "var(--terra)",
                    }}
                  >
                    {report.last_run.errors.length} erreur(s) :{" "}
                    {report.last_run.errors.slice(0, 3).join(" · ")}
                    {report.last_run.errors.length > 3 && " …"}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Section 2 — Qualité par playlist ─────────────────────────────────── */}
      <section>
        <div className="s-section-title">Qualité par playlist</div>
        {loadingStats ? (
          <div style={{ ...skeletonStyle, height: 160 }} />
        ) : (
          <div className="s-table-wrap">
            <table className="s-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Playlist</th>
                  <th style={{ textAlign: "right" }}>Classifiés</th>
                  <th style={{ textAlign: "right" }}>Conf. moy.</th>
                  <th style={{ textAlign: "right" }}>Corrections</th>
                  <th style={{ textAlign: "right" }}>Taux</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.by_playlist ?? []).map((row) => (
                  <tr key={row.playlist}>
                    <td style={{ fontWeight: 500 }}>{row.playlist}</td>
                    <td style={{ textAlign: "right", color: "var(--ink-mid)" }}>{row.classified}</td>
                    <td style={{ textAlign: "right", color: "var(--ink-mid)" }}>
                      {row.avg_confidence !== null
                        ? `${Math.round(row.avg_confidence * 100)} %`
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--ink-mid)" }}>{row.corrections}</td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          borderRadius: 20,
                          padding: "2px 8px",
                          fontSize: 10,
                          fontWeight: 500,
                          ...(row.correction_rate > 0.05
                            ? {
                                background: "var(--terra-light)",
                                color: "var(--terra)",
                                border: "1px solid var(--terra-border)",
                              }
                            : {
                                background: "var(--surface2)",
                                color: "var(--ink-dim)",
                                border: "1px solid var(--border-strong)",
                              }),
                        }}
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
      <section>
        <div className="s-section-title">Distribution par level</div>
        {l3Pct > 0.3 && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 10,
              border: "1px solid rgba(200,152,64,0.3)",
              background: "rgba(200,152,64,0.08)",
              padding: "8px 14px",
              fontSize: 11,
              color: "var(--amber)",
            }}
          >
            L3 représente {Math.round(l3Pct * 100)}% des tracks — revoir les règles L1/L2
          </div>
        )}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 14,
            border: "1px solid var(--border)",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: "var(--shadow)",
          }}
        >
          {[
            { key: "1", label: "L1", color: "var(--sage)" },
            { key: "2", label: "L2", color: "var(--amber)" },
            { key: "3", label: "L3", color: "var(--terra)" },
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

      {/* ── Section 4 — Logs ────────────────────────────────────────────────── */}
      <section>
        <div className="s-section-title">Logs de classification</div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <select
            value={filterPlaylistId}
            onChange={(e) => setFilterPlaylistId(e.target.value)}
            className="s-input"
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
            className="s-input"
          >
            <option value="">Tous les niveaux</option>
            <option value="1">L1 — Règles</option>
            <option value="2">L2 — Centroid</option>
            <option value="3">L3 — LLM</option>
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--ink-mid)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={filterCorrectionsOnly}
              onChange={(e) => setFilterCorrectionsOnly(e.target.checked)}
              style={{ accentColor: "var(--terra)" }}
            />
            Corrections seulement
          </label>

          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="s-input"
          />
          <span style={{ fontSize: 11, color: "var(--ink-dimmer)" }}>→</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="s-input"
          />

          {hasFilters && (
            <button
              onClick={() => {
                setFilterPlaylistId("");
                setFilterLevel("");
                setFilterCorrectionsOnly(false);
                setFilterFrom("");
                setFilterTo("");
              }}
              className="s-btn"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 10 }}>
          {loadingLogs ? "Chargement…" : `${logTotal} entrée(s)`}
        </p>

        {/* Table */}
        <div className="s-table-wrap">
          {logs.length === 0 && !loadingLogs ? (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 14,
                border: "1px solid var(--border)",
                padding: "40px 0",
                textAlign: "center",
                fontSize: 13,
                color: "var(--ink-mid)",
              }}
            >
              Aucun log trouvé
            </div>
          ) : (
            <table className="s-table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Track</th>
                  <th>Enrichi</th>
                  <th>Niv.</th>
                  <th>Suggestion</th>
                  <th style={{ textAlign: "right" }}>Conf.</th>
                  <th>Raison</th>
                  <th>Correction</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--ink-dim)", fontSize: 11 }}>
                      {formatDate(row.created_at)}
                    </td>
                    <td style={{ maxWidth: 180 }}>
                      <p
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                      >
                        {row.artist_name && (
                          <span style={{ fontWeight: 300, color: "var(--ink-mid)" }}>
                            {row.artist_name} —{" "}
                          </span>
                        )}
                        {row.track_name ?? "—"}
                      </p>
                    </td>
                    <td>
                      {row.enriched ? (
                        <span style={{ fontSize: 12, color: "var(--sage)" }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-dimmer)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <LevelBadge level={row.level_used} />
                    </td>
                    <td>
                      {row.playlists_detail?.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {row.playlists_detail.map((p) => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                              <span
                                style={{
                                  color: p.confidence >= 0.6 ? "var(--ink)" : "var(--ink-dim)",
                                }}
                              >
                                {p.name}
                              </span>
                              <span
                                style={{
                                  fontWeight: 500,
                                  color:
                                    p.confidence >= 0.6
                                      ? "var(--sage)"
                                      : p.confidence >= 0.3
                                        ? "var(--amber)"
                                        : "var(--terra)",
                                }}
                              >
                                {Math.round(p.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--ink-mid)" }}>{row.suggested ?? "—"}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--ink-mid)" }}>
                      {row.playlists_detail?.length ? "—" : `${Math.round(row.confidence * 100)} %`}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <p
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                          color: "var(--ink-dim)",
                        }}
                        title={row.reason ?? ""}
                      >
                        {row.reason ?? "—"}
                      </p>
                    </td>
                    <td style={{ color: "var(--amber)", fontSize: 11 }}>
                      {row.corrected_to ?? (
                        <span style={{ color: "var(--ink-dimmer)" }}>—</span>
                      )}
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
            className="s-btn"
            style={{ width: "100%", marginTop: 14, padding: "10px 0", justifyContent: "center" }}
          >
            Charger plus
          </button>
        )}
      </section>
    </div>
  );
}
