"use client";

import { signIn } from "next-auth/react";

export default function SpotifySignInButton({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
      className={className}
      style={{ cursor: "pointer", border: "none", ...style }}
    >
      {children}
    </button>
  );
}
