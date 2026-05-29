import { createClient } from "@supabase/supabase-js";
import RefreshReconciliationButton from "./RefreshReconciliationButton";

export const dynamic = "force-dynamic";

async function getRoster() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("pulse_operator_roster_v1")
    .select("*")
    .order("reconciliation_status", { ascending: true });

  if (error) {
    console.error("pulse roster error", error);
    return [];
  }

  return data || [];
}

export default async function PulseRosterPage() {
  const roster = await getRoster();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Pulse Operator Roster
        </h1>

        <p className="text-zinc-400 mb-6">
          Read-only multi-user reconciliation layer.
        </p>

        <RefreshReconciliationButton />

        <div className="overflow-auto border border-zinc-800 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">BTC</th>
                <th className="text-left p-3">Equity</th>
                <th className="text-left p-3">Last Checked</th>
                <th className="text-left p-3">Failure</th>
              </tr>
            </thead>

            <tbody>
              {roster.map((row: any) => (
                <tr
                  key={`${row.user_id}-${row.exchange}`}
                  className="border-t border-zinc-800"
                >
                  <td className="p-3">
                    {row.email || "-"}
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-1 rounded bg-zinc-800">
                      {row.reconciliation_status}
                    </span>
                  </td>

                  <td className="p-3">
                    {Number(row.btc_balance || 0).toFixed(8)}
                  </td>

                  <td className="p-3">
                    ${Number(row.equity_usd || 0).toFixed(2)}
                  </td>

                  <td className="p-3">
                    {row.last_checked_at || "-"}
                  </td>

                  <td className="p-3 text-red-400">
                    {row.latest_failure_error || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}