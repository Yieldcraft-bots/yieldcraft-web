"use client";
import Link from "next/link";

export default function NavBar() {
  return (
    <header className="w-full sticky top-0 z-50 backdrop-blur">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/yc-logo.svg" alt="YieldCraft" className="h-6 w-6" />
          <span className="font-semibold tracking-tight">YieldCraft</span>
        </Link>

        {/* Center links — always visible */}
        <ul className="flex items-center gap-6 whitespace-nowrap">
          <li><Link href="/bots" className="hover:opacity-80">Bots</Link></li>
          <li><Link href="/why" className="hover:opacity-80">Why YieldCraft</Link></li>
          <li><Link href="/pricing" className="hover:opacity-80">Pricing</Link></li>
          <li><Link href="/quick-start" className="hover:opacity-80">Quick Start</Link></li>
          <li><Link href="/affiliate" className="hover:opacity-80">Affiliate</Link></li>
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <Link href="/auth" className="rounded-xl px-4 py-2 text-sm border border-white/10 hover:bg-white/5">
            Log in
          </Link>
          <Link
            href="/subscribe"
            className="rounded-xl px-4 py-2 text-sm bg-[var(--yc-gold,#f1c40f)] text-black hover:opacity-90"
          >
            Subscribe
          </Link>
        </div>
      </nav>
    </header>
  );
}
