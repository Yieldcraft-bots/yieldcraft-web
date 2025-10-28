// src/app/page.tsx
"use client";
import React from "react";

const LINKS = {
  pricing: "/pricing",
  quickStart: "/quick-start",
  affiliate: "/affiliate",
  stripeAllAccess: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#",
};

export default function Home() {
  return (
    <main className="yc-page">
      {/* Hero */}
      <section className="yc-hero">
        <div className="yc-hero__inner">
          <h1>
            The first <span className="glow">multi-platform direct-execution</span> AI trading
            platform
          </h1>
          <p>
            Execute directly on <b>Coinbase, Kraken, and IBKR</b> — no middle layers. Powered by our
            institutional predictive stack, <b>Mile-Ahead AI</b>.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 14 }}>
            <a className="yc-btn gold lg" href={LINKS.stripeAllAccess} target="_blank" rel="noreferrer">
              Subscribe Now
            </a>
            <a className="yc-btn ghost lg" href={LINKS.pricing}>See Pricing</a>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="yc-section">
        <h2 className="yc-h2">Strategies tuned to your risk</h2>
        <p className="yc-sub">From conservative scalpers to momentum hunters, pick what fits you.</p>

        <div className="pricing-grid">
          {/* Pulse */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">⚡</div>
              <h3>YieldCraft Pulse</h3>
              <p className="sub">Low-Risk BTC Scalper</p>
            </div>
            <span className="risk low">Low Risk</span>
            <p className="blurb">
              Conservative scalping targeting <b>2–4% monthly</b> with minimal drawdown.
            </p>
            <div className="metrics">
              <div><span>Monthly Return</span><b>2–4%</b></div>
              <div><span>Max Drawdown</span><b>&lt;2%</b></div>
            </div>
            <div className="card-cta">
              <div className="price">$9<span>/month</span></div>
              <a className="yc-btn gold stretch" href={LINKS.stripeAllAccess} target="_blank" rel="noreferrer">Subscribe</a>
              <a className="learn" href="/bots/pulse">Learn more</a>
            </div>
          </article>

          {/* Recon */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🧭</div>
              <h3>YieldCraft Recon</h3>
              <p className="sub">AI Signal Scanner</p>
            </div>
            <span className="risk med">Medium Risk</span>
            <p className="blurb">
              Advanced signal layer that powers all other YieldCraft bots or can run standalone.
            </p>
            <div className="metrics">
              <div><span>Monthly Return</span><b>Signal Provider</b></div>
              <div><span>Max Drawdown</span><b>N/A</b></div>
            </div>
            <div className="card-cta">
              <div className="price">$9<span>/month</span></div>
              <a className="yc-btn gold stretch" href={LINKS.stripeAllAccess} target="_blank" rel="noreferrer">Subscribe</a>
              <a className="learn" href="/bots/recon">Learn more</a>
            </div>
          </article>

          {/* Ignition */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🚀</div>
              <h3>YieldCraft Ignition</h3>
              <p className="sub">Aggressive Altcoin Momentum</p>
            </div>
            <span className="risk high">High Risk</span>
            <p className="blurb">
              High-performance momentum bot targeting explosive altcoin moves. For experienced traders.
            </p>
            <div className="metrics">
              <div><span>Monthly Return</span><b>10–18%</b></div>
              <div><span>Max Drawdown</span><b>&lt;8%</b></div>
            </div>
            <div className="card-cta">
              <div className="price">$19<span>/month</span></div>
              <a className="yc-btn gold stretch" href={LINKS.stripeAllAccess} target="_blank" rel="noreferrer">Subscribe</a>
              <a className="learn" href="/bots/ignition">Learn more</a>
            </div>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="yc-footer">
        <div className="yc-footer__brand">© 2025 YieldCraft. All rights reserved.</div>
        <div className="yc-footer__links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/contact">Contact</a>
        </div>
      </footer>
    </main>
  );
}
