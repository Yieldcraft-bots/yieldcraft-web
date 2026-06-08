import Link from "next/link";

export default function AtlasOperationsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          Atlas Operations
        </p>

        <h1 className="mt-3 text-4xl font-bold">Atlas Operations Center</h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Operational visibility for Atlas onboarding, activation,
          subscriptions, key connections, and launch readiness.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <MetricCard title="Launch Ready" value="6" />
          <MetricCard title="Needs Keys" value="2" />
          <MetricCard title="Needs Subscription" value="9" />
          <MetricCard title="Activation Rate" value="35%" />
        </div>

        <section className="mt-10 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
          <h2 className="text-xl font-bold">Atlas Funnel</h2>

          <div className="mt-6 space-y-4">
            <Row label="Atlas Entitled" value="17" />
            <Row label="Launch Ready" value="6" />
            <Row label="Needs Atlas Keys" value="2" />
            <Row label="Needs Atlas Subscription" value="9" />
          </div>
        </section>

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

function MetricCard(props: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <div className="text-sm text-slate-400">{props.title}</div>
      <div className="mt-3 text-4xl font-bold">{props.value}</div>
    </div>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <span className="text-slate-400">{props.label}</span>
      <span className="font-semibold">{props.value}</span>
    </div>
  );
}