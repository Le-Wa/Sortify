import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Polices des pochettes générées côté serveur (lues avec fs dans lib/cover.tsx).
  outputFileTracingIncludes: {
    "/api/jobs/[id]/run": ["./assets/fonts/**"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" },
    ],
  },
};

export default nextConfig;
