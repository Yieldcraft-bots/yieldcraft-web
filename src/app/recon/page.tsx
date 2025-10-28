// src/app/recon/page.tsx
export default function ReconPage() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">YieldCraft Recon</h1>
        <p className="yc-sub">
          The institutional AI engine that monitors the market, detects shifts in regime,
          and guides your bots to trade like the pros.
        </p>

        <div className="mt-10 space-y-8 text-lg text-[var(--yc-muted)] leading-relaxed">
          <p>
            Recon is the <b>strategic brain</b> behind every YieldCraft bot. It analyzes
            global market structure, volatility clusters, and liquidity behavior in real
            time — so your strategies adapt automatically to changing conditions.
          </p>

          <p>
            Using <b>regime detection AI</b>, Recon classifies the market into trending,
            ranging, or high-volatility environments. It then relays those signals to bots
            like <b>Pulse</b> and <b>Ignition</b>, ensuring position sizes, entry logic,
            and exit timing align with the current environment.
          </p>

          <p>
            In essence, Recon bridges <b>institutional predictive logic</b> with retail
            accessibility — the same kind of intelligence used by large funds, now running
            inside your personal trading engine.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-2xl bg-[var(--yc-card)] shadow">
              <h3 className="text-xl font-semibold mb-2 text-[var(--yc-gold)]">Signal Layer</h3>
              <p>AI models analyze order-flow, volatility, and sentiment data to forecast
              short-term direction across multiple assets.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--yc-card)] shadow">
              <h3 className="text-xl font-semibold mb-2 text-[var(--yc-gold)]">Regime Engine</h3>
              <p>Continuously detects trending, reversal, and chop phases — optimizing bot
              logic to thrive in each environment.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--yc-card)] shadow">
              <h3 className="text-xl font-semibold mb-2 text-[var(--yc-gold)]">Adaptive Execution</h3>
              <p>Integrates directly with Coinbase, Kraken, and IBKR through YieldCraft’s
              direct-execution stack for zero delay and maximum precision.</p>
            </div>
          </div>

          <p className="mt-10 text-center text-[var(--yc-muted)]">
            <b>Recon comes free with any bot plan</b> — because intelligence shouldn’t be a luxury.
            It’s the core of how the world’s best funds operate, and now, so can you.
          </p>

          <div className="text-center mt-10">
            <a href="/pricing" className="yc-btn gold">Back to Plans</a>
          </div>
        </div>
      </section>
    </main>
  );
}
