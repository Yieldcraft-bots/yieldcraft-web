import AtlasCard from "../../atlas-operations/components/AtlasCard";

export default function CustomerGrid() {
  return (
    <AtlasCard title="Customer Grid">
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
            <tr className="border-t border-white/10 text-slate-300">
              <td className="px-4 py-6 text-slate-500" colSpan={9}>
                Customer data will load here after the read-only Customer
                Success API is connected.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AtlasCard>
  );
}