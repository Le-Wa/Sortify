import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Polices des pochettes générées côté serveur (lues avec fs dans lib/cover.tsx).
  outputFileTracingIncludes: {
    "/api/jobs/[id]/run": ["./assets/fonts/**"],
  },
  // En-têtes de sécurité (revue du 11/10/2026).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Service worker des notifications : jamais en cache, et rien d'autre que lui-même.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      // Pochettes des playlists faites par la personne (étape « Tes playlists ») et de celles générées par Sortify.
      { protocol: "https", hostname: "**.spotifycdn.com" },
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" },
    ],
  },
};

export default nextConfig;
