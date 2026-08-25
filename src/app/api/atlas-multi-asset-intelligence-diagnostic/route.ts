/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Intelligence Diagnostic Route
 * ------------------------------------------------------------
 * PURPOSE
 * Expose the current Multi-Asset intelligence decision for one
 * client so production market observations and entry decisions
 * can be inspected without invoking execution or governance.
 *
 * READ-ONLY
 * - Reads authoritative client allocation
 * - Reads existing Multi-Asset pending state
 * - Builds the existing pending portfolio plan
 * - Observes current market conditions
 * - Runs isolated Multi-Asset intelligence
 * - Returns diagnostic JSON
 *
 * SAFETY
 * - NO state mutation
 * - NO accumulation processing
 * - NO portfolio-plan persistence
 * - NO approvals
 * - NO authorizations
 * - NO executor
 * - NO Coinbase orders
 * - NO SELL logic
 * - NO legacy Atlas
 * - NO Pulse
 * - NO Recon
 * ============================================================
 */

import {
  NextResponse,
} from "next/server";

import {
  getClientAllocationPlan,
} from "@/lib/repositories/clientAllocationRepository";

import {
  SupabaseAtlasMultiAssetStateRepository,
} from "@/lib/repositories/atlasMultiAssetStateRepository";

import {
  buildAtlasPendingPortfolioPlan,
} from "@/lib/atlas-multi-asset-pending-plan";

import {
  buildAtlasMultiAssetIntelligencePlan,
} from "@/lib/atlas-multi-asset-intelligence/intelligence-plan";

import type {
  AtlasMultiAssetAccumulationBucket,
} from "@/lib/atlas-multi-asset-accumulation";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


function json(
  status: number,
  body: unknown
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}


function okAuth(
  req: Request
): boolean {
  const secret =
    process.env
      .ATLAS_MULTI_ASSET_RUN_SECRET
      ?.trim() ||
    process.env
      .ATLAS_RUN_SECRET
      ?.trim() ||
    process.env
      .CRON_SECRET
      ?.trim() ||
    "";

  if (!secret) {
    return false;
  }

  const header =
    req.headers.get(
      "x-atlas-run-secret"
    ) ??
    req.headers.get(
      "x-cron-secret"
    ) ??
    req.headers.get(
      "authorization"
    );

  if (
    header === secret ||
    header ===
      `Bearer ${secret}`
  ) {
    return true;
  }

  const url =
    new URL(
      req.url
    );

  return (
    url.searchParams.get(
      "secret"
    ) === secret
  );
}


function normalizeSymbol(
  symbol: string
): string {
  return symbol
    .trim()
    .toUpperCase();
}


function money(
  value: number
): number {
  return Number(
    value.toFixed(8)
  );
}


export async function POST(
  req: Request
) {
  try {
    /*
     * ========================================================
     * 1. AUTHENTICATION
     * ========================================================
     */

    if (
      !okAuth(
        req
      )
    ) {
      return json(
        401,
        {
          ok:
            false,

          error:
            "Unauthorized",
        }
      );
    }


    /*
     * ========================================================
     * 2. REQUEST
     * ========================================================
     */

    const body =
      await req
        .json()
        .catch(
          () =>
            null
        );


    if (
      typeof body !==
        "object" ||
      body ===
        null
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "invalid_request_body",
        }
      );
    }


    const userIdValue =
      Reflect.get(
        body,
        "userId"
      );


    const minBuyValue =
      Reflect.get(
        body,
        "minBuy"
      );


    const userId =
      typeof userIdValue ===
        "string"
        ? userIdValue.trim()
        : "";


    const minBuy =
      typeof minBuyValue ===
        "number"
        ? minBuyValue
        : 10;


    if (!userId) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "missing_user_id",
        }
      );
    }


    if (
      !Number.isFinite(
        minBuy
      ) ||
      minBuy <=
        0
    ) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "invalid_min_buy",
        }
      );
    }


    /*
     * ========================================================
     * 3. READ CLIENT ALLOCATION
     * ========================================================
     */

    const allocationRows =
      await getClientAllocationPlan(
        userId
      );


    if (
      allocationRows.length ===
        0
    ) {
      return json(
        200,
        {
          ok:
            true,

          status:
            "blocked",

          reason:
            "no_client_allocation",

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,
        }
      );
    }


    /*
     * ========================================================
     * 4. READ EXISTING MULTI-ASSET PENDING STATE
     * ========================================================
     */

    const repository =
      new SupabaseAtlasMultiAssetStateRepository();


    const pendingAllocations =
      await repository
        .loadPendingAllocations(
          userId
        );


    if (
      pendingAllocations.length ===
        0
    ) {
      return json(
        200,
        {
          ok:
            true,

          status:
            "no_pending_capital",

          reason:
            "no_persisted_pending_allocations",

          userId,

          allocationRows,

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,
        }
      );
    }


    /*
     * ========================================================
     * 5. RECONSTRUCT READ-ONLY ACCUMULATION BUCKETS
     * ========================================================
     *
     * buildAtlasPendingPortfolioPlan() expects the full
     * AtlasMultiAssetAccumulationBucket contract.
     *
     * Because this is diagnostic/read-only mode:
     *
     * previousPendingUsd = persisted pending
     * addedPendingUsd    = 0
     * pendingUsd         = persisted pending
     * executableUsd      = pending when >= minBuy, else 0
     * executable         = pending >= minBuy
     */

    const allocationPercentBySymbol =
      new Map(
        allocationRows.map(
          (
            row
          ) => [
            normalizeSymbol(
              row.asset_symbol
            ),

            Number(
              row.target_percent
            ),
          ]
        )
      );


    const buckets:
      AtlasMultiAssetAccumulationBucket[] =
        pendingAllocations.map(
          (
            pending
          ) => {
            const symbol =
              normalizeSymbol(
                pending.assetSymbol
              );


            const pendingUsd =
              money(
                Number(
                  pending.pendingUsd
                )
              );


            const executable =
              pendingUsd >=
              minBuy;


            return {
              symbol,

              targetPercent:
                allocationPercentBySymbol.get(
                  symbol
                ) ??
                0,

              previousPendingUsd:
                pendingUsd,

              addedPendingUsd:
                0,

              pendingUsd,

              executableUsd:
                executable
                  ? pendingUsd
                  : 0,

              executable,
            };
          }
        );


    /*
     * ========================================================
     * 6. BASE PORTFOLIO PLAN
     * ========================================================
     */

    const basePortfolioPlan =
      buildAtlasPendingPortfolioPlan({
        buckets,

        fundingCurrency:
          "USD",

        minOrderUsd:
          minBuy,
      });


    if (
      !basePortfolioPlan.valid
    ) {
      return json(
        200,
        {
          ok:
            true,

          status:
            "blocked",

          reason:
            "portfolio_plan_invalid",

          userId,

          allocationRows,

          pendingAllocations,

          buckets,

          basePortfolioPlan,

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,
        }
      );
    }


    /*
     * ========================================================
     * 7. INTELLIGENCE
     * ========================================================
     */

    const intelligencePlan =
      await buildAtlasMultiAssetIntelligencePlan({
        basePlan:
          basePortfolioPlan,

        minOrderUsd:
          minBuy,
      });


    /*
     * ========================================================
     * 8. DIAGNOSTIC RESPONSE
     * ========================================================
     */

    return json(
      200,
      {
        ok:
          true,

        status:
          intelligencePlan.reason,

        mode:
          "READ_ONLY_INTELLIGENCE_DIAGNOSTIC",

        userId,

        allocation: {
          rows:
            allocationRows.length,

          allocations:
            allocationRows.map(
              (
                row
              ) => ({
                symbol:
                  normalizeSymbol(
                    row.asset_symbol
                  ),

                targetPercent:
                  Number(
                    row.target_percent
                  ),
              })
            ),
        },

        pending: {
          bucketCount:
            buckets.length,

          buckets,
        },

        intelligence: {
          valid:
            intelligencePlan.valid,

          reason:
            intelligencePlan.reason,

          portfolio:
            intelligencePlan.intelligence,

          observations:
            intelligencePlan.observations,

          basePlan:
            intelligencePlan.basePlan,

          approvedPlan:
            intelligencePlan.approvedPlan,
        },

        safety: {
          stateMutation:
            false,

          accumulationProcessing:
            false,

          portfolioPlanPersistence:
            false,

          governance:
            false,

          execution:
            false,

          sells:
            false,
        },

        execution:
          "NOT_CALLED",

        coinbaseOrdersSubmitted:
          0,
      }
    );

  } catch (
    error
  ) {
    return json(
      500,
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "unknown_error",

        execution:
          "NOT_CALLED",

        coinbaseOrdersSubmitted:
          0,
      }
    );
  }
}