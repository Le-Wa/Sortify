"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  if (session) return null;

  return (
    <main
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "0 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 320 }}>
        <div style={{ marginBottom: 48 }}>
          <h1
            className="font-fraunces"
            style={{
              fontStyle: "italic",
              fontSize: 48,
              fontWeight: 600,
              color: "var(--ink)",
              letterSpacing: "-1px",
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            Sortify<span style={{ color: "var(--terra)" }}>.</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6 }}>
            Tes liked songs, triées automatiquement.
          </p>
        </div>

        <button
          onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
          disabled={status === "loading"}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            borderRadius: 40,
            background: "#1DB954",
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            color: "#000",
            border: "none",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "currentColor", flexShrink: 0 }}>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Se connecter avec Spotify
        </button>
      </div>
    </main>
  );
}
