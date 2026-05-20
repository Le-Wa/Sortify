"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/playlists", label: "Playlists" },
  { href: "/archive", label: "Archive" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition-colors ${
              pathname.startsWith(href)
                ? "text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
