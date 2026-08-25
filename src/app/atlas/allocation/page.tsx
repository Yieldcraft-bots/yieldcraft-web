import Link from "next/link";

import ClientAllocationForm from "@/components/atlas/ClientAllocationForm";


export default function AtlasAllocationPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-20">
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
                Atlas portfolio setup
              </p>

              <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                Choose Your Atlas Allocation
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Set the target percentage you want assigned to each available
                Atlas asset. Your complete portfolio must total exactly 100%
                before it can be saved.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/atlas"
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
              >
                ← Atlas
              </Link>

              <Link
                href="/atlas/quick-start"
                className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 hover:border-sky-400"
              >
                Setup Guide
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoTile
              title="1. Choose"
              text="Set the target percentage for each asset you want represented."
            />

            <InfoTile
              title="2. Total 100%"
              text="Atlas requires a complete portfolio allocation before saving."
            />

            <InfoTile
              title="3. Review"
              text="After saving, Atlas sends you to your portfolio preview."
            />
          </div>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <ClientAllocationForm />

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
            <p className="text-sm font-semibold text-amber-300">
              Portfolio configuration only
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Saving your allocation does not submit an order. Portfolio
              planning, account eligibility, market eligibility, approval,
              authorization, and any protected Coinbase execution remain
              separate systems.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-slate-200">
              You can update this later
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Return to this page whenever you want to review or change your
              Atlas target percentages. A new valid allocation must still total
              exactly 100%.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}


function InfoTile({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-sm font-semibold text-slate-100">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {text}
      </p>
    </div>
  );
}