type AffiliateRosterRow = {
  id: string;
  name: string | null;
  email: string | null;
  affiliate_code: string | null;
  status: string | null;
  commission_rate: number | null;
  stripe_account_id: string | null;
  created_at: string | null;
};

type Props = {
  affiliates: AffiliateRosterRow[];
};

function StatusBadge({ status }: { status: string | null }) {
  const value = (status ?? "").toLowerCase();

  if (value === "active") {
    return (
      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
        Active
      </span>
    );
  }

  if (value === "pending") {
    return (
      <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
        Pending
      </span>
    );
  }

  return (
    <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
      {status || "Unknown"}
    </span>
  );
}

function StripeBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-300">
      Connected
    </span>
  ) : (
    <span className="rounded-full bg-slate-600/40 px-3 py-1 text-xs font-semibold text-slate-300">
      Missing
    </span>
  );
}

export default function AffiliateRosterTable({ affiliates }: Props) {
  return (
    <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Affiliate Roster</h2>

        <p className="mt-2 text-white/60">
          Read-only list of affiliate records from Supabase.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-white/45">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Commission</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {affiliates.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-white/50"
                  colSpan={7}
                >
                  No affiliate records found.
                </td>
              </tr>
            ) : (
              affiliates.map((affiliate) => (
                <tr
                  key={affiliate.id}
                  className="text-white/80 transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-4 font-semibold text-white">
                    {affiliate.name || "—"}
                  </td>

                  <td className="px-4 py-4">
                    {affiliate.email || "—"}
                  </td>

                  <td className="px-4 py-4 font-mono">
                    {affiliate.affiliate_code || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={affiliate.status} />
                  </td>

                  <td className="px-4 py-4">
                    <StripeBadge
                      connected={!!affiliate.stripe_account_id}
                    />
                  </td>

                  <td className="px-4 py-4">
                    {affiliate.commission_rate ?? 0}%
                  </td>

                  <td className="px-4 py-4">
                    {affiliate.created_at
                      ? new Date(
                          affiliate.created_at
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}