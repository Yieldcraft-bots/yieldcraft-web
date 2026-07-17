"use client";

/**
 * ============================================================
 * Atlas Operations
 * System Health
 * ------------------------------------------------------------
 * PURPOSE
 * Read-only operational health overview.
 *
 * Displays the current status of major Atlas platform
 * subsystems without executing or modifying anything.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No trading
 * - No writes
 * - No policy changes
 * ============================================================
 */

type HealthStatus = "healthy" | "warning";

type HealthItem = {
  id: number;
  name: string;
  description: string;
  status: HealthStatus;
};

const systems: HealthItem[] = [
  {
    id: 1,
    name: "Atlas Operations API",
    description: "Read-only operations endpoints available.",
    status: "healthy",
  },
  {
    id: 2,
    name: "Atlas Labs",
    description: "Regression framework loaded.",
    status: "healthy",
  },
  {
    id: 3,
    name: "Regression Validation",
    description: "Latest validation completed successfully.",
    status: "healthy",
  },
  {
    id: 4,
    name: "Operations Snapshot",
    description: "Latest operational snapshot available.",
    status: "healthy",
  },
];

function badgeClasses(status: HealthStatus) {
  return status === "healthy"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export default function AtlasSystemHealth() {
  const healthyCount = systems.filter(
    (system) => system.status === "healthy"
  ).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
            Read-Only Operations
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-50">
            Atlas System Health
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Current health of Atlas operational services and intelligence
            components.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-emerald-300">
            Healthy Systems
          </div>

          <div className="mt-1 text-2xl font-bold text-white">
            {healthyCount} / {systems.length}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {systems.map((system) => (
          <div
            key={system.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 p-4"
          >
            <div>
              <h3 className="font-semibold text-slate-100">
                {system.name}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                {system.description}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses(
                system.status
              )}`}
            >
              {system.status === "healthy" ? "Healthy" : "Warning"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}