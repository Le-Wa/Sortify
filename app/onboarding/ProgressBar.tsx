"use client";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS = ["Connexion", "Import", "Playlists", "Schedule", "Prêt", "Tri"];

export default function ProgressBar({ step }: { step: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 36, gap: 0 }}>
      {STEP_LABELS.map((label, i) => {
        const s = (i + 1) as Step;
        const done = s < step;
        const active = s === step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done || active ? "var(--terra)" : "transparent",
                border: done || active ? "1px solid var(--terra)" : "1px solid var(--border-strong)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
                color: done || active ? "#fff" : "var(--ink-mid)",
              }}>
                {done ? (
                  <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }}>
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              <span style={{
                fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
                color: active ? "var(--terra)" : done ? "var(--ink-mid)" : "var(--ink-dimmer)",
                fontWeight: active ? 600 : 400,
              }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{
                width: 28, height: 1, marginBottom: 20,
                background: done ? "var(--terra)" : "var(--border)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
