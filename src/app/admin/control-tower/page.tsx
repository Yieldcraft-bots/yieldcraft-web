import Link from "next/link";

export default function ControlTowerPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          YieldCraft Operator
        </p>

        <h1 className="mt-3 text-4xl font-bold">Control Tower</h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Read-only launch and operations visibility for Pulse, Atlas, and Edge
          telemetry. No execution controls. No trading changes. No policy
          promotion from this page.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard title="Launch Readiness" status="Build first" />
          <StatusCard title="Pulse Health" status="Read-only" />
          <StatusCard title="Atlas Health" status="Read-only" />
          <StatusCard title="Edge Intelligence" status="Shadow-only" />
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Operator Links</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TowerLink href="/admin/operators/pulse-roster" label="Pulse Roster" />
            <TowerLink href="/admin/scout-watch" label="Scout Watch" />
            <TowerLink href="/admin/edge-lab" label="Edge Lab" />
            <TowerLink href="/admin/platform" label="Platform" />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusCard({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-3 text-2xl font-semibold">{status}</div>
    </div>
  );
}

function TowerLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm font-semibold hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}