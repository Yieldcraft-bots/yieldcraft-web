// src/app/quick-start/page.tsx
"use client";

import React, { useEffect, useState } from "react";

const LINKS = {
  stripeAllAccess: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#",
  coinbaseRef: process.env.NEXT_PUBLIC_COINBASE_REF_URL || "#",
  heartbeatUrl: process.env.NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL || "",
};

export default function QuickStartPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => window.scrollTo(0, 0), []);

  async function startBot() {
    if (!LINKS.heartbeatUrl) {
      setMsg("Missing NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL.");
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(LINKS.heartbeatUrl, { method: "GET", cache: "no-store" });
      const text = await res.text();
      setMsg(`✅ Start ping sent. Status ${res.status}. ${text.slice(0, 140)}`);
    } catch (e: any) {
      setMsg(`Network error: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="yc-hero" style={{ paddingBottom: 24 }}>
        <div className="yc-hero__inner">
          <h1>QuickStart</h1>
          <p>Connect · Subscribe · Configure · Go Live — all in minutes with YieldCraft.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10 }}>
            <a className="yc-btn ghost lg" href="/">Back to Home</a>
          </div>
        </div>
      </section>

      <section className="yc-section">
        <div className="pricing-grid" style={{ gridTemplateColumns: "repeat(1, minmax(0,1fr))", maxWidth: 900 }}>
          {/* Step 1 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🏦</div>
              <h3>1 · Connect Exchange</h3>
              <p className="sub">Open a Coinbase Advanced account. No withdrawals on API keys.</p>
            </div>
            <div className="card-cta">
              <a className="yc-btn gold" href={LINKS.coinbaseRef} target="_blank" rel="noreferrer">
                Open with Coinbase
              </a>
              <a className="learn" href="/docs/exchange">How to create API keys</a>
            </div>
          </article>

          {/* Step 2 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">💳</div>
              <h3>2 · Subscribe</h3>
              <p className="sub">All-Access (Pulse + Recon). Cancel anytime.</p>
            </div>
            <div className="card-cta">
              <a className="yc-btn gold" href={LINKS.stripeAllAccess} target="_blank" rel="noreferrer">
                Subscribe Now
              </a>
              <a className="learn" href="/pricing">See pricing</a>
            </div>
          </article>

          {/* Step 3 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">⚙️</div>
              <h3>3 · Configure Risk</h3>
              <p className="sub">
                Start safe defaults: <b>$100 notional</b>, <b>maker-only</b>, cooldown <b>60 s</b>.
              </p>
            </div>
            <div className="metrics">
              <div><span>Entry mode</span><b>Maker-first</b></div>
              <div><span>Cooldown</span><b>60s</b></div>
            </div>
            <p className="blurb">You can raise size after a few green days.</p>
          </article>

          {/* Step 4 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">▶️</div>
              <h3>4 · Start Bot</h3>
              <p className="sub">Ping the public heartbeat endpoint to begin Pulse + Recon.</p>
            </div>
            <div className="card-cta">
              <button className="yc-btn gold" onClick={startBot} disabled={busy}>
                {busy ? "Starting…" : "Start Pulse + Recon"}
              </button>
              {msg && <div className="blurb" style={{ marginTop: 6 }}>{msg}</div>}
              <a className="learn" href="/support">Need help? support@yieldcraft.co</a>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
