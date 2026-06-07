"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  llm_help_text: string | null;
  learned_at: string | null;
  color: string | null;
  total: number;
  not_synced: number;
}

export interface RowProps {
  p: PlaylistData;
  swatch: string;
  load: string | undefined;
  isDragging: boolean;
  isOver: boolean;
  draggable: boolean;
  isDesktop: boolean;
  onToggle: () => void;
  onLearn?: () => void;
  onFromDesc?: () => void;
  onRecompute?: () => void;
  onRequestDelete?: () => void;
  onOpenBottomSheet?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function PlaylistRow({
  p, swatch, load, isDragging, isOver, draggable, isDesktop,
  onToggle, onLearn, onFromDesc, onRecompute, onRequestDelete, onOpenBottomSheet,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: RowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const learnedAt = p.learned_at
    ? new Date(p.learned_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;

  const ddItem: React.CSSProperties = {
    display: "block", width: "100%", textAlign: "left",
    padding: "9px 14px", background: "transparent", border: "none",
    cursor: "pointer", fontSize: 12, color: "var(--ink-mid)",
    transition: "background 0.1s",
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className="s-pl-row"
      style={{
        opacity: isDragging ? 0.35 : 1,
        background: hexToRgba(swatch, 0.07),
        borderColor: isOver ? "var(--terra)" : `${swatch}33`,
        outline: isOver ? "1px solid var(--terra-border)" : "none",
      }}
    >
      {draggable && <div className="s-drag-handle" title="Réordonner">⠿</div>}

      <Link href={`/playlists/${p.id}`} className="s-pl-row-main">
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: swatch, flexShrink: 0 }} />
        <div className="s-pl-row-info">
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="font-fraunces" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
              {p.name}
            </span>
            {!p.enabled && (
              <span style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase",
                color: "var(--ink-mid)", background: "var(--surface2)",
                border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 5px",
              }}>
                inactif
              </span>
            )}
          </div>
          {p.description && (
            <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.description}
            </p>
          )}
          {learnedAt && (
            <p style={{ fontSize: 11, color: swatch, opacity: 0.85, marginTop: 2 }}>Appris le {learnedAt}</p>
          )}
        </div>
        <div className="s-pl-row-stats" style={{ flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, color: swatch }}>{p.total}</span>
            {p.not_synced > 0 && (
              <span style={{ fontSize: 10, color: "var(--terra)", background: "var(--terra-light)", border: "1px solid var(--terra-border)", padding: "1px 6px", borderRadius: 12 }}>
                +{p.not_synced}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>tracks</span>
        </div>
      </Link>

      <div className="s-pl-row-actions">
        {p.enabled && onLearn && (
          <button
            className="s-btn s-btn-sm"
            onClick={onLearn}
            disabled={!!load}
            style={{ background: "var(--terra-light)", borderColor: "var(--terra-border)", color: "var(--terra)" }}
          >
            {load === "learn" ? "…" : "Learn"}
          </button>
        )}
        {p.enabled && onFromDesc && (
          <button
            className="s-btn s-btn-sm"
            onClick={onFromDesc}
            disabled={!!load}
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", color: "var(--ink-dim)" }}
          >
            Décrire la vibe
          </button>
        )}
        <button
          className="s-btn s-btn-sm"
          onClick={onToggle}
          disabled={!!load}
          title={p.enabled ? "Désactiver" : "Activer"}
          style={p.enabled ? {
            background: hexToRgba(swatch, 0.12),
            borderColor: hexToRgba(swatch, 0.3),
            color: swatch,
          } : {
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
            color: "var(--ink-dim)",
          }}
        >
          {load === "toggle" ? "…" : (
            <>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: p.enabled ? swatch : "var(--ink-dimmer)",
                marginRight: 5, verticalAlign: "middle",
              }} />
              {p.enabled ? "On" : "Off"}
            </>
          )}
        </button>
        <div ref={menuWrapRef} style={{ position: "relative" }}>
          <button
            className="s-btn s-btn-sm"
            title="Plus d'options"
            aria-label="Plus d'options"
            aria-expanded={dropdownOpen}
            onClick={() => {
              if (isDesktop) setDropdownOpen((v) => !v);
              else onOpenBottomSheet?.();
            }}
          >
            ⋯
          </button>
          {isDesktop && dropdownOpen && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", right: 0,
              background: "var(--surface)", border: "1px solid var(--border-strong)",
              borderRadius: 10, boxShadow: "var(--shadow-md)", zIndex: 200,
              minWidth: 176, overflow: "hidden",
            }}>
              <div style={{ height: 1, background: "var(--border)" }} />
              <button
                style={{ ...ddItem, color: "var(--danger)" }}
                onClick={() => { setDropdownOpen(false); onToggle(); }}
              >
                {p.enabled ? "Désactiver" : "Activer"}
              </button>
              {onRequestDelete && (
                <>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <button
                    style={{ ...ddItem, color: "var(--danger)" }}
                    onClick={() => { setDropdownOpen(false); onRequestDelete(); }}
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        className="s-pl-menu-btn s-btn"
        onClick={onOpenBottomSheet}
        title="Options"
        aria-label="Options"
      >
        ⋯
      </button>
    </div>
  );
}
