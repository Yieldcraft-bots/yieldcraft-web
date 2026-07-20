import Link from "next/link";

import ClientAllocationForm from "@/components/atlas/ClientAllocationForm";

export default function AtlasAllocationPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Atlas client configuration
            </p>

            <h1 className="mt-3 text-3xl font-bold md:text-4xl">
              Target Allocation
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Set the percentage of your Atlas portfolio assigned to each
              supported asset. Your targets must total exactly 100%.
            </p>
          </div>

          <Link
            href="/atlas"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to Atlas
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <ClientAllocationForm />

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
            <p className="text-sm font-semibold text-amber-300">
              Configuration only
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Saving an allocation does not place an order. Atlas execution,
              policy checks, eligibility checks and Coinbase activity remain
              separate protected systems.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}