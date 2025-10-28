// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YieldCraft",
  description: "Pulse + Recon • Institutional-grade automation made simple.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const stripeAllAccess =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#";

  return (
    <html lang="en">
      <body className="yc-page">
        {/* Top bar (single, styled) */}
        <header className="yc-topbar">
          <div className="yc-topbar__left">
            <a href="/" className="yc-brand">YieldCraft</a>
          </div>

          <nav className="yc-nav">
            <a href="/bots">Bots</a>
            <a href="/why">Why YieldCraft</a>
            <a href="/pricing">Pricing</a>
            <a className="yc-btn ghost" href="/quick-start">QuickStart</a>
            <a className="yc-btn ghost" href="/affiliate">Affiliate</a>
            <a
              className="yc-btn gold"
              href={stripeAllAccess}
              target="_blank"
              rel="noreferrer"
            >
              Subscribe
            </a>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
