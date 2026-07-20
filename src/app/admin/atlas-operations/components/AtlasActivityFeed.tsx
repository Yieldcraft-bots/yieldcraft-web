"use client";

/**
 * ============================================================
 * Atlas Operations
 * Activity Feed
 * ------------------------------------------------------------
 * PURPOSE
 * Read-only operational activity area for Atlas.
 *
 * This component does not fabricate operational events.
 * It displays an explicit unavailable state until a verified
 * read-only activity source is connected.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No trading
 * - No policy updates
 * - No writes
 * - No mutations
 * ============================================================
 */

export default function AtlasActivityFeed() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          Read-Only Operations
        </p>

        <h2 className="mt-2 text-2xl font-bold text-slate-50">
          Atlas Activity Feed
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Verified Atlas operational events and intelligence updates.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-sky-500/20 bg-slate-950/40 p-5">
        <div className="flex items-start gap-4">
          <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-sky-500" />

          <div>
            <h3 className="font-semibold text-slate-100">
              Activity source not connected
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              No verified read-only Atlas activity source is currently
              connected to this panel. Operational events will appear here only
              after they can be retrieved from an authoritative read-only API.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        No execution, trading, policy, or mutation controls are available from
        this component.
      </p>
    </section>
  );
}