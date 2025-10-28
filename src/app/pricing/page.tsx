// src/app/pricing/page.tsx
export default function PricingPage() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">Pricing</h1>
        <p className="yc-sub">Simple plans. Cancel anytime.</p>

        <div className="pricing-grid">
          <article className="card">
            <div className="card-head">
              <div className="card-icon">⚡</div>
              <h3>YieldCraft Pulse</h3>
              <p className="sub">Low-Risk BTC Scalper</p>
            </div>

            <span className="risk low">Low Risk</span>
            <p className="blurb">
              Conservative scalping targeting <b>2–4% monthly</b>.
            </p>

            <div className="metrics">
              <div>
                <span>Monthly Return</span><b>2–4%</b>
              </div>
              <div>
                <span>Max Drawdown</span><b>&lt;2%</b>
              </div>
            </div>

            <div className="card-cta">
              <div className="price">
                {"$"}9<span>/month</span>
              </div>
              <a className="yc-btn gold stretch" href="/subscribe">Subscribe</a>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
