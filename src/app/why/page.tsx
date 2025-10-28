// src/app/why/page.tsx
export default function WhyYieldCraft() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">Why YieldCraft</h1>
        <p className="yc-sub">
          Direct execution on Coinbase, Kraken, and IBKR — no middle layers. Predictive stack,
          Mile-Ahead AI, and risk-first strategy design.
        </p>

        <ul className="list-disc pl-6 max-w-3xl mt-6 space-y-2 text-[var(--yc-muted)]">
          <li>Direct exchange execution (no signal relays or copy trading)</li>
          <li>Institutional predictive core with regime detection</li>
          <li>Maker-first microstructure logic and drawdown controls</li>
          <li>Transparent pricing, cancel anytime</li>
        </ul>
      </section>
    </main>
  );
}
