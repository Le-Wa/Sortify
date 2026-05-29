"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const ADMIN_EMAIL = "guts93@gmail.com";

const NAV_LINKS = [
  {
    href: "/dashboard",
    label: "Accueil",
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
] as const;

const ddItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 14px",
  fontSize: 13,
  color: "var(--ink-mid)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  textDecoration: "none",
  transition: "background 0.12s, color 0.12s",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [cronEnabled, setCronEnabled] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
  const userName = session?.user?.name?.split(" ")[0] ?? "Profil";
  const userImage = session?.user?.image;

  const fetchStats = useCallback(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data: { needs_review?: number; cron_enabled?: boolean }) => {
        if (data.needs_review !== undefined) setInboxCount(data.needs_review);
        if (data.cron_enabled !== undefined) setCronEnabled(data.cron_enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
    window.addEventListener("sortify:inbox-changed", fetchStats);
    return () => window.removeEventListener("sortify:inbox-changed", fetchStats);
  }, [fetchStats]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [userMenuOpen]);

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
          style={{ fontStyle: "italic", fontSize: 28, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.6px" }}
        >
          Sortify<span style={{ color: "var(--terra)" }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>Playlist automation</div>
      </div>

      {/* Nav — Accueil · Inbox · Playlists · Archive */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV_LINKS.map(({ href, label, icon, badge }) => {
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

      {/* Footer */}
      <div style={{ paddingTop: 16, marginTop: "auto", borderTop: "1px solid var(--border)" }}>

        {/* User menu */}
        <div ref={menuRef} style={{ position: "relative", marginBottom: 12 }}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              background: userMenuOpen ? "var(--surface2)" : "none",
              border: "1px solid transparent",
              borderRadius: 10,
              cursor: "pointer",
              color: "var(--ink-mid)",
              textAlign: "left",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
            onMouseLeave={(e) => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = "none"; }}
          >
            {userImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={userImage} width={28} height={28} style={{ borderRadius: "50%", flexShrink: 0 }} alt="" />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, flex: 1, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-dimmer)", flexShrink: 0 }}>⋯</span>
          </button>

          {userMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: 12,
                boxShadow: "var(--shadow-md)",
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              <Link
                href="/settings"
                onClick={() => setUserMenuOpen(false)}
                style={{ ...ddItem }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "var(--ink-mid)"; }}
              >
                Paramètres
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href="/admin/logs"
                    onClick={() => setUserMenuOpen(false)}
                    style={{ ...ddItem, color: "var(--ink-dim)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    Logs admin
                  </Link>
                  <Link
                    href="/admin/benchmark"
                    onClick={() => setUserMenuOpen(false)}
                    style={{ ...ddItem, color: "var(--ink-dim)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    Benchmark A/B
                  </Link>
                </>
              )}
              <div style={{ height: 1, background: "var(--border)" }} />
              <button
                onClick={() => { setUserMenuOpen(false); void signOut({ callbackUrl: "/" }); }}
                style={{ ...ddItem, color: "var(--terra)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>

        {/* Cron card */}
        <div
          style={{
            background: "var(--surface2)",
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cronEnabled ? "#4a8a5a" : "var(--ink-dim)", flexShrink: 0, display: "inline-block" }} />
            Cron {cronEnabled ? "actif" : "inactif"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
            Chaque lundi · 08h00
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 3 }}>
            Prochain run : {nextMonday()}
          </div>
          <Link href="/settings" style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "var(--ink-dim)", textDecoration: "none" }}>
            Modifier →
          </Link>
        </div>
      </div>
    </aside>
  );
}
