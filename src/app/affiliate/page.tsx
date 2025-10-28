// src/app/affiliate/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

function useHomepage() {
  // Vercel preview/prod domains come from location at runtime
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const { origin } = window.location;
      setUrl(origin);
    }
  }, []);
  return url;
}

function CopyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <div className="card" style={{ gap: 10 }}>
      <div className="card-head" style={{ gap: 4 }}>
        <div className="card-icon">🔗</div>
        <h3 style={{ margin: 0 }}>{label}</h3>
        <p className="sub" style={{ marginTop: 2 }}>
          Click copy and share.
        </p>
      </div>

      <div className="flex items-center gap-2" style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={value}
          className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm"
          style={{ width: "100%" }}
        />
        <button onClick={onCopy} className="yc-btn gold" disabled={!value}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function AffiliatePage() {
  const home = useHomepage();
  const [ref, setRef] = useState("");

  const links = useMemo(() => {
    const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return {
      homepage: home ? `${home}/${qs ? qs : ""}` : "",
      stripeAllAccess:
        (process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#") +
        (ref ? `?ref=${encodeURIComponent(ref)}` : ""),
      coinbase:
        (process.env.NEXT_PUBLIC_COINBASE_REF_URL || "#") +
        (ref ? `?ref=${encodeURIComponent(ref)}` : ""),
    };
  }, [home, ref]);

  return (
    <>
      {/* Top hero strip to match landing */}
      <section className="yc-hero" style={{ paddingBottom: 24 }}>
        <div className="yc-hero__inner">
          <h1>Affiliate Hub</h1>
          <p>
            Earn by sharing YieldCraft. Your code tracks across the whole site and into{" "}
            <b>Stripe</b> & <b>Coinbase</b> links — with a one-year attribution window.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10 }}>
            <a className="yc-btn ghost lg" href="/">
              Back to Home
            </a>
          </div>
        </div>
      </section>

      <section className="yc-section">
        <div
          className="pricing-grid"
          style={{ gridTemplateColumns: "repeat(1, minmax(0,1fr))", maxWidth: 900 }}
        >
          {/* Your code */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🏷️</div>
              <h3>Your referral code</h3>
              <p className="sub">This will be appended as <code>?ref=yourcode</code>.</p>
            </div>

            <div className="flex items-center gap-2" style={{ display: "flex", gap: 8 }}>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value.trim())}
                placeholder="yourname"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm"
                style={{ width: "100%" }}
              />
            </div>
          </article>

          {/* Homepage */}
          <CopyRow label="Homepage link" value={links.homepage} />

          {/* Stripe subscribe */}
          <CopyRow label="Stripe subscribe link" value={links.stripeAllAccess} />

          {/* Coinbase */}
          <CopyRow label="Coinbase link (optional)" value={links.coinbase} />

          {/* Tips */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">💡</div>
              <h3>Best practices</h3>
            </div>
            <ul className="blurb" style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                Always share links that include your code (<code>?ref=you</code>).
              </li>
              <li>
                Once a visitor hits the site, their code is saved for a year and auto-appends to
                future links.
              </li>
              <li>
                For email marketing, link both the homepage and the Subscribe button (checkout).
              </li>
              <li>
                Payouts are handled in Stripe. Need help?{" "}
                <a className="learn" href="mailto:support@yieldcraft.co">
                  support@yieldcraft.co
                </a>
                .
              </li>
            </ul>
          </article>
        </div>
      </section>
    </>
  );
}
