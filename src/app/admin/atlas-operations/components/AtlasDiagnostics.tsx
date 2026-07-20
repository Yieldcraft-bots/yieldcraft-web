"use client";

/**
 * ============================================================
 * Atlas Operations
 * Diagnostics
 * ------------------------------------------------------------
 * PURPOSE
 * Read-only diagnostics panel for Atlas Operations.
 *
 * Displays operational diagnostics and guidance only.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No writes
 * - No trading
 * - No policy changes
 * ============================================================
 */

import AtlasCard from "./AtlasCard";

type DiagnosticItem = {
  title: string;
  description: string;
  severity: "Info";
};

const diagnostics: DiagnosticItem[] = [
  {
    title: "Read-Only Dashboard",
    description:
      "Atlas Operations never executes trades. It only visualizes operational state.",
    severity: "Info",
  },
  {
    title: "Execution Isolation",
    description:
      "Pulse, Atlas execution, Recon, Coinbase, and policy engines remain completely isolated from this interface.",
    severity: "Info",
  },
  {
    title: "Operator Guidance",
    description:
      "Any operational issues should be investigated through the appropriate operational APIs rather than from this dashboard.",
    severity: "Info",
  },
];

export default function AtlasDiagnostics() {
  return (
    <AtlasCard title="Diagnostics">
      <div className="space-y-4">
        {diagnostics.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-sky-500/20 bg-slate-950/40 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">
                {item.title}
              </h3>

              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                {item.severity}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </AtlasCard>
  );
}