// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YieldCraft — Mile-Ahead AI trading",
  description: "Direct execution on Coinbase, Kraken, and IBKR — no middle layers.",
};

const LINKS = {
  pricing: "/pricing",
  quickStart: "/quick-start",
  affiliate: "/affiliate",
  stripeAllAccess: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="yc-page">
          {/* Shared glossy topbar */}
          <header className="yc-topbar">
            <div className="yc-topbar__left">
              <a href="/" className="yc-brand">YieldCraft</a>
            </div>
            <nav className="yc-nav">
              <a href="/bots">Bots</a>
              <a href="/why">Why YieldCraft</a>
              <a href={LINKS.pricing}>Pricing</a>
              <a className="yc-btn ghost" href={LINKS.quickStart}>QuickStart</a>
              <a className="yc-btn ghost" href={LINKS.affiliate}>Affiliate</a>
              <a className="yc-btn gold" href={LINKS.stripeAllAccess} target="_blank" rel="noreferrer">Subscribe</a>
            </nav>
          </header>

          {children}

          {/* Shared footer */}
          <footer className="yc-footer">
            <div className="yc-footer__brand">© 2025 YieldCraft. All rights reserved.</div>
            <div className="yc-footer__links">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/contact">Contact</a>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}
