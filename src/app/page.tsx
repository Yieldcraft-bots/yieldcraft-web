// src/app/page.tsx
export default function Home() {
  return (
    <div className="yc-page">
      {/* ===== Topbar ===== */}
      <header className="yc-topbar">
        <div className="yc-topbar__inner">
          <a href="/" className="yc-brand">
            <img
              src="/yc-shield-gold.png"
              alt="YieldCraft"
              width={28}
              height={28}
              style={{ borderRadius: '6px' }}
            />
            <span className="yc-brand__text">YieldCraft</span>
          </a>

          <nav className="yc-nav">
            <a href="/bots">Bots</a>
            <a href="/why">Why YieldCraft</a>
            <a href="/pricing">Pricing</a>
            <a href="/quick-start">Quick Start</a>
            <a href="/affiliate">Affiliate</a>
          </nav>

          <div className="yc-actions">
            <a href="/login" className="yc-btn ghost">Log in</a>
            <a href="/pricing" className="yc-btn gold">Subscribe</a>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="yc-hero">
        <div className="yc-hero__inner">
          <h1 className="h1-gloss">
            The first <span className="glow">multi-platform direct-execution AI</span><br />
            trading platform
          </h1>
          <p className="yc-underline" style={{ marginTop: 10 }}>
            Execute directly on <strong>Coinbase, Kraken, and IBKR</strong> — no middle layers.
            Powered by our institutional predictive stack, <strong>Mile-Ahead AI</strong>.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: 18 }}>
            <a href="/pricing" className="yc-btn gold lg">Subscribe Now</a>
            <a href="/pricing" className="yc-btn primary lg">See Pricing</a>
          </div>
        </div>
      </section>

      {/* ===== Pricing / Bots ===== */}
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
              <span className="risk low">Low Risk</span>
            </div>

            <p className="blurb">
              Conservative scalping targeting <strong>2–4% monthly</strong> with minimal drawdown.
            </p>

            <div className="metrics">
              <div>
                <span>Monthly Return</span>
                <strong>2–4%</strong>
              </div>
              <div>
                <span>Max Drawdown</span>
                <strong>&lt;2%</strong>
              </div>
            </div>

            <div className="card-cta">
              <div className="price">$9<span>/month</span></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href="/pricing#pulse" className="yc-btn gold">Subscribe</a>
                <a href="/bots#pulse" className="yc-btn ghost">Learn more</a>
              </div>
            </div>
          </article>

          {/* Recon */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🔎</div>
              <h3>YieldCraft Recon</h3>
              <p className="sub">AI Signal Scanner</p>
              <span className="risk med">Medium Risk</span>
            </div>

            <p className="blurb">
              Advanced signal layer that powers all other YieldCraft bots or can run standalone.
            </p>

            <div className="metrics">
              <div>
                <span>Monthly Return</span>
                <strong>Signal Provider</strong>
              </div>
              <div>
                <span>Max Drawdown</span>
                <strong>N/A</strong>
              </div>
            </div>

            <div className="card-cta">
              <div className="price">$9<span>/month</span></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href="/pricing#recon" className="yc-btn gold">Subscribe</a>
                <a href="/bots#recon" className="yc-btn ghost">Learn more</a>
              </div>
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
              High-performance momentum bot targeting explosive altcoin moves. For experienced traders.
            </p>

            <div className="metrics">
              <div>
                <span>Monthly Return</span>
                <strong>10–18%</strong>
              </div>
              <div>
                <span>Max Drawdown</span>
                <strong>&lt;8%</strong>
              </div>
            </div>

            <div className="card-cta">
              <div className="price">$39<span>/month</span></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href="/pricing#ignition" className="yc-btn gold">Subscribe</a>
                <a href="/bots#ignition" className="yc-btn ghost">Learn more</a>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="yc-footer">
        <div className="yc-footer__brand">
          <img src="/yc-shield-gold.png" alt="YieldCraft" width={20} height={20} style={{ borderRadius: 6 }} />
          <span>YieldCraft</span>
        </div>
        <div className="yc-footer__links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/contact">Contact</a>
        </div>
      </footer>
    </div>
  );
}
