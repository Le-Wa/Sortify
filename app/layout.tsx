import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "./ui/Navbar";
import MobileNav from "./ui/MobileNav";
import DevPersonaSwitcher from "./ui/DevPersonaSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "Sortify",
  description: "Your liked songs, automatically sorted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen">
        <Providers>
          <Sidebar />
          <div className="flex-1 min-w-0 relative z-10 min-h-screen overflow-x-hidden">
            {children}
          </div>
          <MobileNav />
          {process.env.NODE_ENV !== "production" && <DevPersonaSwitcher />}
        </Providers>
      </body>
    </html>
  );
}
