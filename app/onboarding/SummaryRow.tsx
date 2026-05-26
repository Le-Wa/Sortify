"use client";

export default function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 13, color: "var(--ink-mid)", fontWeight: 400 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
