"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ClientAllocationItem } from "@/lib/atlas-intelligence/client-allocation";
import { supabase } from "@/lib/supabaseClient";


type ClientAllocationResponse = {
  ok: boolean;
  allocations?: ClientAllocationItem[];
  error?: string;
  details?: string;
};


export default function AtlasPreviewPage() {
  const [allocations, setAllocations] =
    useState<ClientAllocationItem[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;


    async function loadSavedAllocation() {
      try {
        setIsLoading(true);
        setLoadError(null);


        const {
          data,
          error: sessionError,
        } =
          await supabase.auth.getSession();


        if (sessionError) {
          throw new Error(
            sessionError.message
          );
        }


        const token =
          data.session?.access_token ??
          "";


        if (!token) {
          throw new Error(
            "Not signed in. Please log in again."
          );
        }


        const response =
          await fetch(
            "/api/client-allocation",
            {
              method:
                "GET",

              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },
            }
          );


        const body =
          (
            await response
              .json()
              .catch(
                () => null
              )
          ) as
            | ClientAllocationResponse
            | null;


        if (
          !response.ok ||
          !body?.ok
        ) {
          throw new Error(
            body?.details ??
              body?.error ??
              "Unable to load your saved allocation."
          );
        }


        if (cancelled) {
          return;
        }


        setAllocations(
          body.allocations ??
          []
        );

      } catch (error) {

        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your saved allocation."
          );
        }

      } finally {

        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }


    void loadSavedAllocation();


    return () => {
      cancelled = true;
    };
  }, []);


  const totalPercent =
    useMemo(
      () =>
        allocations.reduce(
          (
            total,
            allocation
          ) =>
            total +
            Number(
              allocation.targetPercent
            ),
          0
        ),
      [
        allocations,
      ]
    );


  const valid =
    allocations.length >
      0 &&
    totalPercent ===
      100;


  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-12 pt-20 text-slate-100">
      <div className="mx-auto max-w-5xl">

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/atlas/allocation"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            ← Back to Allocation
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/atlas/quick-start"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              Setup Guide
            </Link>

            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              Dashboard
            </Link>
          </div>
        </div>


        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8">

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Atlas portfolio setup
          </p>

          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            Review Your Atlas Allocation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            Review the Atlas target percentages saved to your
            account. Your allocation can be updated whenever you
            want. This page is read-only and does not create an
            approval, authorization, execution reservation, or
            Coinbase order.
          </p>


          {/* Loading */}
          {isLoading ? (
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
              <p className="text-sm text-slate-400">
                Loading your saved Atlas allocation...
              </p>
            </div>
          ) : null}


          {/* Error */}
          {!isLoading &&
          loadError ? (
            <div className="mt-8 rounded-2xl border border-rose-900/60 bg-rose-950/30 p-6">
              <p className="font-semibold text-rose-200">
                Unable to load allocation
              </p>

              <p className="mt-2 text-sm leading-6 text-rose-300/80">
                {loadError}
              </p>

              <div className="mt-5">
                <Link
                  href="/atlas/allocation"
                  className="inline-flex rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
                >
                  Return to Allocation
                </Link>
              </div>
            </div>
          ) : null}


          {/* No saved allocation */}
          {!isLoading &&
          !loadError &&
          allocations.length ===
            0 ? (
            <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
              <p className="font-semibold text-amber-300">
                No saved allocation found
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Atlas does not currently have a saved
                allocation for this signed-in account.
              </p>

              <div className="mt-5">
                <Link
                  href="/atlas/allocation"
                  className="inline-flex rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
                >
                  Set Allocation
                </Link>
              </div>
            </div>
          ) : null}


          {/* Saved allocation */}
          {!isLoading &&
          !loadError &&
          allocations.length >
            0 ? (
            <>

              {/* Summary */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">

                <SummaryCard
                  label="Allocation"
                  value={`${totalPercent}%`}
                  detail="Target portfolio total"
                />

                <SummaryCard
                  label="Assets"
                  value={String(
                    allocations.length
                  )}
                  detail="Assets in your saved allocation"
                />

                <StatusCard
                  valid={valid}
                />

              </div>


              {/* Strong completion state */}
              <div
                className={[
                  "mt-6 rounded-2xl border p-6",
                  valid
                    ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.06)]"
                    : "border-amber-500/30 bg-amber-500/5",
                ].join(" ")}
              >

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div>
                    <p
                      className={
                        valid
                          ? "text-lg font-bold text-emerald-300"
                          : "text-lg font-bold text-amber-300"
                      }
                    >
                      {valid
                        ? "✓ Your Atlas allocation is saved"
                        : "Allocation needs attention"}
                    </p>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      {valid
                        ? "Your portfolio targets total exactly 100%. Atlas has your saved allocation and this setup step is complete."
                        : "Return to the allocation page and adjust the portfolio until the target total equals exactly 100%."}
                    </p>

                    {valid ? (
                      <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-200/70">
                        You can return and change these target
                        percentages whenever you want. Saving a
                        new valid allocation replaces your
                        previous portfolio targets.
                      </p>
                    ) : null}
                  </div>


                  {valid ? (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">
                      ✓ Setup complete
                    </span>
                  ) : null}

                </div>
              </div>


              {/* Portfolio targets */}
              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/40">

                <div className="border-b border-slate-800 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">
                        Your Saved Portfolio Targets
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        These are the percentages Atlas
                        currently has saved for your portfolio.
                      </p>
                    </div>

                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
                      {allocations.length}{" "}
                      {allocations.length ===
                      1
                        ? "asset"
                        : "assets"}{" "}
                      saved
                    </span>

                  </div>
                </div>


                <div className="divide-y divide-slate-800">

                  {allocations.map(
                    (
                      item
                    ) => (
                      <div
                        key={
                          item.symbol
                        }
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >

                        <div>
                          <p className="font-semibold text-slate-100">
                            {item.symbol}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Target allocation
                          </p>
                        </div>

                        <p className="text-lg font-bold text-slate-100">
                          {item.targetPercent}%
                        </p>

                      </div>
                    )
                  )}

                </div>
              </div>


              {/* Safety */}
              <div className="mt-6 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">

                <p className="font-semibold text-sky-200">
                  Allocation confirmed
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  This confirms your saved portfolio
                  configuration only. Planning, approval,
                  authorization, eligibility checks and
                  protected execution remain separate backend
                  stages.
                </p>

              </div>


              {/* Change allocation */}
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      Want to change your portfolio later?
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Your allocation is not locked. Return to
                      the allocation page whenever you want to
                      update your target percentages.
                    </p>
                  </div>

                  <Link
                    href="/atlas/allocation"
                    className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                  >
                    Change Allocation
                  </Link>

                </div>
              </div>


              {/* Continue */}
              <div className="mt-6 flex flex-wrap items-center gap-3">

                <Link
                  href="/dashboard"
                  className="rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  Allocation Complete — Continue
                </Link>

                <span className="text-xs text-slate-500">
                  Your saved targets can still be changed later.
                </span>

              </div>

            </>
          ) : null}

        </section>
      </div>
    </main>
  );
}


function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-slate-50">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {detail}
      </p>

    </div>
  );
}


function StatusCard({
  valid,
}: {
  valid: boolean;
}) {

  return (
    <div
      className={[
        "rounded-2xl border p-4",
        valid
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-amber-500/30 bg-amber-500/5",
      ].join(" ")}
    >

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Status
      </p>

      <p
        className={[
          "mt-2 text-xl font-bold",
          valid
            ? "text-emerald-300"
            : "text-amber-300",
        ].join(" ")}
      >
        {valid
          ? "✓ Saved & Ready"
          : "Incomplete"}
      </p>

      <p
        className={[
          "mt-1 text-xs leading-5",
          valid
            ? "text-emerald-200/70"
            : "text-amber-200/70",
        ].join(" ")}
      >
        {valid
          ? "Your Atlas allocation is saved"
          : "Allocation requires attention"}
      </p>

    </div>
  );
}