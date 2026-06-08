import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type AtlasHealth = {
  ok?: boolean;
  total_entitlements?: number;
  atlas_entitled?: number;
  pulse_entitled?: number;
  active_atlas_subscriptions?: number;
  active_total_subscriptions?: number;
  atlas_keys_connected?: number;
  pulse_keys_connected?: number;
  atlas_entitlement_subscription_gap?: number;
  atlas_entitlement_key_gap?: number;
};

async function getAtlasHealth(): Promise<AtlasHealth | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) return null;

    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { data: entitlements } = await supabase
      .from("entitlements")
      .select("user_id, atlas, pulse");

    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("user_id, plan, status");

    const { data: keys } = await supabase
      .from("coinbase_keys")
      .select("user_id, product_scope");

    const entitlementRows = Array.isArray(entitlements) ? entitlements : [];
    const subscriptionRows = Array.isArray(subscriptions) ? subscriptions : [];
    const keyRows = Array.isArray(keys) ? keys : [];

    const atlasEntitled = entitlementRows.filter(
      (r: any) => r.atlas === true
    ).length;

    const pulseEntitled = entitlementRows.filter(
      (r: any) => r.pulse === true
    ).length;

    const activeAtlasSubscriptions = subscriptionRows.filter((r: any) => {
      const plan = String(r.plan || "").toLowerCase();
      return plan.includes("atlas") && r.status === "active";
    }).length;

    const activeTotalSubscriptions = subscriptionRows.filter(
      (r: any) => r.status === "active"
    ).length;

    const atlasKeysConnected = keyRows.filter(
      (r: any) => r.product_scope === "atlas"
    ).length;

    const pulseKeysConnected = keyRows.filter(
      (r: any) => r.product_scope === "pulse"
    ).length;

    return {
      ok: true,
      total_entitlements: entitlementRows.length,
      atlas_entitled: atlasEntitled,
      pulse_entitled: pulseEntitled,
      active_atlas_subscriptions: activeAtlasSubscriptions,
      active_total_subscriptions: activeTotalSubscriptions,
      atlas_keys_connected: atlasKeysConnected,
      pulse_keys_connected: pulseKeysConnected,
      atlas_entitlement_subscription_gap:
        atlasEntitled - activeAtlasSubscriptions,
      atlas_entitlement_key_gap: atlasEntitled - atlasKeysConnected,
    };
  } catch {
    return null;
  }
}

export default async function ControlTowerPage() {
  const atlas = await getAtlasHealth();

  const atlasEntitled = atlas?.atlas_entitled ?? 0;
  const atlasSubs = atlas?.active_atlas_subscriptions ?? 0;
  const atlasKeys = atlas?.atlas_keys_connected ?? 0;
  const atlasSubGap = atlas?.atlas_entitlement_subscription_gap ?? 0;
  const atlasKeyGap = atlas?.atlas_entitlement_key_gap ?? 0;

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
          <StatusCard
            title="Atlas Health"
            status={atlas ? `${atlasEntitled} enabled` : "Unavailable"}
          />
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

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <TowerPanel
            title="Pulse Health"
            eyebrow="Read-only"
            body="Pulse visibility lives in the operator roster. This page only links to it and summarizes the operational lane."
            items={[
              ["Roster", "Existing"],
              ["Pulse entitled", String(atlas?.pulse_entitled ?? "—")],
              ["Pulse keys", String(atlas?.pulse_keys_connected ?? "—")],
              ["Execution controls", "None"],
            ]}
            href="/admin/operators/pulse-roster"
            cta="Open Pulse Roster"
          />

          <TowerPanel
            title="Atlas Health"
            eyebrow="Launch lane"
            body="Atlas visibility tracks entitlement, subscription, connected keys, and setup friction without touching execution."
            items={[
              ["Atlas entitled", String(atlasEntitled)],
              ["Active Atlas subs", String(atlasSubs)],
              ["Atlas keys connected", String(atlasKeys)],
              ["Entitled vs subs gap", String(atlasSubGap)],
              ["Entitled vs keys gap", String(atlasKeyGap)],
            ]}
            href="/atlas/quick-start"
            cta="Open Atlas Quick Start"
          />

          <TowerPanel
            title="Edge Intelligence"
            eyebrow="Shadow-only"
            body="Edge research stays observational. Candidate edges, suppression attribution, and policy status remain separated from execution."
            items={[
              ["Time Kill", "Shadow"],
              ["Offensive candidates", "Watch"],
              ["Policy promotion", "Disabled here"],
            ]}
            href="/admin/edge-lab"
            cta="Open Edge Lab"
          />
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

function TowerPanel({
  title,
  eyebrow,
  body,
  items,
  href,
  cta,
}: {
  title: string;
  eyebrow: string;
  body: string;
  items: [string, string][];
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-xl font-semibold">{title}</h2>
      <p className="mt-3 text-sm text-slate-400">{body}</p>

      <div className="mt-5 space-y-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-sm"
          >
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-slate-100">{value}</span>
          </div>
        ))}
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300"
      >
        {cta}
      </Link>
    </div>
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