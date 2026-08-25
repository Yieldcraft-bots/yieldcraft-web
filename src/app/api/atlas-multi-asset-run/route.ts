/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Governance Run
 * ------------------------------------------------------------
 * PURPOSE
 * Resolve authoritative per-client Coinbase USD funding,
 * accumulate only genuinely unprocessed cash into persistent
 * per-asset buckets, build an execution plan from those buckets,
 * and advance executable plans through governance.
 *
 * SAFETY
 * - Operator controlled
 * - Client allocation driven
 * - Per-client Atlas Coinbase credentials
 * - Read-only Coinbase balance access
 * - Multi-Asset state tables only
 * - Same observed cash cannot be allocated repeatedly
 * - Deterministic portfolio identity prevents identical
 *   pending state from appearing as a new plan every cycle
 * - Uses existing approval state machine
 * - Uses existing authorization state machine
 * - No execution dispatch
 * - No Coinbase order submission
 * - No Pulse
 * - No Recon
 * - Does not modify legacy Atlas BTC
 * ============================================================
 */

import {
  NextResponse,
} from "next/server";

import crypto from "crypto";

import {
  getClientAllocationPlan,
} from "@/lib/repositories/clientAllocationRepository";

import {
  saveAtlasPortfolioPlan,
} from "@/lib/repositories/atlasPortfolioPlanRepository";

import {
  governAtlasMultiAssetPlan,
} from "@/lib/atlas-multi-asset-orchestrator";

import {
  getAtlasClientFundingBalance,
} from "@/lib/atlas-client-coinbase-balance";

import {
  processAtlasMultiAssetAccumulation,
} from "@/lib/atlas-multi-asset-state-service";

import {
  buildAtlasPendingPortfolioPlan,
} from "@/lib/atlas-multi-asset-pending-plan";


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


/**
 * Produce a stable JSON representation so object-key ordering
 * can never change the deterministic plan fingerprint.
 */
function canonicalize(
  value: unknown
): unknown {

  if (
    value === null ||
    typeof value !==
      "object"
  ) {
    return value;
  }


  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      canonicalize
    );
  }


  const input =
    value as
      Record<
        string,
        unknown
      >;


  const output:
    Record<
      string,
      unknown
    > =
      {};


  for (
    const key
    of Object.keys(
      input
    ).sort()
  ) {

    output[key] =
      canonicalize(
        input[key]
      );
  }


  return output;
}


/**
 * Convert a deterministic SHA-256 digest into a UUID-shaped
 * identifier suitable for the existing portfolio_plan_id.
 *
 * Same user + same actual portfolio plan contents
 * => same portfolioPlanId.
 *
 * Any material pending-plan change
 * => different portfolioPlanId.
 */
function createDeterministicPortfolioPlanId(
  userId: string,
  portfolioPlan: unknown
): string {

  const canonicalPayload =
    JSON.stringify(
      canonicalize({
        scope:
          "atlas_multi_asset",

        userId,

        portfolioPlan,
      })
    );


  const digest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        canonicalPayload
      )
      .digest(
        "hex"
      );


  /*
   * UUID-shaped deterministic value.
   *
   * Version nibble = 5
   * Variant nibble = 8
   */
  const uuidHex =
    (
      digest.slice(
        0,
        12
      ) +
      "5" +
      digest.slice(
        13,
        16
      ) +
      "8" +
      digest.slice(
        17,
        32
      )
    );


  return [
    uuidHex.slice(
      0,
      8
    ),

    uuidHex.slice(
      8,
      12
    ),

    uuidHex.slice(
      12,
      16
    ),

    uuidHex.slice(
      16,
      20
    ),

    uuidHex.slice(
      20,
      32
    ),
  ].join(
    "-"
  );
}


function okAuth(
  req: Request
) {

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


export async function POST(
  req: Request
) {

  try {

    if (
      !okAuth(
        req
      )
    ) {
      return json(
        401,
        {
          ok: false,

          error:
            "Unauthorized",
        }
      );
    }


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
          ok: false,

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


    const userId =
      typeof userIdValue ===
        "string"
        ? userIdValue.trim()
        : "";


    const deployPctValue =
      Reflect.get(
        body,
        "deployPct"
      );


    const minCashValue =
      Reflect.get(
        body,
        "minCash"
      );


    const minBuyValue =
      Reflect.get(
        body,
        "minBuy"
      );


    const deployPct =
      typeof deployPctValue ===
        "number"
        ? deployPctValue
        : 20;


    const minCash =
      typeof minCashValue ===
        "number"
        ? minCashValue
        : 10;


    const minBuy =
      typeof minBuyValue ===
        "number"
        ? minBuyValue
        : 10;


    if (!userId) {
      return json(
        400,
        {
          ok: false,

          error:
            "missing_user_id",
        }
      );
    }


    if (
      !Number.isFinite(
        deployPct
      ) ||
      deployPct <=
        0 ||
      deployPct >
        100
    ) {
      return json(
        400,
        {
          ok: false,

          error:
            "invalid_deploy_percent",
        }
      );
    }


    if (
      !Number.isFinite(
        minCash
      ) ||
      minCash <
        0
    ) {
      return json(
        400,
        {
          ok: false,

          error:
            "invalid_min_cash",
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
          ok: false,

          error:
            "invalid_min_buy",
        }
      );
    }


    /*
     * ========================================================
     * 1. AUTHORITATIVE COINBASE FUNDING
     * ========================================================
     */

    let funding;


    try {

      funding =
        await getAtlasClientFundingBalance(
          userId
        );

    } catch (
      error
    ) {

      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "coinbase_funding_unverified",

          error:
            error instanceof Error
              ? error.message
              : "unknown_funding_error",
        }
      );
    }


    const availableCash =
      funding.deployableCashUsd;


    if (
      !Number.isFinite(
        availableCash
      ) ||
      availableCash <
        0
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "coinbase_funding_invalid",
        }
      );
    }


    const fundingSummary = {
      source:
        "coinbase_atlas_client",

      currency:
        "USD",

      usdAvailable:
        funding.usdAvailable,

      usdcAvailable:
        funding.usdcAvailable,

      deployableCashUsd:
        funding.deployableCashUsd,

      checkedAt:
        funding.checkedAt,
    };


    /*
     * Minimum cash gate occurs BEFORE accumulation.
     */
    if (
      availableCash <
      minCash
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "below_min_cash",

          funding:
            fundingSummary,
        }
      );
    }


    /*
     * ========================================================
     * 2. CLIENT ALLOCATION
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
          ok: true,

          status:
            "blocked",

          reason:
            "no_client_allocation",

          funding:
            fundingSummary,
        }
      );
    }


    /*
     * ========================================================
     * 3. PERSISTENT MULTI-ASSET ACCUMULATION
     * ========================================================
     *
     * Only genuinely unprocessed cash contributes new dollars
     * to the client's per-asset pending buckets.
     *
     * An unchanged Coinbase balance cannot repeatedly produce
     * another deployment amount.
     */

    const accumulation =
      await processAtlasMultiAssetAccumulation({
        userId,

        currentCashUsd:
          availableCash,

        deployPct,

        minOrderUsd:
          minBuy,

        allocationRows,
      });


    if (
      !accumulation
        .accumulation
        .valid
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            accumulation
              .accumulation
              .reason,

          funding:
            fundingSummary,

          accumulation,
        }
      );
    }


    /*
     * ========================================================
     * 4. BUILD PLAN FROM PERSISTED/PENDING BUCKETS
     * ========================================================
     *
     * We intentionally do NOT feed the full Coinbase balance
     * back through the old percentage planner here.
     *
     * The pending buckets are now the authoritative planned
     * dollar amounts.
     */

    const portfolioPlan =
      buildAtlasPendingPortfolioPlan({
        buckets:
          accumulation
            .accumulation
            .buckets,

        fundingCurrency:
          "USD",

        minOrderUsd:
          minBuy,
      });


    if (
      !portfolioPlan.valid
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "portfolio_plan_invalid",

          funding:
            fundingSummary,

          accumulation,

          portfolioPlan,
        }
      );
    }


    const executableOrders =
      portfolioPlan
        .orders
        .filter(
          (
            order
          ) =>
            order.executable
        );


    if (
      executableOrders.length ===
      0
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "pending_below_minimum",

          funding:
            fundingSummary,

          accumulation,

          portfolioPlan,
        }
      );
    }


    /*
     * ========================================================
     * 5. DETERMINISTIC PORTFOLIO IDENTITY
     * ========================================================
     *
     * An unchanged pending plan receives the SAME plan ID.
     *
     * This prevents a recurring scheduler from disguising the
     * same pending state as a brand-new portfolio plan.
     *
     * A material change to pending allocations/orders creates
     * a different deterministic plan ID.
     */

    const portfolioPlanId =
      createDeterministicPortfolioPlanId(
        userId,
        portfolioPlan
      );


    /*
     * Existing repository upsert semantics make saving this
     * same deterministic plan safe and idempotent.
     */
    await saveAtlasPortfolioPlan({
      portfolioPlanId,

      userId,

      plan:
        portfolioPlan,
    });


    /*
     * ========================================================
     * 6. GOVERNANCE
     * ========================================================
     *
     * Still NO execution and NO Coinbase order submission.
     *
     * The orchestrator is responsible for reusing existing
     * governance for this deterministic plan instead of
     * creating duplicate active approvals/authorizations.
     */

    const governance =
      await governAtlasMultiAssetPlan({
        userId,

        portfolioPlanId,
      });


    return json(
      200,
      {
        ok: true,

        status:
          "authorized_ready",

        funding:
          fundingSummary,

        accumulation,

        plan: {
          userId,

          portfolioPlanId,

          deterministic:
            true,

          allocationRows,

          portfolioPlan,
        },

        governance,
      }
    );

  } catch (
    error
  ) {

    return json(
      500,
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "unknown_error",
      }
    );
  }
}