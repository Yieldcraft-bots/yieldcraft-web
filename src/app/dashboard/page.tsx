export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl font-bold text-amber-400">YieldCraft Dashboard</h1>
        <p className="mt-3 text-slate-300">
          This is your early-access dashboard. Bot controls and live stats will appear here as
          we bring more of the engine online.
        </p>

        <div className="mt-10 space-y-4 text-left text-sm text-slate-300 mx-auto max-w-lg">
          <p>• Pulse &amp; Recon status: coming soon in this panel.</p>
          <p>• Daily P&amp;L, trade logs, and risk metrics will live here.</p>
          <p>
            • For now, subscriptions are active and trading runs on your existing backend. This
            page is your home base as we turn on more features.
          </p>
        </div>

        <div className="mt-10">
          <a
            href="/"
            className="inline-block rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to homepage
          </a>
        </div>
      </div>
    </main>
  );
}
