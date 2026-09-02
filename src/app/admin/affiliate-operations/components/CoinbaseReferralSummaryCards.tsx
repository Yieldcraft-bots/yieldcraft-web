import type { CoinbaseReferralSummary } from "../types/affiliateOperations";

type Props = {
  summary: CoinbaseReferralSummary;
};

export default function CoinbaseReferralSummaryCards({ summary }: Props) {
  const cards = [
    {
      label: "Clicks Today",
      value: summary.clicksToday,
    },
    {
      label: "Clicks 7D",
      value: summary.clicks7d,
    },
    {
      label: "Clicks 30D",
      value: summary.clicks30d,
    },
    {
      label: "Pulse 30D",
      value: summary.pulseClicks30d,
    },
    {
      label: "Atlas 30D",
      value: summary.atlasClicks30d,
    },
    {
      label: "Identified Users 30D",
      value: summary.identifiedUsers30d,
    },
  ];

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
          Coinbase Referral Revenue
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Referral Acquisition
        </h2>

        <p className="mt-2 text-sm text-white/55">
          Live YieldCraft referral-click telemetry for Coinbase acquisition.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">
              {card.label}
            </div>

            <div className="mt-5 text-4xl font-extrabold text-white">
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}