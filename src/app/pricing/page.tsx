// src/app/pricing/page.tsx
export default function PricingPage() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">Pricing</h1>
        <p className="yc-sub">
          Institutional precision, now accessible to everyone. Choose a plan and put your money to
          work — backed by predictive analytics, AI regime detection, and risk-first design.
        </p>

        <div className="pricing-grid">
          {/* PULSE */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">⚡</div>
              <h3>YieldCraft Pulse</h3>
              <p className="sub">Low-Risk BTC Scalper</p>
            </div>

            <span className="risk low">Low Risk</span>
            <p className="blurb">
              Engineered for stability. Pulse focuses on micro-opportunities in BTC — using maker-first
              routing, predictive momentum, and AI-tuned risk controls to compound steady gains.
            </p>

            <div className="metrics">
              <div><span>Target Return</span><b>2–4% monthly</b></div>
              <div><span>Max Drawdown</span><b>&lt;2%</b></div>
            </div>

            <div className="card-cta">
              <div className="price">
                $9<span>/month</span>
              </div>
              <a className="yc-btn gold stretch" href="/subscribe">Subscribe</a>
            </div>
          </article>

          {/* RECON (Included) */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🧭</div>
              <h3>YieldCraft Recon</h3>
              <p className="sub">AI Market Intelligence Layer</p>
            </div>

            <span className="risk med">Included</span>
            <p className="blurb">
              The institutional brain behind every bot — Recon constantly scans market regimes,
              volatility profiles, and cross-asset correlations to identify where capital flows next.
              It’s the kind of adaptive intelligence hedge funds use — now working for you.
            </p>

            <div className="metrics">
              <div><span>Price</span><b>Included with any bot plan</b></div>
              <div><span>Focus</span><b>Signal &amp; Regime Detection</b></div>
            </div>

            <div className="card-cta">
              <div className="price">Included<span> with any plan</span></div>
              <a className="yc-btn ghost stretch" href="/recon">Learn More</a>
            </div>
          </article>

          {/* IGNITION (Coming Soon) */}
          <article className="card">
            <div className="card-head">
              <div className="card-icon">🚀</div>
              <h3>YieldCraft Ignition</h3>
              <p className="sub">High-Momentum Altcoin Strategy</p>
            </div>

            <span className="risk high">High Risk</span>
            <p className="blurb">
              Built for traders who want more velocity. Ignition hunts explosive breakouts in
              high-beta assets using the same predictive framework that powers institutional desks —
              AI regime mapping, volatility clustering, and adaptive trailing exits.
            </p>

            <div className="metrics">
              <div><span>Target Return</span><b>10–18% monthly</b></div>
              <div><span>Max Drawdown</span><b>&lt;8%</b></div>
            </div>

            <div className="card-cta">
              <div className="price">
                $19<span>/month</span>
              </div>
              {/* Coming soon state (no live trading yet) */}
              <a
                className="yc-btn ghost stretch"
                aria-disabled="true"
                style={{ pointerEvents: "none", opacity: 0.6 }}
                href="#"
              >
                Coming Soon
              </a>
            </div>
          </article>
        </div>

        <p className="yc-footnote mt-8">
          YieldCraft was built for those who want their capital to think for itself. Institutional logic,
          predictive analytics, and self-training AI — the same tools used by the world’s biggest funds,
          now running in your corner.
        </p>
      </section>
    </main>
  );
}
