"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  total: number;
  synced: number;
  not_synced: number;
  enabled: boolean;
  priority: number;
}

const SWATCH = ["#c89840","#8878d0","#6a9070","#c87a52","#a06848","#508860","#7878b0","#c08060"];
function playlistSwatch(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return SWATCH[h % SWATCH.length];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne après-midi";
  return "Bonsoir";
}

export default function HomeClient({
  playlists: initial,
  firstName,
}: {
  playlists: Playlist[];
  firstName: string;
}) {
  const [playlists, setPlaylists] = useState(initial);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bottomSheet, setBottomSheet] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d: { needs_review?: number; imported?: number }) => {
        setInboxCount(d.needs_review ?? 0);
        setImported(d.imported ?? null);
      })
      .catch(() => { setInboxCount(0); });
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }
  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback((f) => (f === msg ? null : f)), 5000);
  }

  async function importRecent() {
    setBusy("import");
    try {
      const res = await fetch("/api/tracks/import-recent", { method: "POST" });
      const data = (await res.json()) as { imported: number; already_existing: number };
      setImported((prev) => (prev ?? 0) + data.imported);
      showFeedback(`${data.imported} nouveau${data.imported !== 1 ? "x" : ""} · ${data.already_existing} déjà présents`);
    } catch {
      showFeedback("Erreur import");
    } finally {
      setBusy(null);
    }
  }

  async function runClassify() {
    setBusy("classify");
    try {
      const res = await fetch("/api/classify/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipLlm: false }),
      });
      const data = (await res.json()) as { classified: number; needs_review: number; remaining: number };
      setInboxCount(data.needs_review);
      showFeedback(`${data.classified} classifiés · ${data.needs_review} en review`);
    } catch {
      showFeedback("Erreur classifier");
    } finally {
      setBusy(null);
    }
  }

  async function syncPlaylist(id: string) {
    setSyncing(id);
    setBottomSheet(null);
    try {
      const res = await fetch(`/api/playlists/${id}/sync`, { method: "POST" });
      const data = (await res.json()) as { synced: number };
      setPlaylists((prev) =>
        prev.map((p) => p.id === id ? { ...p, not_synced: Math.max(0, p.not_synced - data.synced) } : p)
      );
      showToast(`${data.synced} track${data.synced > 1 ? "s" : ""} syncé${data.synced > 1 ? "s" : ""}`);
    } catch {
      showToast("Erreur sync");
    } finally {
      setSyncing(null);
    }
  }

  const totalPending = playlists.reduce((s, p) => s + p.not_synced, 0);
  const bsPlaylist = bottomSheet ? playlists.find((p) => p.id === bottomSheet) : null;

  return (
    <main className="s-page">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 300, color: "var(--ink-mid)", marginBottom: 8 }}>
          {greeting()}{firstName ? ", " : ""}
          <span style={{ color: "var(--terra)", fontWeight: 400 }}>{firstName}</span>
        </div>
        <h1 className="font-fraunces s-page-h1" style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}>
          Tout va{" "}
          <em style={{ fontStyle: "italic", color: "var(--terra)" }}>bien</em>{" "}
          tourner.
        </h1>

        {/* Stats compactes */}
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--ink-dim)" }}>
          {imported !== null && <span>{imported} tracks importés</span>}
          {inboxCount !== null && inboxCount > 0 && <span style={{ color: "var(--terra)" }}>{inboxCount} en inbox</span>}
          {totalPending > 0 && <span style={{ color: "var(--amber)" }}>{totalPending} en attente de sync</span>}
          <span style={{ color: "var(--sage)" }}>{playlists.length} playlist{playlists.length !== 1 ? "s" : ""} actives</span>
        </div>
      </div>

      {/* Actions */}
      <div className="s-home-actions">
        <button className="s-btn" onClick={() => void importRecent()} disabled={!!busy}>
          {busy === "import" ? "Import…" : "Importer les nouveaux"}
        </button>
        <button className="s-btn" onClick={() => void runClassify()} disabled={!!busy}>
          {busy === "classify" ? "Classifier…" : "Classifier"}
        </button>
        {feedback && (
          <span style={{ fontSize: 11, color: "var(--ink-dim)", alignSelf: "center" }}>{feedback}</span>
        )}
      </div>

      {/* Inbox banner */}
      {inboxCount !== null && inboxCount > 0 && (
        <Link
          href="/inbox"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--terra-light)", border: "1px solid var(--terra-border)",
            borderRadius: 14, padding: "14px 20px", textDecoration: "none", marginBottom: 28,
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--terra)" }}>
              {inboxCount} track{inboxCount > 1 ? "s" : ""} à revoir
            </p>
            <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>Aller dans l'inbox →</p>
          </div>
          <span className="font-fraunces" style={{ fontSize: 32, fontWeight: 600, color: "var(--terra)", lineHeight: 1, opacity: 0.7 }}>
            {inboxCount}
          </span>
        </Link>
      )}

      {/* Playlists header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="s-section-title" style={{ marginBottom: 0 }}>Playlists</div>
        <Link href="/playlists" className="s-btn s-btn-primary" style={{ textDecoration: "none" }}>
          + Nouvelle
        </Link>
      </div>

      {/* Playlists — grid desktop / list mobile */}
      {playlists.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 12, color: "var(--ink-mid)", fontSize: 13, textAlign: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p>Aucune playlist active</p>
          <Link href="/playlists" className="s-btn s-btn-primary" style={{ textDecoration: "none" }}>Créer une playlist</Link>
        </div>
      ) : (
        <div className="s-home-grid">
          {playlists.map((pl) => {
            const color = playlistSwatch(pl.id);
            return (
              <div
                key={pl.id}
                style={{
                  background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)",
                  overflow: "hidden", boxShadow: "var(--shadow)", transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                {/* Swatch bar */}
                <div style={{ height: 3, background: color, opacity: 0.85 }} />

                {/* Desktop card body */}
                <div className="s-home-card-body">
                  <Link href={`/playlists/${pl.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <p className="font-fraunces" style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2, marginBottom: 4 }}>
                      {pl.name}
                    </p>
                    {pl.description && (
                      <p style={{ fontSize: 11, color: "var(--ink-dim)", lineHeight: 1.4, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {pl.description}
                      </p>
                    )}
                    <p className="font-fraunces" style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>
                      {pl.total}
                      <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, fontWeight: 400, color: "var(--ink-dim)", marginLeft: 5 }}>tracks</span>
                    </p>
                  </Link>

                  {/* Actions — desktop inline, mobile via bottom sheet */}
                  <div className="s-home-card-actions">
                    {pl.not_synced > 0 && (
                      <button
                        className="s-btn s-btn-sm"
                        disabled={syncing === pl.id}
                        onClick={() => void syncPlaylist(pl.id)}
                        style={{ color: "var(--terra)", borderColor: "var(--terra-border)" }}
                      >
                        {syncing === pl.id ? "…" : `Sync ${pl.not_synced}`}
                      </button>
                    )}
                    {/* Desktop: direct link */}
                    <Link href={`/playlists/${pl.id}`} className="s-btn s-btn-sm s-home-detail-btn" style={{ textDecoration: "none" }}>
                      Voir →
                    </Link>
                    {/* Mobile: ⋯ bottom sheet */}
                    <button
                      className="s-btn s-home-menu-btn"
                      onClick={() => setBottomSheet(pl.id)}
                      aria-label="Options"
                      style={{ fontSize: 16, padding: "4px 10px" }}
                    >
                      ⋯
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom sheet — mobile */}
      {bsPlaylist && (
        <>
          <div className="s-bs-backdrop" onClick={() => setBottomSheet(null)} />
          <div className="s-bs" role="dialog" aria-modal="true">
            <div className="s-bs-handle" />
            <p className="s-bs-title" style={{ color: playlistSwatch(bsPlaylist.id) }}>{bsPlaylist.name}</p>
            {bsPlaylist.not_synced > 0 && (
              <button className="s-bs-item" disabled={syncing === bsPlaylist.id} onClick={() => void syncPlaylist(bsPlaylist.id)}>
                {syncing === bsPlaylist.id ? "Sync…" : `Sync (${bsPlaylist.not_synced} en attente)`}
              </button>
            )}
            <Link href={`/playlists/${bsPlaylist.id}`} className="s-bs-item" style={{ textDecoration: "none", color: "inherit" }}>
              Voir les tracks →
            </Link>
            <div className="s-bs-sep" style={{ marginTop: 4 }} />
            <button className="s-bs-item s-bs-item-dim" onClick={() => setBottomSheet(null)}>Annuler</button>
          </div>
        </>
      )}

      {toast && <div className="s-toast">{toast}</div>}
    </main>
  );
}
