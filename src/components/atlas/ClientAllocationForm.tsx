"use client";

import { useEffect, useMemo, useState } from "react";

import { getAllocatableAtlasAssets } from "@/lib/atlas-intelligence/asset-catalog";
import { ATLAS_ASSET_REGISTRY } from "@/lib/atlas-intelligence/asset-registry";
import type { ClientAllocationItem } from "@/lib/atlas-intelligence/client-allocation";
import { supabase } from "@/lib/supabaseClient";

type ClientAllocationResponse = {
  ok: boolean;
  allocations?: ClientAllocationItem[];
  error?: string;
  details?: string;
};

export default function ClientAllocationForm() {
  const activeAssets = useMemo(
    () => getAllocatableAtlasAssets(ATLAS_ASSET_REGISTRY),
    []
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

        if (activeAssets.length === 1) {
          setAllocations([
            {
              symbol: activeAssets[0].symbol,
              targetPercent: 100,
            },
          ]);
          return;
        }

        setAllocations(
          activeAssets.map((asset) => ({
            symbol: asset.symbol,
            targetPercent: 0,
          }))
        );
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
  }, [activeAssets]);

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

  const isTotalValid = totalPercent === 100;

  function updateTargetPercent(symbol: string, value: string) {
    const parsedValue = Number(value);

    const targetPercent = Number.isFinite(parsedValue)
      ? Math.max(0, Math.min(100, parsedValue))
      : 0;

    setAllocations((current) => {
      const normalizedSymbol = symbol.toUpperCase();

      const existingAllocation = current.some(
        (allocation) =>
          allocation.symbol.toUpperCase() === normalizedSymbol
      );

      if (!existingAllocation) {
        return [
          ...current,
          {
            symbol,
            targetPercent,
          },
        ];
      }

      return current.map((allocation) =>
        allocation.symbol.toUpperCase() === normalizedSymbol
          ? {
              ...allocation,
              targetPercent,
            }
          : allocation
      );
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-50">
          Portfolio Targets
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Set the target percentage for each available Atlas asset.
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
                      min="0"
                      max="100"
                      step="1"
                      value={targetPercent}
                      onChange={(event) =>
                        updateTargetPercent(
                          asset.symbol,
                          event.target.value
                        )
                      }
                      aria-label={`${asset.displayName} target percentage`}
                      className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right text-sm text-slate-100 outline-none transition focus:border-sky-500"
                    />

                    <span className="text-sm text-slate-400">%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={[
              "flex items-center justify-between rounded-2xl border p-4",
              isTotalValid
                ? "border-emerald-900/60 bg-emerald-950/20"
                : "border-amber-900/60 bg-amber-950/20",
            ].join(" ")}
          >
            <div>
              <span className="text-sm font-medium text-slate-300">
                Total
              </span>

              <p
                className={[
                  "mt-1 text-xs",
                  isTotalValid
                    ? "text-emerald-300/80"
                    : "text-amber-300/80",
                ].join(" ")}
              >
                {isTotalValid
                  ? "Allocation total is valid."
                  : "Allocation percentages must total 100%."}
              </p>
            </div>

            <span
              className={[
                "text-sm font-semibold",
                isTotalValid
                  ? "text-emerald-300"
                  : "text-amber-300",
              ].join(" ")}
            >
              {totalPercent}%
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}