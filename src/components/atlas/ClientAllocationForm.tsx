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

type AssetGroupDefinition = {
  key: "CRYPTO" | "PRIVATE" | "STOCK";
  title: string;
  description: string;
};

const ASSET_GROUPS: readonly AssetGroupDefinition[] = [
  {
    key: "CRYPTO",
    title: "Crypto",
    description:
      "Digital assets supported within the Atlas portfolio configuration universe. Execution remains subject to account and market eligibility.",
  },
  {
    key: "PRIVATE",
    title: "Private Markets",
    description:
      "Selected private-market exposure represented within the Atlas strategy. Configuration does not represent immediate availability, liquidity, or guaranteed execution.",
  },
  {
    key: "STOCK",
    title: "Equities",
    description:
      "Public-company allocations within the Atlas portfolio configuration universe. Execution remains subject to market session, account capability, asset availability, and execution eligibility.",
  },
];

export default function ClientAllocationForm() {
  const activeAssets = useMemo(
    () => getAllocatableAtlasAssets(ATLAS_ASSET_REGISTRY),
    []
  );

  const groupedAssets = useMemo(
    () =>
      ASSET_GROUPS.map((group) => ({
        ...group,
        assets: activeAssets.filter(
          (asset) => asset.assetClass === group.key
        ),
      })).filter((group) => group.assets.length > 0),
    [activeAssets]
  );

  const [allocations, setAllocations] = useState<ClientAllocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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

  const allocatedAssetCount = activeAssets.filter(
    (asset) =>
      (allocationBySymbol.get(asset.symbol.toUpperCase()) ?? 0) > 0
  ).length;

  const allocatedClassCount = new Set(
    activeAssets
      .filter(
        (asset) =>
          (allocationBySymbol.get(asset.symbol.toUpperCase()) ?? 0) > 0
      )
      .map((asset) => asset.assetClass)
  ).size;

  const isTotalValid = totalPercent === 100;

  function updateTargetPercent(symbol: string, value: string) {
    const parsedValue = Number(value);

    const targetPercent = Number.isFinite(parsedValue)
      ? Math.max(0, Math.min(100, parsedValue))
      : 0;

    setSaveError(null);
    setSaveSuccess(null);

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

  async function saveAllocationPlan() {
    if (!isTotalValid || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

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

      const allocationsToSave = activeAssets
        .map((asset) => ({
          symbol: asset.symbol,
          targetPercent:
            allocationBySymbol.get(asset.symbol.toUpperCase()) ?? 0,
        }))
        .filter((allocation) => allocation.targetPercent > 0);

      const response = await fetch("/api/client-allocation", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          allocations: allocationsToSave,
        }),
      });

      const body =
        (await response.json().catch(() => null)) as
          | ClientAllocationResponse
          | null;

      if (!response.ok || !body?.ok) {
        throw new Error(
          body?.details ??
            body?.error ??
            "Unable to save the allocation plan."
        );
      }

      if (body.allocations) {
        setAllocations(body.allocations);
      }

      setSaveSuccess("Allocation plan saved. Redirecting to preview...");
window.location.href = "/atlas/preview";
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save the allocation plan."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
          Portfolio configuration
        </p>

        <h2 className="mt-2 text-xl font-semibold text-slate-50">
          Portfolio Targets
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Build your target portfolio across the Atlas asset universe.
          Allocations must total exactly 100% before they can be saved.
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Assets selected
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-50">
                {allocatedAssetCount}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                of {activeAssets.length} available assets
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Asset classes
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-50">
                {allocatedClassCount}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                represented in your portfolio
              </p>
            </div>

            <div
              className={[
                "rounded-2xl border p-4",
                isTotalValid
                  ? "border-emerald-900/60 bg-emerald-950/20"
                  : "border-amber-900/60 bg-amber-950/20",
              ].join(" ")}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Allocation status
              </p>

              <p
                className={[
                  "mt-2 text-2xl font-bold",
                  isTotalValid
                    ? "text-emerald-300"
                    : "text-amber-300",
                ].join(" ")}
              >
                {totalPercent}%
              </p>

              <p
                className={[
                  "mt-1 text-xs",
                  isTotalValid
                    ? "text-emerald-300/80"
                    : "text-amber-300/80",
                ].join(" ")}
              >
                {isTotalValid
                  ? "Portfolio ready to save"
                  : "Must total exactly 100%"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {groupedAssets.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/30"
              >
                <div className="border-b border-slate-800 bg-slate-900/50 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">
                        {group.title}
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {group.description}
                      </p>
                    </div>

                    <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-400">
                      {group.assets.length}{" "}
                      {group.assets.length === 1 ? "asset" : "assets"}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-800">
                  {group.assets.map((asset) => {
                    const targetPercent =
                      allocationBySymbol.get(
                        asset.symbol.toUpperCase()
                      ) ?? 0;

                    const hasAllocation = targetPercent > 0;

                    return (
                      <div
                        key={asset.symbol}
                        className={[
                          "flex flex-col gap-4 px-5 py-4 transition md:flex-row md:items-center md:justify-between",
                          hasAllocation
                            ? "bg-sky-500/[0.04]"
                            : "bg-transparent",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              "flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-bold",
                              hasAllocation
                                ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                                : "border-slate-800 bg-slate-900 text-slate-500",
                            ].join(" ")}
                          >
                            {asset.symbol.slice(0, 3)}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-100">
                                {asset.displayName}
                              </p>

                              {hasAllocation ? (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                                  Selected
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {asset.symbol} · {asset.assetClass}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={targetPercent}
                            disabled={isSaving}
                            onChange={(event) =>
                              updateTargetPercent(
                                asset.symbol,
                                event.target.value
                              )
                            }
                            aria-label={`${asset.displayName} target percentage`}
                            className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right text-sm font-semibold text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          />

                          <span className="w-5 text-sm text-slate-400">
                            %
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div
            className={[
              "flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between",
              isTotalValid
                ? "border-emerald-900/60 bg-emerald-950/20"
                : "border-amber-900/60 bg-amber-950/20",
            ].join(" ")}
          >
            <div>
              <span className="text-sm font-semibold text-slate-200">
                Portfolio total
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
                  ? "Your target allocation is complete and ready to save."
                  : totalPercent < 100
                    ? `${100 - totalPercent}% remains to be allocated.`
                    : `Reduce the portfolio allocation by ${
                        totalPercent - 100
                      }%.`}
              </p>
            </div>

            <span
              className={[
                "text-2xl font-bold",
                isTotalValid
                  ? "text-emerald-300"
                  : "text-amber-300",
              ].join(" ")}
            >
              {totalPercent}%
            </span>
          </div>

          {saveError ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4"
            >
              <p className="text-sm font-medium text-rose-200">
                Save failed
              </p>

              <p className="mt-1 text-sm text-rose-300/80">
                {saveError}
              </p>
            </div>
          ) : null}

          {saveSuccess ? (
            <div
              role="status"
              className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4"
            >
              <p className="text-sm font-medium text-emerald-300">
                {saveSuccess}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              Saving updates your portfolio configuration only. It does
              not submit an order.
            </p>

            <button
              type="button"
              disabled={!isTotalValid || isSaving}
              onClick={() => void saveAllocationPlan()}
              className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isSaving ? "Saving..." : "Save Allocation"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}