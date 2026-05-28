"use client";

import { useState } from "react";

type ImportMode = "months" | "songs";

interface Props {
  cronEnabled: boolean;
  importSince: number | null;
}

function nextMonday(): string {
  const d = new Date();
  const daysUntilMonday = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function SettingsClient({ cronEnabled: initialCron, importSince }: Props) {
  const [cron, setCron] = useState(initialCron);
  const [cronBusy, setCronBusy] = useState(false);

  const [importBusy, setImportBusy] = useState(false);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("months");
  const [importMonths, setImportMonths] = useState(String(importSince ?? 12));
  const [importSongs, setImportSongs] = useState("500");

  const [progress, setProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function flash(msg: string) {
    setProgress(null);
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 6000);
  }

  async function toggleCron() {
    setCronBusy(true);
    try {
      const res = await fetch("/api/users/cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !cron }),
      });
      const data = (await res.json()) as { cron_enabled: boolean };
      setCron(data.cron_enabled);
    } finally {
      setCronBusy(false);
    }
  }

  async function importRecent() {
    setImportBusy(true);
    setProgress("Import en cours…");
    try {
      const res = await fetch("/api/tracks/import-recent", { method: "POST" });
      const data = (await res.json()) as { imported: number; already_existing: number };
      flash(`${data.imported} nouveau${data.imported !== 1 ? "x" : ""} · ${data.already_existing} déjà présents`);
    } catch {
      flash("Erreur lors de l'import");
    } finally {
      setImportBusy(false);
    }
  }

  async function importAll() {
    setImportPanelOpen(false);
    setImportBusy(true);

    const months =
      importMode === "months" ? Math.max(0, parseInt(importMonths, 10) || 0) : 0;
    const maxTracks =
      importMode === "songs" ? Math.max(1, parseInt(importSongs, 10) || 1) : Infinity;

    let cursor: string | null = null;
    let total = 0;

    try {
      do {
        const res = await fetch("/api/tracks/import-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ months, cursor }),
        });
        const data = (await res.json()) as {
          pageImported: number;
          total: number;
          cursor: string | null;
        };
        total += data.pageImported;
        cursor = data.cursor;
        setProgress(`Import… ${total} tracks`);
      } while (cursor !== null && total < maxTracks);

      if (total > 0) {
        setProgress(`Import terminé (${total}). Enrichissement…`);
        let enriched = 0;
        let remaining = Infinity;
        while (remaining > 0) {
          const res = await fetch("/api/tracks/enrich", { method: "POST" });
          const data = (await res.json()) as { enriched: number; remaining: number };
          enriched += data.enriched;
          remaining = data.remaining;
          if (data.enriched === 0) break;
          setProgress(`Enrichissement… ${enriched} tracks`);
        }

        setProgress(`Enrichissement terminé. Classification…`);
        let classified = 0;
        let classifyRemaining = Infinity;
        while (classifyRemaining > 0) {
          const res = await fetch("/api/classify/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const data = (await res.json()) as {
            classified: number;
            needs_review: number;
            batch_size: number;
            remaining: number;
          };
          classified += data.classified + data.needs_review;
          classifyRemaining = data.remaining;
          if (data.batch_size === 0) break;
          setProgress(`Classification… ${classified} tracks`);
        }

        flash(`${total} importés · ${enriched} enrichis · ${classified} classifiés`);
      } else {
        flash("Aucun nouveau track");
      }
    } catch {
      flash("Erreur lors de l'import");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 560 }}>

      {/* ── Cron ── */}
      <section className="s-card" style={{ padding: "20px 22px" }}>
        <p className="s-section-title" style={{ marginBottom: 16 }}>Tri automatique</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Cron hebdomadaire</p>
            <p style={{ fontSize: 13, color: "var(--ink-mid)", marginTop: 2 }}>Chaque lundi · 08h00</p>
          </div>
          <button
            onClick={toggleCron}
            disabled={cronBusy}
            style={{
              position: "relative",
              width: 44,
              height: 24,
              borderRadius: 12,
              background: cron ? "var(--terra)" : "var(--border-strong)",
              border: "none",
              cursor: cronBusy ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              flexShrink: 0,
              opacity: cronBusy ? 0.6 : 1,
            }}
            role="switch"
            aria-checked={cron}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: cron ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: cron ? "#4a8a5a" : "var(--ink-dim)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
            {cron ? `Prochain run : ${nextMonday()}` : "Cron désactivé — aucun tri automatique"}
          </span>
        </div>
      </section>

      {/* ── Import ── */}
      <section className="s-card" style={{ padding: "20px 22px" }}>
        <p className="s-section-title" style={{ marginBottom: 16 }}>Import Spotify</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="s-btn"
              onClick={importRecent}
              disabled={importBusy}
              style={{ flex: 1 }}
            >
              Importer les nouveaux
            </button>
            <button
              className="s-btn"
              onClick={() => setImportPanelOpen((o) => !o)}
              disabled={importBusy}
            >
              Import historique {importPanelOpen ? "▴" : "▾"}
            </button>
          </div>

          {importPanelOpen && (
            <div
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 16px",
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
                    <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
                      {importMonths === "0" || importMonths === ""
                        ? "(tout l'historique)"
                        : `≈ ${parseInt(importMonths, 10) * 30} jours`}
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
                <button onClick={importAll} className="s-btn s-btn-primary">
                  Lancer l'import
                </button>
                <button onClick={() => setImportPanelOpen(false)} className="s-btn">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {(progress || feedback) && (
            <p style={{ fontSize: 13, color: feedback ? "var(--terra)" : "var(--ink-mid)", marginTop: 2 }}>
              {progress ?? feedback}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
