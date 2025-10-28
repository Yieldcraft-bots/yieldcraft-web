"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ? "is-active" : "";

  return (
    <header className="yc-topbar">
      <div className="yc-topbar__inner">
        {/* Brand (left) */}
        <Link href="/" className="yc-brand">
          <img src="/yc-logo.svg" alt="YieldCraft" className="h-6 w-6" />
          <span className="yc-brand__text">YieldCraft</span>
        </Link>

        {/* Center nav */}
        <nav className="yc-nav">
          <Link href="/bots"       className={isActive("/bots")}>Bots</Link>
          <Link href="/why"        className={isActive("/why")}>Why YieldCraft</Link>
          <Link href="/pricing"    className={isActive("/pricing")}>Pricing</Link>
          <Link href="/quick-start" className={isActive("/quick-start")}>Quick Start</Link>
          <Link href="/affiliate"  className={isActive("/affiliate")}>Affiliate</Link>
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
