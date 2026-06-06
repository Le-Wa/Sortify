"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";

const ADMIN_EMAIL = "guts93@gmail.com";

const NAV_LINKS = [
  {
    href: "/dashboard",
    label: "Accueil",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
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
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path d="M2 4h12M2 8h8M2 12h10" />
      </svg>
    ),
  },
  {
    href: "/playlists",
    label: "Playlists",
    badge: false,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5.5v2.5l1.5 1.5" />
      </svg>
    ),
  },
] as const;

export default function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
  const userImage = session?.user?.image;
  const userName = session?.user?.name?.split(" ")[0] ?? "Profil";

  const fetchCount = useCallback(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data: { needs_review?: number }) => {
        if (data.needs_review !== undefined) setInboxCount(data.needs_review);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCount();
    window.addEventListener("sortify:inbox-changed", fetchCount);
    return () => window.removeEventListener("sortify:inbox-changed", fetchCount);
  }, [fetchCount]);

  if (pathname === "/login" || pathname === "/") return null;

  return (
    <>
      <nav className="s-mobile-nav">
        {NAV_LINKS.map((link) => {
          const { href, label, icon } = link;
          const badge = "badge" in link ? link.badge : false;
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "4px 6px",
                color: isActive ? "var(--terra)" : "var(--ink-dim)",
                textDecoration: "none",
                position: "relative",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6, transition: "opacity 0.15s" }}>
                {icon}
              </span>
              <span style={{ fontSize: 9, fontWeight: isActive ? 500 : 400, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                {label}
              </span>
              {badge && inboxCount !== null && inboxCount > 0 && (
                <span style={{ position: "absolute", top: 2, right: "50%", transform: "translateX(14px)", background: "var(--terra)", color: "#fff", fontSize: 8, fontWeight: 600, padding: "1px 4px", borderRadius: 10, minWidth: 14, textAlign: "center", lineHeight: 1.5 }}>
                  {inboxCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Profil — nav directe, bottom sheet si déjà sur /profile */}
        {pathname === "/profile" ? (
          <button
            onClick={() => setProfileOpen(true)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 6px", background: "none", border: "none", cursor: "pointer", color: "var(--terra)", flex: 1, minWidth: 0 }}
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} width={20} height={20} style={{ borderRadius: "50%" }} alt="" />
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
                <circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
            )}
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.02em", color: "var(--terra)" }}>{userName}</span>
          </button>
        ) : (
          <Link
            href="/profile"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 6px", color: "var(--ink-dim)", textDecoration: "none", flex: 1, minWidth: 0 }}
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} width={20} height={20} style={{ borderRadius: "50%", opacity: 0.6 }} alt="" />
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20, opacity: 0.6 }}>
                <circle cx="8" cy="6" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
            )}
            <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.02em" }}>{userName}</span>
          </Link>
        )}
      </nav>

      {/* Profil bottom sheet */}
      {profileOpen && (
        <>
          <div className="s-bs-backdrop" onClick={() => setProfileOpen(false)} />
          <div className="s-bs" role="dialog" aria-modal="true" aria-label="Profil">
            <div className="s-bs-handle" />

            {/* User info header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px 14px" }}>
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} width={40} height={40} style={{ borderRadius: "50%", flexShrink: 0 }} alt="" />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0 }} />
              )}
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", margin: 0 }}>{session?.user?.name ?? "—"}</p>
                <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: "1px 0 0" }}>{session?.user?.email ?? ""}</p>
              </div>
            </div>

            <div className="s-bs-sep" />

            <Link href="/profile" onClick={() => setProfileOpen(false)} className="s-bs-item" style={{ textDecoration: "none" }}>
              Sonic portrait
            </Link>

            <Link href="/settings" onClick={() => setProfileOpen(false)} className="s-bs-item" style={{ textDecoration: "none" }}>
              Paramètres
            </Link>

            {isAdmin && (
              <>
                <Link href="/admin/logs" onClick={() => setProfileOpen(false)} className="s-bs-item" style={{ textDecoration: "none", color: "var(--ink-dim)" }}>
                  Logs admin
                </Link>
                <Link href="/admin/benchmark" onClick={() => setProfileOpen(false)} className="s-bs-item" style={{ textDecoration: "none", color: "var(--ink-dim)" }}>
                  Benchmark A/B
                </Link>
              </>
            )}

            <div className="s-bs-sep" />

            <button className="s-bs-item s-bs-item-danger" onClick={() => { setProfileOpen(false); void signOut({ callbackUrl: "/" }); }}>
              Déconnexion
            </button>

            <div className="s-bs-sep" style={{ marginTop: 4 }} />
            <button className="s-bs-item s-bs-item-dim" onClick={() => setProfileOpen(false)}>Annuler</button>
          </div>
        </>
      )}
    </>
  );
}
