"use client";

import { useEffect, useState } from "react";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type Customer = {
  user_id: string;
  plan: string | null;
  subscription_status: string | null;
  signup_at: string | null;
  atlas_entitled: boolean;
  pulse_entitled: boolean;
  atlas_key_connected: boolean;
  pulse_key_connected: boolean;
  health: string;
  next_action: string;
};

type CustomerSuccessResponse = {
  ok: boolean;
  customers?: Customer[];
};

export default function CustomerGrid() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function loadCustomers() {
    setLoading(true);

    const res = await fetch("/api/admin/customer-success", {
      cache: "no-store",
    });

    const json: CustomerSuccessResponse = await res.json();

    if (json.ok && Array.isArray(json.customers)) {
      setCustomers(json.customers);
      setLastUpdated(new Date().toLocaleTimeString());
    }

    setLoading(false);
  }

  useEffect(() => {
    let alive = true;

    async function safeLoad() {
      if (!alive) return;
      await loadCustomers();
    }

    safeLoad().catch(console.error);

    const interval = window.setInterval(() => {
      safeLoad().catch(console.error);
    }, 60_000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <AtlasCard title="Customer Grid">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          {lastUpdated ? `Updated ${lastUpdated}` : "Loading customers"}
        </div>

        <button
          type="button"
          onClick={() => loadCustomers().catch(console.error)}
          className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-4">Customer</th>
              <th className="px-4 py-4">Plan</th>
              <th className="px-4 py-4">Signup</th>
              <th className="px-4 py-4">Subscription</th>
              <th className="px-4 py-4">Keys</th>
              <th className="px-4 py-4">Atlas</th>
              <th className="px-4 py-4">Pulse</th>
              <th className="px-4 py-4">Health</th>
              <th className="px-4 py-4">Next Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.user_id}
                className="border-t border-white/10 text-slate-300"
              >
                <td className="px-4 py-4 font-mono text-xs">
                  {shortUser(customer.user_id)}
                </td>

                <td className="px-4 py-4 capitalize">
                  {customer.plan || "—"}
                </td>

                <td className="px-4 py-4">
                  {formatDate(customer.signup_at)}
                </td>

                <td className="px-4 py-4 capitalize">
                  {customer.subscription_status || "—"}
                </td>

                <td className="px-4 py-4">
                  <KeyStatus
                    atlas={customer.atlas_key_connected}
                    pulse={customer.pulse_key_connected}
                  />
                </td>

                <td className="px-4 py-4">
                  {customer.atlas_entitled ? "Yes" : "No"}
                </td>

                <td className="px-4 py-4">
                  {customer.pulse_entitled ? "Yes" : "No"}
                </td>

                <td className="px-4 py-4">
                  <HealthPill value={customer.health} />
                </td>

                <td className="px-4 py-4 text-slate-400">
                  {customer.next_action || "No Action"}
                </td>
              </tr>
            ))}

            {!loading && customers.length === 0 ? (
              <tr className="border-t border-white/10 text-slate-300">
                <td className="px-4 py-8 text-slate-500" colSpan={9}>
                  No customer records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AtlasCard>
  );
}

function KeyStatus(props: { atlas: boolean; pulse: boolean }) {
  if (props.atlas && props.pulse) return <span>Atlas + Pulse</span>;
  if (props.atlas) return <span>Atlas</span>;
  if (props.pulse) return <span>Pulse</span>;
  return <span>Needed</span>;
}

function HealthPill(props: { value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
      {props.value}
    </span>
  );
}

function shortUser(userId: string) {
  if (!userId) return "—";
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}