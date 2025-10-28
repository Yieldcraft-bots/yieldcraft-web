// src/app/affiliate/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

const STRIPE = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "";
const COINBASE = process.env.NEXT_PUBLIC_COINBASE_REF_URL || "";

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState<null | string>(null);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk("Copied!");
          setTimeout(() => setOk(null), 1200);
        } catch {
          setOk("Failed");
          setTimeout(() => setOk(null), 1200);
        }
      }}
      className="yc-btn gold"
      style={{ height: 36, padding: "0 14px" }}
      aria-label="Copy"
    >
      {ok ?? "Copy"}
    </button>
  );
}

export default function AffiliatePage() {
  const [ref, setRef] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    // prefill from ?ref
    const u = new URL(window.location.href);
    const q = u.searchParams.get("ref");
    if (q) setRef(q);
  }, []);

  const homepage = useMemo(() => {
    const url = new URL(origin || "https://yieldcraft.co");
    if (ref) url.searchParams.set("ref", ref);
    return url.toString();
  }, [origin, ref]);

  const stripe = useMemo(() => {
    if (!STRIPE) return "";
    try {
      const url = new URL(STRIPE);
      if (ref) url.searchParams.set("ref", ref);
      return url.toString();
    } catch {
      return STRIPE;
    }
  }, [ref]);

  const coinbase = useMemo(() => {
    if (!COINBASE) return "";
    try {
      const url = new URL(COINBASE);
      if (ref) url.searchParams.set("ref", ref);
      return url.toString();
    } catch {
      return COINBASE;
    }
  }, [ref]);

  return (
    <main className="yc-page">
      {/* Hero */}
      <section className="yc-hero">
        <div className="yc-hero__inner">
          <h1>Affiliate Hub</h1>
          <p>
            Earn by sharing YieldCraft. Your code tracks across the whole site and into{" "}
            <b>Stripe</b> & <b>Coinbase</b> links — with a one-year attribution window.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <a className="yc-btn ghost lg" href="/">Back to Home</a>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="yc-section">
        <div className="pricing-grid" style={{ gridTemplateColumns: "1fr" }}>
          {/* referral code */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🏷️</div>
              <h3>Your referral code</h3>
              <p className="sub">This will be appended as <code>?ref=yourcode</code>.</p>
            </div>
            <div className="card-cta" style={{ gap: 12 }}>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value.replace(/\s+/g, ""))}
                placeholder="yourname"
                className="yc-input"
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid var(--yc-stroke)",
                  background: "var(--yc-card)",
                  color: "var(--yc-text)",
                  padding: "0 12px",
                }}
              />
            </div>
          </article>

          {/* homepage link */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🔗</div>
              <h3>Homepage link</h3>
              <p className="sub">Send traffic to your homepage — auto-tracks your code.</p>
            </div>
            <div className="card-cta" style={{ gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <input
                  readOnly
                  value={homepage}
                  className="yc-input"
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid var(--yc-stroke)",
                    background: "var(--yc-card)",
                    color: "var(--yc-text)",
                    padding: "0 12px",
                  }}
                />
                <CopyButton text={homepage} />
              </div>
            </div>
          </article>

          {/* stripe link */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">💳</div>
              <h3>Stripe subscribe link</h3>
              <p className="sub">Goes straight to checkout; your code is attached.</p>
            </div>
            <div className="card-cta" style={{ gap: 12 }}>
              {!STRIPE ? (
                <p className="blurb">Set <code>NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS</code> in Vercel.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                  <input
                    readOnly
                    value={stripe}
                    className="yc-input"
                    style={{
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid var(--yc-stroke)",
                      background: "var(--yc-card)",
                      color: "var(--yc-text)",
                      padding: "0 12px",
                    }}
                  />
                  <CopyButton text={stripe} />
                </div>
              )}
            </div>
          </article>

          {/* coinbase link */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🪙</div>
              <h3>Coinbase link (optional)</h3>
              <p className="sub">For new exchange signups.</p>
            </div>
            <div className="card-cta" style={{ gap: 12 }}>
              {!COINBASE ? (
                <p className="blurb">Set <code>NEXT_PUBLIC_COINBASE_REF_URL</code> in Vercel if you use it.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                  <input
                    readOnly
                    value={coinbase}
                    className="yc-input"
                    style={{
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid var(--yc-stroke)",
                      background: "var(--yc-card)",
                      color: "var(--yc-text)",
                      padding: "0 12px",
                    }}
                  />
                  <CopyButton text={coinbase} />
                </div>
              )}
            </div>
          </article>

          {/* tips */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">💡</div>
              <h3>Best practices</h3>
            </div>
            <ul className="blurb" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>Always share links that include your code (<code>?ref=you</code>).</li>
              <li>After a first visit, attribution persists for 1 year across the site and checkout.</li>
              <li>For email, link both the homepage and the Subscribe button.</li>
              <li>Payouts are handled in Stripe. Contact support@yieldcraft.co if something looks off.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
