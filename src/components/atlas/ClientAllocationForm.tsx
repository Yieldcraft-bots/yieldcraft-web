"use client";

import { ATLAS_ASSET_REGISTRY } from "@/lib/atlas-intelligence/asset-registry";

export default function ClientAllocationForm() {
  const activeAssets = ATLAS_ASSET_REGISTRY.filter(
    (asset) => asset.enabled && asset.status === "ACTIVE"
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-50">
          Portfolio Targets
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Set the target percentage for each active Atlas asset.
        </p>
      </div>

      <div className="space-y-3">
        {activeAssets.map((asset) => (
          <div
            key={asset.symbol}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
          >
            <div>
              <p className="font-semibold text-slate-100">
                {asset.displayName}
              </p>

              <p className="text-xs text-slate-500">
                {asset.symbol} · {asset.assetClass}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                value={100}
                readOnly
                className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right text-sm text-slate-100"
              />

              <span className="text-sm text-slate-400">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <span className="text-sm font-medium text-slate-300">Total</span>

        <span className="text-sm font-semibold text-emerald-300">100%</span>
      </div>
    </div>
  );
}