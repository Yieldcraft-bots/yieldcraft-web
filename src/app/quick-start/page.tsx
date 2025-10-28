// src/app/quick-start/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

const STRIPE = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "";
const COINBASE = process.env.NEXT_PUBLIC_COINBASE_REF_URL || "";
const HEARTBEAT = process.env.NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL || "";

// helper to append ?ref=code to external links
function withRef(base: string, ref: string) {
  if (!base) return "";
  try {
    const u = new URL(base);
    if (ref) u.searchParams.set("ref", ref);
    return u.toString();
  } catch {
    return base;
  }
}

export default function QuickStartPage() {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("ref");
    if (q) setRef(q);
  }, []);

  const stripeLink = useMemo(() => withRef(STRIPE, ref), [ref]);
  const coinbaseLink = useMemo(() => withRef(COINBASE, ref), [ref]);

  async function handleStart() {
    if (!HEARTBEAT) {
      setToast("⚠️ Missing NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL");
      return;
    }
    try {
      setBusy(true);
      setToast("Pinging bot…");
      const res = await fetch(HEARTBEAT, { method: "GET", cache: "no-store" });
      const text = await res.text();
      if (res.ok) {
        setToast(`✅ Bot pinged. Check fills/logs. (${text.slice(0, 120)})`);
      } else {
        setToast(`⚠️ ${res.status} ${res.statusText} — ${text.slice(0, 120)}`);
      }
    } catch (e: any) {
      setToast(`⚠️ Network error: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  return (
    <main className="yc-page">
      {/* Hero */}
      <section className="yc-hero">
        <div className="yc-hero__inner">
          <h1>QuickStart</h1>
          <p>Connect · Subscribe · Configure · Go Live — all in minutes with YieldCraft.</p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14, gap: 10 }}>
            <a className="yc-btn ghost lg" href="/">Back to Home</a>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="yc-section">
        <div className="pricing-grid" style={{ gridTemplateColumns: "1fr" }}>
          {/* Step 1 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🏛️</div>
              <h3>1 · Connect Exchange</h3>
              <p className="sub">
                Open a Coinbase Advanced account. No withdrawals on API keys.
              </p>
            </div>
            <div className="card-cta" style={{ gap: 10 }}>
              {COINBASE ? (
                <a
                  className="yc-btn gold lg"
                  href={coinbaseLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open with Coinbase
                </a>
              ) : (
                <p className="blurb">
                  Set <code>NEXT_PUBLIC_COINBASE_REF_URL</code> in Vercel to enable this button.
                </p>
              )}
              <a className="learn" href="/docs/coinbase-keys">How to create API keys</a>
            </div>
          </article>

          {/* Step 2 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">💳</div>
              <h3>2 · Subscribe</h3>
              <p className="sub">All-Access (Pulse + Recon). Cancel anytime.</p>
            </div>
            <div className="card-cta" style={{ gap: 10 }}>
              {STRIPE ? (
                <a
                  className="yc-btn gold lg"
                  href={stripeLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Subscribe Now
                </a>
              ) : (
                <p className="blurb">
                  Set <code>NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS</code> in Vercel to enable checkout.
                </p>
              )}
              <a className="learn" href="/pricing">See pricing</a>
            </div>
          </article>

          {/* Step 3 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🛡️</div>
              <h3>3 · Configure Risk</h3>
              <p className="sub">Start safe defaults for new users.</p>
            </div>
            <ul className="blurb" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              <li>Notional: <b>$100</b></li>
              <li>Entries: <b>maker-only</b></li>
              <li>Cooldown: <b>60s</b></li>
            </ul>
          </article>

          {/* Step 4 */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">▶️</div>
              <h3>4 · Start Bot</h3>
              <p className="sub">Ping the public heartbeat endpoint to begin.</p>
            </div>
            <div className="card-cta" style={{ gap: 10 }}>
              <button
                onClick={handleStart}
                disabled={!HEARTBEAT || busy}
                className="yc-btn gold lg"
                style={{ opacity: !HEARTBEAT || busy ? 0.7 : 1 }}
              >
                {busy ? "Starting…" : "Start Pulse + Recon"}
              </button>
              {toast && <div className="risk med" style={{ alignSelf: "flex-start" }}>{toast}</div>}
              {!HEARTBEAT && (
                <p className="blurb">
                  Set <code>NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL</code> in Vercel to enable the Start button.
                </p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
