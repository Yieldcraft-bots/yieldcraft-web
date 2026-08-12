import Link from "next/link";

export default function AtlasPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/atlas/allocation"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to allocation
        </Link>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Atlas Portfolio Preview
          </p>

          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            Review your Atlas plan
          </h1>

          <p className="mt-4 max-w-2xl text-slate-400">
            This preview shows the portfolio plan generated from your selected
            allocation. No trades are submitted from this page.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
            <h2 className="text-lg font-semibold">
              Portfolio Preview
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Your Atlas allocation and generated portfolio plan will appear
              here for review.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="font-semibold text-amber-300">
              Approval required
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Atlas does not execute from preview. A separate approval boundary
              is required before any protected execution workflow.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}