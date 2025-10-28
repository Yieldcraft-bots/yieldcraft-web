// src/app/bots/page.tsx
export default function BotsPage() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">Our Bots</h1>
        <p className="yc-sub">Pick the strategy that fits your risk.</p>

        <div className="pricing-grid">
          <article className="card">
            <div className="card-head">
              <div className="card-icon">⚡</div>
              <h3>YieldCraft Pulse</h3>
              <p className="sub">Low-Risk BTC Scalper</p>
            </div>
            <span className="risk low">Low Risk</span>
            <p className="blurb">Conservative scalping targeting 2–4% monthly with minimal drawdown.</p>
            <div className="metrics">
              <div><span>Monthly Return</span><b>2–4%</b></div>
              <div><span>Max Drawdown</span><b>&lt;2%</b></div>
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div className="card-icon">🧭</div>
              <h3>YieldCraft Recon</h3>
              <p className="sub">AI Signal Scanner</p>
            </div>
            <span className="risk med">Medium Risk</span>
            <p className="blurb">Advanced signal layer that powers all other YieldCraft bots or runs standalone.</p>
            <div className="metrics">
              <div><span>Monthly Return</span><b>Signal Provider</b></div>
              <div><span>Max Drawdown</span><b>N/A</b></div>
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div className="card-icon">🚀</div>
              <h3>YieldCraft Ignition</h3>
              <p className="sub">Aggressive Altcoin Momentum</p>
            </div>
            <span className="risk high">High Risk</span>
            <p className="blurb">High-performance momentum bot targeting explosive altcoin moves.</p>
            <div className="metrics">
              <div><span>Monthly Return</span><b>10–18%</b></div>
              <div><span>Max Drawdown</span><b>&lt;8%</b></div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
