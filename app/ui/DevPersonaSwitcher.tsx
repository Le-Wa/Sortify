"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Persona {
  spotify_id: string;
  email: string | null;
  onboarding_status: string;
}

export default function DevPersonaSwitcher() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/dev/personas").then(r => r.json()).then(setPersonas).catch(() => {});
  }, [open]);

  async function activate(spotifyId: string) {
    setActivating(spotifyId);
    try {
      const res = await fetch("/api/dev/personas/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_id: spotifyId }),
      });
      const { token } = await res.json();
      const result = await signIn("byok-handoff", { token, redirect: false });
      if (result?.ok) { setOpen(false); router.push("/onboarding"); router.refresh(); }
    } finally {
      setActivating(null);
    }
  }

  const activePersona = personas.find(p => p.spotify_id === session?.userId);
  const isDevUser = session?.userId?.startsWith("dev_");

  return (
    <div style={{ position: "fixed", bottom: 80, right: 12, zIndex: 9999, fontFamily: "var(--font-mono, monospace)" }}>
      {open && (
        <div style={{
          marginBottom: 8, background: "#111", border: "1px solid #333",
          borderRadius: 10, padding: 12, width: 240,
          boxShadow: "0 4px 20px rgba(0,0,0,.6)",
        }}>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 8, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Persona actif
          </div>
          <div style={{ fontSize: 12, color: isDevUser ? "var(--terra)" : "#aaa", marginBottom: 12 }}>
            {isDevUser ? (activePersona?.email ?? session?.userId) : "⚠ Ton vrai compte"}
          </div>

          <div style={{ fontSize: 10, color: "#666", marginBottom: 6, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Switcher
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
            {personas.map(p => (
              <button
                key={p.spotify_id}
                onClick={() => activate(p.spotify_id)}
                disabled={activating === p.spotify_id || p.spotify_id === session?.userId}
                style={{
                  background: p.spotify_id === session?.userId ? "rgba(200,122,82,.15)" : "rgba(255,255,255,.04)",
                  border: p.spotify_id === session?.userId ? "1px solid var(--terra)" : "1px solid #333",
                  borderRadius: 6, padding: "6px 8px", cursor: "pointer",
                  textAlign: "left", color: "#ccc", fontSize: 11,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span>{p.email ?? p.spotify_id}</span>
                <span style={{ color: "#555", fontSize: 10 }}>{p.onboarding_status.slice(0, 4)}</span>
              </button>
            ))}
            {personas.length === 0 && (
              <span style={{ fontSize: 11, color: "#555" }}>Aucun persona</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <Link
              href="/admin/personas"
              onClick={() => setOpen(false)}
              style={{ flex: 1, fontSize: 11, color: "#666", textDecoration: "none", textAlign: "center", padding: "4px 0" }}
            >
              Gérer →
            </Link>
            <button
              onClick={async () => {
                const res = await fetch("/api/dev/invite", { method: "POST" });
                const { code, error } = await res.json();
                if (error) alert(error);
                else { await navigator.clipboard.writeText(code); alert(`Code copié : ${code}`); }
              }}
              style={{
                flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid #333",
                borderRadius: 6, color: "#aaa", fontSize: 11, cursor: "pointer", padding: "4px 0",
              }}
            >
              🎟 Invite
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: isDevUser ? "var(--terra)" : "#222",
          border: "1px solid #444",
          borderRadius: 8, padding: "6px 10px",
          color: isDevUser ? "#fff" : "#888",
          fontSize: 11, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,.4)",
        }}
      >
        👤 {isDevUser ? (activePersona?.email?.slice(0, 12) ?? "dev") : "dev"}
      </button>
    </div>
  );
}
