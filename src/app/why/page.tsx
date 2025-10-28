// src/app/why/page.tsx
export default function WhyYieldCraft() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">Why YieldCraft</h1>
        <p className="yc-sub">
          Direct execution on Coinbase — no middle layers. Predictive stack,
          Mile-Ahead AI, and risk-first design.
        </p>

        {/* Status / note */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <div className="card-icon">📌</div>
            <h3>Current Status</h3>
            <p className="sub">Coinbase only (Kraken / IBKR next)</p>
          </div>
          <p className="blurb">
            We’re live on <b>Coinbase</b> now for reliability and speed. Kraken and
            IBKR are queued and will be added after the Coinbase run-in. You can
            subscribe today and start in minutes.
          </p>
        </div>

        {/* Value blocks */}
        <div className="pricing-grid" style={{ marginTop: 16 }}>
          <article className="card">
            <div className="card-head">
              <div className="card-icon">⚡</div>
              <h3>Direct Execution</h3>
              <p className="sub">No signal relays. No copy trading.</p>
            </div>
            <p className="blurb">
              Orders are sent <b>directly</b> to the exchange. That means lower
              latency, fewer moving parts, and fewer points of failure.
            </p>
            <ul className="list-disc pl-6 max-w-xl space-y-2 text-[var(--yc-muted)]">
              <li>Maker-first routing to minimize fees</li>
              <li>Clean, auditable logs per trade</li>
              <li>Drawdown controls baked in</li>
            </ul>
          </article>

          <article className="card">
            <div className="card-head">
              <div className="card-icon">🧭</div>
              <h3>Mile-Ahead AI</h3>
              <p className="sub">Regime detection + risk overlay</p>
            </div>
            <p className="blurb">
              Our Recon layer reads the market regime (trending, mean-reverting,
              chop) and adapts entries/exits to reduce bad fills and stretch good
              moves.
            </p>
            <ul className="list-disc pl-6 max-w-xl space-y-2 text-[var(--yc-muted)]">
              <li>Signal confidence gating</li>
              <li>Trailing profit logic for runners</li>
              <li>Daily risk guardrails</li>
            </ul>
          </article>

          <article className="card">
            <div className="card-head">
              <div className="card-icon">🛡️</div>
              <h3>Built for Real Users</h3>
              <p className="sub">Transparent pricing. Cancel anytime.</p>
            </div>
            <p className="blurb">
              Small, frequent trades with tight risk. Clear metrics. No lock-ins.
              We grow by earning trust, not by trapping you.
            </p>
            <ul className="list-disc pl-6 max-w-xl space-y-2 text-[var(--yc-muted)]">
              <li>Simple monthly plans</li>
              <li>No withdrawal permissions on API keys</li>
              <li>Fast support, honest changelogs</li>
            </ul>
          </article>
        </div>

        {/* CTAs */}
        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <a href="/pricing" className="yc-btn gold">See Pricing</a>
          <a href="/quick-start" className="yc-btn ghost">Quick Start</a>
        </div>
      </section>
    </main>
  );
}
