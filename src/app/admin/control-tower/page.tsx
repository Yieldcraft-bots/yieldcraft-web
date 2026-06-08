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
          <StatusCard title="Launch Readiness" status="PASS" />
          <StatusCard title="Pulse Health" status="Read-only" />
          <StatusCard title="Atlas Health" status="Read-only" />
          <StatusCard title="Edge Intelligence" status="Shadow-only" />
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Launch Readiness</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Static operator checklist for the public Atlas launch path. This
            panel does not call APIs, change state, or touch execution.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ChecklistItem label="Homepage" status="PASS" href="/" />
            <ChecklistItem label="Pricing" status="PASS" href="/pricing" />
            <ChecklistItem label="Atlas Page" status="PASS" href="/atlas" />
            <ChecklistItem
              label="Atlas Quick Start"
              status="PASS"
              href="/atlas/quick-start"
            />
            <ChecklistItem label="Success Page" status="PASS" href="/success" />
            <ChecklistItem
              label="Connect Keys"
              status="PASS"
              href="/connect-keys?product=atlas"
            />
            <ChecklistItem label="Dashboard" status="PASS" href="/dashboard" />
            <ChecklistItem label="Login" status="PASS" href="/login" />
            <ChecklistItem label="Stripe Flow" status="VERIFY" href="/pricing" />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Operator Links</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TowerLink
              href="/admin/operators/pulse-roster"
              label="Pulse Roster"
            />
            <TowerLink href="/admin/scout-watch" label="Scout Watch" />
            <TowerLink href="/admin/edge-lab" label="Edge Lab" />
            <TowerLink href="/admin/platform" label="Platform" />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  title,
  status,
}: {
  title: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-3 text-2xl font-semibold">{status}</div>
    </div>
  );
}

function ChecklistItem({
  label,
  status,
  href,
}: {
  label: string;
  status: "PASS" | "VERIFY" | "WATCH";
  href: string;
}) {
  const tone =
    status === "PASS"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : status === "VERIFY"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-slate-700 bg-slate-900 text-slate-200";

  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm hover:bg-slate-800"
    >
      <span className="font-semibold text-slate-100">{label}</span>
      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
        {status}
      </span>
    </Link>
  );
}

function TowerLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm font-semibold hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}