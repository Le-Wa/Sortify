"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/accueil", label: "Accueil" },
  { href: "/a-trier", label: "À trier" },
  { href: "/bacs", label: "Bacs" },
] as const;

export function TabBar({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname.startsWith(tab.href) ? "page" : undefined}>
          {tab.label}
          {tab.href === "/a-trier" && pending > 0 ? <span className="badge">{pending}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
