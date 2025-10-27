// src/app/page.tsx
"use client";

const STRIPE_ALL_ACCESS =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS ||
  "https://buy.stripe.com/test_all_access_replace_me";

function YcLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-label="YieldCraft Logo"
      role="img"
    >
      <defs>
        <linearGradient id="ycGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f9d85a" />
          <stop offset="100%" stopColor="#d7b73b" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#ycGold)" />
      <path
        d="M18 38c8-1 10-16 18-17 5 0 7 5 10 9"
        fill="none"
        stroke="#0e1528"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Page() {
  return (
    <main className="yc-page">
      {/* Top bar */}
      <header className="yc-topbar">
        <div className="yc-topbar__left">
          <YcLogo size={28} />
          <span className="yc-brand">YieldCraft</span>
        </div>
        <nav className="yc-nav">
          <a href="#bots">Bots</a>
          <a href="#why">Why YieldCraft</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="yc-actions">
          <a className="yc-btn ghost" href="/login">Log in</a>
          <a className="yc-btn gold" href={STRIPE_ALL_ACCESS} target="_blank" rel="noopener noreferrer">
            Subscribe
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="yc-hero">
        <div className="yc-hero__inner">
          <h1>
            The first <span className="glow">multi-platform direct-execution</span> AI trading platform
          </h1>
          <p>
            Execute directly on <b>Coinbase, Kraken, and IBKR</b> — no middle layers.
            Powered by our institutional predictive stack, <b>Mile-Ahead AI</b>.
          </p>
          <div className="yc-hero__ctas">
            <a className="yc-btn gold lg" href={STRIPE_ALL_ACCESS} target="_blank" rel="noopener noreferrer">
              Subscribe Now
            </a>
            <a className="yc-btn ghost lg" href="#pricing">See Pricing</a>
          </div>
        </div>
      </section>

      {/* Bots / Pricing */}
      <section id="pricing" className="yc-section">
        <h2 className="yc-h2">Strategies tuned to your risk</h2>
        <p className="yc-sub">From conservative scalpers to momentum hunters, pick what fits you.</p>

        <div className="pricing-grid">
          {/* Pulse */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">〰️</div>
              <h3>YieldCraft Pulse</h3>
              <p className="sub">Low-Risk BTC Scalper</p>
              <span className="risk low">Low Risk</span>
            </div>

            <p className="blurb">
              Conservative scalping targeting <b>2–4%</b> monthly returns with minimal drawdown.
            </p>

            <div className="metrics">
              <div><span>Monthly Return</span><b>2–4%</b></div>
              <div><span>Max Drawdown</span><b>&lt;2%</b></div>
            </div>

            <div className="card-cta">
              <div className="price">$9<span>/month</span></div>
              <a className="yc-btn gold stretch" href={STRIPE_ALL_ACCESS} target="_blank" rel="noopener noreferrer">
                Subscribe Now →
              </a>
              <a className="learn" href="#pulse">Learn More</a>
            </div>
          </article>

          {/* Recon */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🌀</div>
              <h3>YieldCraft Recon</h3>
              <p className="sub">AI Signal Scanner</p>
              <span className="risk med">Medium Risk</span>
            </div>

            <p className="blurb">
              Advanced signal layer that powers all other YieldCraft bots. Use as a signal provider
              or pair with Pulse/Ignition.
            </p>

            <div className="metrics">
              <div><span>Monthly Return</span><b>Signal Provider</b></div>
              <div><span>Max Drawdown</span><b>N/A</b></div>
            </div>

            <div className="card-cta">
              <div className="price">$9<span>/month</span></div>
              <a className="yc-btn gold stretch" href={STRIPE_ALL_ACCESS} target="_blank" rel="noopener noreferrer">
                Subscribe Now →
              </a>
              <a className="learn" href="#recon">Learn More</a>
            </div>
          </article>

          {/* Ignition */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🚀</div>
              <h3>YieldCraft Ignition</h3>
              <p className="sub">Aggressive Altcoin Momentum</p>
              <span className="risk high">High Risk</span>
            </div>

            <p className="blurb">
              High-performance momentum bot for experienced traders targeting explosive altcoin moves.
            </p>

            <div className="metrics">
              <div><span>Monthly Return</span><b>10–18%</b></div>
              <div><span>Max Drawdown</span><b>&lt;8%</b></div>
            </div>

            <div className="card-cta">
              <div className="price">$19<span>/month</span></div>
              <a className="yc-btn gold stretch" href={STRIPE_ALL_ACCESS} target="_blank" rel="noopener noreferrer">
                Subscribe Now →
              </a>
              <a className="learn" href="#ignition">Learn More</a>
            </div>
          </article>
        </div>
      </section>

      {/* Why section */}
      <section id="why" className="yc-section compact">
        <h2 className="yc-h2">Why YieldCraft</h2>
        <div className="why-grid">
          <div className="why-card">
            <h4>Direct Execution</h4>
            <p>No 3Commas. No TradingView. We place orders directly on the exchange.</p>
          </div>
          <div className="why-card">
            <h4>Mile-Ahead AI</h4>
            <p>Institutional predictive logic that adapts to regimes and optimizes risk.</p>
          </div>
          <div className="why-card">
            <h4>Made for Builders</h4>
            <p>Fast setup, clean UI, and clear logs. Start today, scale tomorrow.</p>
          </div>
        </div>
      </section>

      <footer className="yc-footer">
        <div className="yc-footer__brand">
          <YcLogo size={22} />
          <span>YieldCraft</span>
        </div>
        <div className="yc-footer__links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="mailto:hello@yieldcraft.co">Contact</a>
        </div>
      </footer>
    </main>
  );
}
