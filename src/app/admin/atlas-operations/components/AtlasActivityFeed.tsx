"use client";

/**
 * ============================================================
 * Atlas Operations
 * Activity Feed
 * ------------------------------------------------------------
 * PURPOSE
 * Read-only operational activity timeline for Atlas.
 *
 * This component displays recent Atlas operational events.
 *
 * NO execution.
 * NO trading.
 * NO policy updates.
 * NO writes.
 * NO mutations.
 * ============================================================
 */

type ActivityItem = {
  id: number;
  title: string;
  description: string;
  time: string;
  status: "success" | "info" | "warning";
};

const activities: ActivityItem[] = [
  {
    id: 1,
    title: "Regression Validation",
    description: "Atlas Labs regression suite completed successfully.",
    time: "Latest Snapshot",
    status: "success",
  },
  {
    id: 2,
    title: "Operations Snapshot",
    description: "Atlas Operations status snapshot generated.",
    time: "Latest Snapshot",
    status: "info",
  },
  {
    id: 3,
    title: "Dashboard Health",
    description: "Read-only operational dashboard loaded.",
    time: "Current Session",
    status: "success",
  },
  {
    id: 4,
    title: "Execution Layer",
    description: "Execution systems remain isolated from Operations.",
    time: "Protected",
    status: "info",
  },
];

function statusClasses(status: ActivityItem["status"]) {
  switch (status) {
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    default:
      return "bg-sky-500";
  }
}

export default function AtlasActivityFeed() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          Read-Only Operations
        </p>

        <h2 className="mt-2 text-2xl font-bold text-slate-50">
          Atlas Activity Feed
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Recent Atlas operational events and intelligence updates.
        </p>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-4 rounded-xl border border-white/10 bg-slate-950 p-4"
          >
            <div
              className={`mt-1 h-3 w-3 rounded-full ${statusClasses(
                activity.status
              )}`}
            />

            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100">
                  {activity.title}
                </h3>

                <span className="text-xs text-slate-500">
                  {activity.time}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                {activity.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}