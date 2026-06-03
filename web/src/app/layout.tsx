import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteHeaderShell } from "@/components/site-header-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gomic — Manga Reader MVP",
  description: "Dark-first comic, manga, manhwa, and manhua reader MVP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="pb-24 md:pb-0">
        <SiteHeaderShell />
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
