import Link from "next/link";
import CustomerSummaryCards from "./components/CustomerSummaryCards";
import CustomerOnboarding from "./components/CustomerOnboarding";
import CommunicationQueue from "./components/CommunicationQueue";
import CustomerGrid from "./components/CustomerGrid";

export default function CustomerSuccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">
          Customer Success
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Customer Success Center
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Read-only onboarding, communication, and customer health visibility.
          Built to help YieldCraft communicate only when it matters.
        </p>

        <div className="mt-8">
          <CustomerSummaryCards />
        </div>

        <div className="mt-10">
          <CustomerOnboarding />
        </div>

        <div className="mt-10">
          <CommunicationQueue />
        </div>

        <div className="mt-10">
          <CustomerGrid />
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-bold text-white">
            Customer Success Shell
          </h2>

          <p className="mt-3 text-slate-400">
            This page is intentionally being built one component at a time.
            Next we will connect each component to live telemetry using the same
            safe, read-only architecture established by Atlas Operations.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-3 hover:bg-slate-800"
          >
            Mission Control
          </Link>

          <Link
            href="/admin/atlas-operations"
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-3 hover:bg-slate-800"
          >
            Atlas Operations
          </Link>
        </div>
      </div>
    </main>
  );
}