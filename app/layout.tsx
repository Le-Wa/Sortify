import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeOf } from "@/lib/theme";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Sortify",
  description: "Tu likes, Sortify range. L'IA imagine tes bacs et y range chaque nouveau like.",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  // Installable sur l'écran d'accueil de l'iPhone (nécessaire aux notifications du lundi).
  appleWebApp: { capable: true, title: "Sortify", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecede8" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Thème choisi dans les Réglages (cookie, par appareil) ; « auto » suit le téléphone.
  const theme = themeOf((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="fr" className={`${archivo.variable} ${dmMono.variable}`} data-theme={theme === "auto" ? undefined : theme}>
      <body>{children}</body>
    </html>
  );
}
