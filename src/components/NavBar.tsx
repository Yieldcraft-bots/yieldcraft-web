"use client";
import Link from "next/link";

export default function NavBar() {
  return (
    <header className="yc-topbar">
      <div className="yc-topbar__inner">
        {/* Brand */}
        <Link href="/" className="yc-brand">YieldCraft</Link>

        {/* Center links (your glossy site styles handle spacing/colors) */}
        <nav className="yc-nav">
          <Link href="/bots">Bots</Link>
          <Link href="/why">Why YieldCraft</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/quick-start">Quick Start</Link>
          <Link href="/affiliate">Affiliate</Link>
        </nav>

        {/* Right actions */}
        <div className="yc-actions">
          <Link href="/auth" className="yc-btn ghost">Log in</Link>
          <Link href="/subscribe" className="yc-btn gold">Subscribe</Link>
        </div>
      </div>
    </header>
  );
}
