import type { MetadataRoute } from "next";

/** Sortify s'installe sur l'écran d'accueil (nécessaire aux notifications sur iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sortify",
    short_name: "Sortify",
    description: "Tu likes, Sortify range.",
    start_url: "/accueil",
    display: "standalone",
    background_color: "#141413",
    theme_color: "#141413",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
