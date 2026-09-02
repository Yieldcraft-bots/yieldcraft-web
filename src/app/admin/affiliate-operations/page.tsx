import AffiliateSummaryCards from "./components/AffiliateSummaryCards";
import AffiliateRosterTable from "./components/AffiliateRosterTable";
import CoinbaseReferralSummaryCards from "./components/CoinbaseReferralSummaryCards";

import { getAffiliateSummary } from "./lib/getAffiliateSummary";
import { getAffiliateRoster } from "./lib/getAffiliateRoster";
import { getCoinbaseReferralSummary } from "./lib/getCoinbaseReferralSummary";

export default async function AffiliateOperationsPage() {
  const [summary, affiliates, coinbaseReferralSummary] = await Promise.all([
    getAffiliateSummary(),
    getAffiliateRoster(),
    getCoinbaseReferralSummary(),
  ]);

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

        <CoinbaseReferralSummaryCards summary={coinbaseReferralSummary} />

        <AffiliateRosterTable affiliates={affiliates} />
      </div>
    </main>
  );
}