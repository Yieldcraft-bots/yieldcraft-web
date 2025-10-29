// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YieldCraft",
  description: "Pulse + Recon • Institutional-grade automation made simple.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="yc-page">
        {/* ===== Topbar (logo + nav + actions) ===== */}
        <header className="yc-topbar">
          <div className="yc-topbar__inner">
            <a href="/" className="yc-brand">
              <img
                src="/yc-shield-gold.png"
                alt="YieldCraft"
                width={34}
                height={34}
                style={{ borderRadius: 8 }}
              />
              <span className="yc-brand__text">YieldCraft</span>
            </a>

            <nav className="yc-nav">
              <a href="/bots">Bots</a>
              <a href="/why">Why YieldCraft</a>
              <a href="/pricing">Pricing</a>
              <a href="/quick-start">Quick Start</a>
              <a href="/affiliate">Affiliate</a>
            </nav>

            <div className="yc-actions">
              <a href="/auth/login" className="yc-btn ghost">Log in</a>
              <a href="/pricing" className="yc-btn gold">Subscribe</a>
            </div>
          </div>
        </header>

        {/* ===== Page content ===== */}
        {children}
      </body>
    </html>
  );
}
