import type { AffiliateConversionSummary } from "../types/affiliateOperations";

type Props = {
  summary: AffiliateConversionSummary;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatLatestConversion(value: string | null) {
  if (!value) return "None";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AffiliateConversionSummaryCards({ summary }: Props) {
  const cards = [
    {
      label: "Conversions",
      value: summary.totalConversions,
    },
    {
      label: "Referred Revenue",
      value: formatCurrency(summary.totalReferredRevenue),
    },
    {
      label: "Recorded Commission",
      value: formatCurrency(summary.totalRecordedCommission),
    },
    {
      label: "Latest Conversion",
      value: formatLatestConversion(summary.latestConversionAt),
    },
  ];

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
          YieldCraft Affiliate Revenue
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Conversion Performance
        </h2>

        <p className="mt-2 text-sm text-white/55">
          Read-only telemetry from recorded affiliate conversions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">
              {card.label}
            </div>

            <div className="mt-5 text-2xl font-extrabold text-white">
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}