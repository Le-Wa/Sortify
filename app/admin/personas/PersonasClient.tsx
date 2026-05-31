"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Persona {
  id: string;
  spotify_id: string;
  email: string | null;
  onboarding_status: string;
  onboarding_step: number;
  onboarding_mode: string | null;
}

const STATUS_OPTIONS = [
  { value: "pending",     label: "🆕 Pending — landing page" },
  { value: "in_progress", label: "🔄 In progress — step S3+" },
  { value: "complete",    label: "✅ Complete — dans l'app" },
];

const MODE_OPTIONS = [
  { value: null,       label: "— (non défini)" },
  { value: "analyse",  label: "Analyse" },
  { value: "import",   label: "Import" },
  { value: "scratch",  label: "Scratch" },
];

export default function PersonasClient() {
  const { data: session } = useSession();
  const router = useRouter();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("pending");
  const [mode, setMode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dev/personas");
    setPersonas(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function activate(spotifyId: string) {
    setActivating(spotifyId);
    try {
      const res = await fetch("/api/dev/personas/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_id: spotifyId }),
      });
      const { token, error } = await res.json();
      if (error) { alert(error); return; }
      const result = await signIn("byok-handoff", { token, redirect: false });
      if (result?.ok) router.push("/onboarding");
    } finally {
      setActivating(null);
    }
  }

  async function remove(spotifyId: string) {
    if (!confirm("Supprimer ce persona ? Ses tracks et playlists seront aussi supprimés.")) return;
    setDeleting(spotifyId);
    await fetch(`/api/dev/personas?spotify_id=${encodeURIComponent(spotifyId)}`, { method: "DELETE" });
    await load();
    setDeleting(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/dev/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), status, mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setLabel("");
        await load();
        // Auto-activate if fresh
        if (status === "pending") {
          await activate(data.spotify_id);
        }
      }
    } finally {
      setCreating(false);
    }
  }

  const activeId = session?.userId;

  return (
    <main className="s-page" style={{ paddingBottom: 80 }}>
      <div className="s-page-header">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>Personas de test</h1>
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 4 }}>
          Dev only — chaque persona = un user DB isolé, même Spotify en dessous.
        </p>
      </div>

      {/* ── Create form ── */}
      <form className="s-card" onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div className="s-section-title">Nouveau persona</div>

        <input
          className="ob-input"
          placeholder="Nom (ex: Fresh BYOK, Mode scratch, Done)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          required
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select
            className="ob-input"
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ cursor: "pointer" }}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="ob-input"
            value={mode ?? ""}
            onChange={e => setMode(e.target.value || null)}
            style={{ cursor: "pointer" }}
          >
            {MODE_OPTIONS.map(o => (
              <option key={String(o.value)} value={o.value ?? ""}>{o.label}</option>
            ))}
          </select>
        </div>

        <button className="s-btn s-btn-primary" disabled={!label.trim() || creating}>
          {creating ? "Création…" : status === "pending" ? "Créer et tester le flow →" : "Créer"}
        </button>
      </form>

      {/* ── List ── */}
      <div className="s-section-title">Personas existants</div>
      {loading ? (
        <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>Chargement…</p>
      ) : personas.length === 0 ? (
        <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>Aucun persona pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {personas.map(p => {
            const isActive = activeId === p.spotify_id;
            return (
              <div
                key={p.id}
                className="s-card"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  border: isActive ? "1px solid var(--terra)" : undefined,
                  background: isActive ? "rgba(200,122,82,.06)" : undefined,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>
                      {p.email ?? p.spotify_id}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 10, background: "var(--terra)", color: "#fff", padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>
                        ACTIF
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2, display: "flex", gap: 10 }}>
                    <span>{p.onboarding_status}</span>
                    {p.onboarding_mode && <span>· {p.onboarding_mode}</span>}
                    {p.onboarding_step > 0 && <span>· step {p.onboarding_step}</span>}
                    <span style={{ opacity: .5 }}>{p.spotify_id}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!isActive && (
                    <button
                      className="s-btn s-btn-sm s-btn-primary"
                      onClick={() => activate(p.spotify_id)}
                      disabled={activating === p.spotify_id}
                    >
                      {activating === p.spotify_id ? "…" : "Activer"}
                    </button>
                  )}
                  <button
                    className="s-btn s-btn-sm s-btn-danger"
                    onClick={() => remove(p.spotify_id)}
                    disabled={deleting === p.spotify_id || isActive}
                    title={isActive ? "Impossible de supprimer le persona actif" : "Supprimer"}
                  >
                    {deleting === p.spotify_id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
