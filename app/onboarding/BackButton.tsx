"use client";

export default function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "none", border: "none", color: "var(--ink-mid)",
        fontSize: 13, fontWeight: 400, cursor: "pointer",
        padding: "0 0 20px", fontFamily: "inherit",
      }}
    >
      <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }}>
        <path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Retour
    </button>
  );
}
