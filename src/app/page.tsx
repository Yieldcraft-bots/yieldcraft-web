"use client";

import React from "react";

const LINKS = {
  pulse: "https://buy.stripe.com/28EbJ36KB8Zz2jibAn7kc00",
  allAccess:
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0b0e19] text-white">
      {/* Top bar */}
      <header className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 rounded-lg bg-yellow-400/90" />
          <span className="font-semibold tracking-tight text-lg">YieldCraft</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="/api/health" className="hover:text-white">Status</a>
          <a
            href={LINKS.allAccess}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:brightness-110"
          >
            Subscribe
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
            The first <span className="text-yellow-300">multi-platform direct-execution</span> AI
            trading platform
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl">
            Execute directly on Coinbase, Kraken, and IBKR—no signal delays. Powered by Recon
            signal AI and institutional logic. Maker-first, risk-aware, mile-ahead.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={LINKS.allAccess}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:brightness-110"
            >
              Subscribe (All-Access)
            </a>
            <a
              href="#pricing"
              className="px-5 py-3 rounded-xl border border-white/20 hover:border-white/40"
            >
              See Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold">Strategies tuned to your risk</h2>
          <p className="text-white/60 mt-2">Recon signal layer is included with every plan.</p>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {/* Pulse */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col">
              <div className="text-sm text-yellow-300 font-semibold">Pulse</div>
              <h3 className="text-xl font-bold mt-1">Low-risk spot bot</h3>
              <p className="text-white/60 mt-2">
                Maker-first logic with conservative entries. Designed for steady compounding.
                <span className="ml-1 text-yellow-300">Recon included.</span>
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">$9</span>
                <span className="text-white/60">/mo</span>
              </div>
              <div className="mt-auto pt-6">
                <a
                  href={LINKS.pulse}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex justify-center px-4 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:brightness-110"
                >
                  Subscribe to Pulse
                </a>
              </div>
            </div>

            {/* Horizon (points to All-Access for now, keeps flow simple) */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col">
              <div className="text-sm text-cyan-300 font-semibold">Horizon</div>
              <h3 className="text-xl font-bold mt-1">Mid-risk expansion</h3>
              <p className="text-white/60 mt-2">
                Broader participation with adaptive filters and risk gates.
                <span className="ml-1 text-yellow-300">Recon included.</span>
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">$19</span>
                <span className="text-white/60">/mo</span>
              </div>
              <div className="mt-auto pt-6">
                <a
                  href={LINKS.allAccess}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex justify-center px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20"
                >
                  Subscribe (via All-Access)
                </a>
              </div>
            </div>

            {/* All-Access */}
            <div className="rounded-3xl bg-white/5 border border-yellow-400/40 p-6 flex flex-col ring-1 ring-yellow-400/40">
              <div className="text-sm text-yellow-300 font-semibold">All-Access</div>
              <h3 className="text-xl font-bold mt-1">Everything we have</h3>
              <p className="text-white/60 mt-2">
                All current & future bots, priority support, and full Recon signal layer.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">$39</span>
                <span className="text-white/60">/mo</span>
              </div>
              <div className="mt-auto pt-6">
                <a
                  href={LINKS.allAccess}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex justify-center px-4 py-3 rounded-xl bg-yellow-400 text-black font-semibold hover:brightness-110"
                >
                  Subscribe (All-Access)
                </a>
                <p className="text-xs text-white/50 mt-3">
                  Ignition will appear here at launch; for pre-launch, All-Access keeps it simple.
                </p>
              </div>
            </div>
          </div>

          {/* Small print */}
          <p className="text-[11px] text-white/40 mt-6">
            Trading involves risk. No performance guarantees. Recon “included” indicates access to
            our signal layer within enabled bots and venues.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-white/50">
          © {new Date().getFullYear()} YieldCraft. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
