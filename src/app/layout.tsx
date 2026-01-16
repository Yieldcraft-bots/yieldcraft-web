// src/app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

import AuthNav from "@/components/AuthNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YieldCraft — Direct Execution AI Trading Engine",
  description:
    "Institutional-grade trading engines with real execution. Active bots, long-term allocators, and strict risk guardrails — built for real capital.",
  metadataBase: new URL("https://yieldcraft.co"),
  openGraph: {
    title: "YieldCraft — Direct Execution AI Trading Engine",
    description:
      "Pulse, Recon, Atlas, and Pro Suite. Real trades. Real risk controls. No simulations.",
    url: "https://yieldcraft.co",
    siteName: "YieldCraft",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YieldCraft — Direct Execution AI Trading Engine",
    description:
      "Active trading + long-term allocation powered by institutional AI risk engines.",
  },
};

const navLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/quick-start", label: "Quick Start" },
  { href: "/bots", label: "Bots" },
  { href: "/system", label: "System" },
  { href: "/atlas", label: "Atlas" },
  { href: "/affiliate", label: "Affiliate" },
  // Dashboard/Login/Logout handled by <AuthNav />
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#040914] text-white`}
      >
        {/* Ambient background */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[140px]" />
          <div className="absolute -bottom-48 right-[-240px] h-[620px] w-[620px] rounded-full bg-yellow-400/10 blur-[160px]" />
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        {/* NAVBAR */}
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#040914]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            {/* Brand */}
            <Link href="/" className="group flex items-center gap-3">
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400/25 to-yellow-400/25 blur-md opacity-0 transition group-hover:opacity-100" />
                <Image
                  src="/yc-logo.png"
                  alt="YieldCraft"
                  width={40}
                  height={40}
                  className="relative rounded-lg"
                  priority
                />
              </span>

              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-tight">
                  Yield<span className="text-cyan-300">Craft</span>
                </div>
                <div className="text-[11px] text-white/60">
                  Direct Execution • AI Risk Engines
                </div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-7 text-sm md:flex">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-white/70 transition hover:text-white"
                >
                  {l.label}
                </Link>
              ))}

              {/* Login/Join OR Dashboard/Logout */}
              <AuthNav />
            </nav>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <Link
                href="/pricing"
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 md:inline-flex"
              >
                See Plans
              </Link>

              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_12px_40px_rgba(250,204,21,0.22)] transition hover:brightness-110"
              >
                Subscribe
              </Link>
            </div>
          </div>

          {/* Mobile nav */}
          <div className="mx-auto max-w-7xl px-5 pb-4 md:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
                >
                  {l.label}
                </Link>
              ))}

              {/* Login/Join OR Dashboard/Logout */}
              <AuthNav />
            </div>
          </div>
        </header>

        {/* PAGE */}
        <main>{children}</main>
      </body>
    </html>
  );
}
