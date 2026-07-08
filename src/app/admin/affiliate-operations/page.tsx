import AffiliateSummaryCards from "./components/AffiliateSummaryCards";
import { getAffiliateSummaryPlaceholder } from "./lib/getAffiliateSummary";

export default function AffiliateOperationsPage() {
  const summary = getAffiliateSummaryPlaceholder();

  return (
    <main className="min-h-screen bg-[#050B16] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
            Mission Control
          </p>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            Affiliate Operations Center
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Read-only operations dashboard for affiliate onboarding, Stripe
            connectivity, referral health, and business telemetry.
          </p>
        </div>

        <AffiliateSummaryCards summary={summary} />

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-semibold">Affiliate Roster</h2>

          <p className="mt-2 text-white/60">
            Live affiliate roster will appear here after the read-only data layer
            is connected.
          </p>
        </section>
      </div>
    </main>
  );
}