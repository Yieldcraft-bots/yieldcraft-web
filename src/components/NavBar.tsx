"use client";
import Link from "next/link";

export default function NavBar() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(6px)" }}>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src="/yc-logo.svg" alt="YieldCraft" style={{ height: 24, width: 24 }} />
          <span style={{ fontWeight: 600 }}>YieldCraft</span>
        </Link>

        {/* Center links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 24, whiteSpace: "nowrap" }}>
          <Link href="/bots">Bots</Link>
          <Link href="/why">Why YieldCraft</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/quick-start">Quick Start</Link>
          <Link href="/affiliate">Affiliate</Link>
        </nav>

        {/* Right actions (use your existing button styles) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/auth" className="yc-btn ghost">
            Log in
          </Link>
          <Link href="/subscribe" className="yc-btn gold">
            Subscribe
          </Link>
        </div>
      </div>
    </header>
  );
}
