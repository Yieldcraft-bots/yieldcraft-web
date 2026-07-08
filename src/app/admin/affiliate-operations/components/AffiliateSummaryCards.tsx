import type { AffiliateSummary } from "../types/affiliateOperations";

type Props = {
  summary: AffiliateSummary;
};

export default function AffiliateSummaryCards({ summary }: Props) {
  const cards = [
    {
      label: "Total Affiliates",
      value: summary.totalAffiliates,
    },
    {
      label: "Active",
      value: summary.activeAffiliates,
    },
    {
      label: "Pending",
      value: summary.pendingAffiliates,
    },
    {
      label: "Stripe Connected",
      value: summary.stripeConnected,
    },
    {
      label: "Stripe Pending",
      value: summary.stripePending,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
    </section>
  );
}