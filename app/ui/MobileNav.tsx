"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

const LINKS = [
  {
    href: "/dashboard",
    label: "Home",
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
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5.5v2.5l1.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/archive",
    label: "Archive",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path d="M3 3h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V3z" />
      </svg>
    ),
  },
  {
    href: "/admin/logs",
    label: "Admin",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path d="M2 12L6 4l4 5 2-3 2 6" />
      </svg>
    ),
  },
] as const;

export default function MobileNav() {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data: { needs_review?: number }) => {
        if (data.needs_review !== undefined) setInboxCount(data.needs_review);
      })
      .catch(() => {});
  }, []);

  if (pathname === "/login" || pathname === "/") return null;

  return (
    <nav className="s-mobile-nav">
      {LINKS.map((link) => {
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
            <span
              style={{
                fontSize: 9,
                fontWeight: isActive ? 500 : 300,
                letterSpacing: "0.02em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {label}
            </span>
            {badge && inboxCount !== null && inboxCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: "50%",
                  transform: "translateX(14px)",
                  background: "var(--terra)",
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: 600,
                  padding: "1px 4px",
                  borderRadius: 10,
                  minWidth: 14,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {inboxCount}
              </span>
            )}
          </Link>
        );
      })}

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "4px 6px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--ink-dimmer)",
          flex: 1,
          minWidth: 0,
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20, opacity: 0.6 }}>
          <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 9, fontWeight: 300, letterSpacing: "0.02em" }}>Logout</span>
      </button>
    </nav>
  );
}
