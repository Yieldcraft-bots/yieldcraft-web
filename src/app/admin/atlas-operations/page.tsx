import Link from "next/link";
import AtlasSummaryCards from "./components/AtlasSummaryCards";
import AtlasFunnel from "./components/AtlasFunnel";
import AtlasExecutionStatus from "./components/AtlasExecutionStatus";
import AtlasIntelligenceHealth from "./components/AtlasIntelligenceHealth";
import AtlasUserGrid from "./components/AtlasUserGrid";

export default function AtlasOperationsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          Atlas Operations
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Atlas Operations Center
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Operational visibility for Atlas onboarding, activation,
          subscriptions, key connections, launch readiness, and read-only
          intelligence health.
        </p>

        <div className="mt-8">
          <AtlasSummaryCards />
        </div>

        <div className="mt-10">
          <AtlasFunnel />
        </div>

        <div className="mt-10">
          <AtlasExecutionStatus />
        </div>

        <div className="mt-10">
          <AtlasIntelligenceHealth />
        </div>

        <div className="mt-10">
          <AtlasUserGrid />
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/admin/control-tower"
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-3 hover:bg-slate-800"
          >
            Control Tower
          </Link>

          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-3 hover:bg-slate-800"
          >
            Mission Control
          </Link>
        </div>
      </div>
    </main>
  );
}