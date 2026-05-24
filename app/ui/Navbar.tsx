"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="s-nav-icon" style={{ width: 16, height: 16 }}>
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/inbox",
    label: "Inbox",
    badge: true,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="s-nav-icon" style={{ width: 16, height: 16 }}>
        <path d="M2 4h12M2 8h8M2 12h10" />
      </svg>
    ),
  },
  {
    href: "/playlists",
    label: "Playlists",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="s-nav-icon" style={{ width: 16, height: 16 }}>
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5.5v2.5l1.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/archive",
    label: "Archive",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="s-nav-icon" style={{ width: 16, height: 16 }}>
        <path d="M3 3h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V3z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Paramètres",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="s-nav-icon" style={{ width: 16, height: 16 }}>
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M12.6 3.4l-.7.7M4.1 11.9l-.7.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/logs",
    label: "Logs admin",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="s-nav-icon" style={{ width: 16, height: 16 }}>
        <path d="M2 12L6 4l4 5 2-3 2 6" />
      </svg>
    ),
  },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [cronEnabled, setCronEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data: { needs_review?: number; cron_enabled?: boolean }) => {
        if (data.needs_review !== undefined) setInboxCount(data.needs_review);
        if (data.cron_enabled !== undefined) setCronEnabled(data.cron_enabled);
      })
      .catch(() => {});
  }, []);

  if (pathname === "/login" || pathname === "/") return null;

  return (
    <aside
      className="s-sidebar"
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "32px 20px",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 36, padding: "0 8px" }}>
        <div
          className="font-fraunces"
          style={{ fontStyle: "italic", fontSize: 28, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.5px" }}
        >
          Sortify<span style={{ color: "var(--terra)" }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>Playlist automation</div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {LINKS.map(({ href, label, icon, badge }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`s-nav-item${isActive ? " active" : ""}`}
            >
              {icon}
              {label}
              {badge && inboxCount !== null && inboxCount > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "var(--terra)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 500,
                    padding: "1px 7px",
                    borderRadius: 20,
                  }}
                >
                  {inboxCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Cron card */}
      <div style={{ paddingTop: 16, marginTop: "auto", borderTop: "1px solid var(--border)" }}>
        <div
          style={{
            background: "var(--surface2)",
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--ink-dim)",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: cronEnabled ? "#4a8a5a" : "var(--ink-dim)",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            Cron {cronEnabled ? "actif" : "inactif"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
            Chaque lundi · 08h00
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 3 }}>
            Prochain run : {nextMonday()}
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          padding: "8px",
          background: "none",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          color: "var(--ink-dim)",
          fontSize: 12,
          fontWeight: 400,
          width: "100%",
          textAlign: "left",
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14, flexShrink: 0 }}>
          <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Déconnexion
      </button>
    </aside>
  );
}
