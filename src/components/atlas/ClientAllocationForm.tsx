"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import { ATLAS_ASSET_REGISTRY } from "@/lib/atlas-intelligence/asset-registry";
import type { ClientAllocationItem } from "@/lib/atlas-intelligence/client-allocation";

type ClientAllocationResponse = {
  ok: boolean;
  allocations?: ClientAllocationItem[];
  error?: string;
  details?: string;
};

export default function ClientAllocationForm() {
  const activeAssets = ATLAS_ASSET_REGISTRY.filter(
    (asset) => asset.enabled && asset.status === "ACTIVE"
  );

  const [allocations, setAllocations] = useState<ClientAllocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAllocationPlan() {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        const token = data.session?.access_token ?? "";

        if (!token) {
          throw new Error("Not signed in. Please log in again.");
        }

        const response = await fetch("/api/client-allocation", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const body =
          (await response.json().catch(() => null)) as
            | ClientAllocationResponse
            | null;

        if (!response.ok || !body?.ok) {
          throw new Error(
            body?.details ??
              body?.error ??
              "Unable to load the allocation plan."
          );
        }

        if (cancelled) {
          return;
        }

        if (body.allocations && body.allocations.length > 0) {
          setAllocations(body.allocations);
          return;
        }

        const enabledAssets = ATLAS_ASSET_REGISTRY.filter(
          (asset) => asset.enabled && asset.status === "ACTIVE"
        );

        if (enabledAssets.length === 1) {
          setAllocations([
            {
              symbol: enabledAssets[0].symbol,
              targetPercent: 100,
            },
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load the allocation plan."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAllocationPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  const allocationBySymbol = new Map(
    allocations.map((allocation) => [
      allocation.symbol.toUpperCase(),
      allocation.targetPercent,
    ])
  );

  const totalPercent = activeAssets.reduce(
    (total, asset) =>
      total +
      (allocationBySymbol.get(asset.symbol.toUpperCase()) ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-50">
          Portfolio Targets
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Review the target percentage for each active Atlas asset.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-sm text-slate-400">
            Loading your allocation plan...
          </p>
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4"
        >
          <p className="text-sm font-medium text-rose-200">
            Allocation plan unavailable
          </p>

          <p className="mt-1 text-sm text-rose-300/80">
            {loadError}
          </p>
        </div>
      ) : null}

      {!isLoading && !loadError ? (
        <>
          <div className="space-y-3">
            {activeAssets.map((asset) => {
              const targetPercent =
                allocationBySymbol.get(asset.symbol.toUpperCase()) ?? 0;

              return (
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
                      value={targetPercent}
                      readOnly
                      aria-label={`${asset.displayName} target percentage`}
                      className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right text-sm text-slate-100"
                    />

                    <span className="text-sm text-slate-400">%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <span className="text-sm font-medium text-slate-300">
              Total
            </span>

            <span className="text-sm font-semibold text-emerald-300">
              {totalPercent}%
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}