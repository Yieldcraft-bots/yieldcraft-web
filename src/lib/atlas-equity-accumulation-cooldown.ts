/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Equity Accumulation Stage Gate
 * ------------------------------------------------------------
 * PURPOSE
 * Prevent repeated Coinbase equity accumulation waves for the
 * same client/product during the same U.S. market date.
 *
 * PRODUCTION POLICY
 * - Equity only
 * - Crypto passes through unchanged
 * - Uses authoritative SETTLED execution history
 * - New executions use authoritative settled_at
 * - Legacy SETTLED executions without settled_at use created_at
 *   ONLY as a conservative market-day gating fallback
 * - Evaluates market dates in America/New_York
 * - Default: maximum 1 settled equity stage per product/client
 *   per market date
 * - Configurable through:
 *   ATLAS_MULTI_ASSET_EQUITY_MAX_STAGES_PER_MARKET_DAY
 *
 * SAFETY
 * - Read-only
 * - No Coinbase calls
 * - No orders
 * - No reservation mutation
 * - No pending-allocation mutation
 * - No approval mutation
 * - No authorization mutation
 * - No SELL logic
 * - No allocation redistribution
 * - No Pulse
 * - No Recon
 * - No legacy Atlas
 * - Fails closed for equities if history lookup is uncertain
 *
 * IMPORTANT
 * Coinbase's independent equity tradability / NORMAL-session
 * gate remains authoritative immediately before submission.
 *
 * This module controls accumulation frequency only.
 * ============================================================
 */

import {
  createClient,
} from "@supabase/supabase-js";


const MARKET_TIME_ZONE =
  "America/New_York";


export type AtlasEquityAccumulationCooldownResult = {
  allowed:
    boolean;

  reason:
    | "not_equity"
    | "equity_no_settlement_today"
    | "equity_daily_stage_available"
    | "equity_daily_stage_limit_reached"
    | "equity_stage_gate_lookup_failed";

  marketTimeZone:
    string;

  marketDate:
    string;

  maxStagesPerMarketDay:
    number;

  settledStagesToday:
    number;

  remainingStagesToday:
    number;

  lastSettledAt:
    string | null;

  legacyFallbackUsed:
    boolean;
};


function getSupabaseAdmin() {

  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";


  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";


  if (!url) {
    throw new Error(
      "atlas_equity_stage_gate_supabase_url_missing"
    );
  }


  if (!serviceRoleKey) {
    throw new Error(
      "atlas_equity_stage_gate_service_role_missing"
    );
  }


  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}


function isAtlasEquityProduct(
  productId: string
): boolean {

  const normalized =
    productId.trim();


  return (
    Boolean(
      normalized
    ) &&
    !normalized.includes("-")
  );
}


function configuredMaxStagesPerMarketDay():
number {

  const raw =
    (
      process.env
        .ATLAS_MULTI_ASSET_EQUITY_MAX_STAGES_PER_MARKET_DAY ??
      "1"
    ).trim();


  const parsed =
    Number(
      raw
    );


  /*
   * Invalid configuration must never relax production policy.
   */
  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 1
  ) {

    return 1;
  }


  /*
   * Deliberately bounded.
   *
   * Increasing staging frequency beyond this should require
   * an explicit reviewed policy change.
   */
  return Math.min(
    10,
    Math.max(
      1,
      Math.floor(
        parsed
      )
    )
  );
}


function marketDateFor(
  value: Date
): string {

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          MARKET_TIME_ZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      value
    );


  const year =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "day"
    )?.value;


  if (
    !year ||
    !month ||
    !day
  ) {

    throw new Error(
      "atlas_equity_stage_gate_market_date_invalid"
    );
  }


  return `${year}-${month}-${day}`;
}


type SettlementObservation = {
  effectiveAt:
    string;

  authoritativeSettledAt:
    string | null;

  legacyFallback:
    boolean;

  marketDate:
    string;
};


export async function evaluateAtlasEquityAccumulationCooldown(
  input: {
    userId:
      string;

    productId:
      string;
  }
): Promise<AtlasEquityAccumulationCooldownResult> {

  const userId =
    input.userId.trim();


  const productId =
    input.productId.trim();


  const now =
    new Date();


  const marketDate =
    marketDateFor(
      now
    );


  const maxStagesPerMarketDay =
    configuredMaxStagesPerMarketDay();


  /*
   * ========================================================
   * CRYPTO PASSES THROUGH UNCHANGED
   * ========================================================
   */

  if (
    !isAtlasEquityProduct(
      productId
    )
  ) {

    return {
      allowed:
        true,

      reason:
        "not_equity",

      marketTimeZone:
        MARKET_TIME_ZONE,

      marketDate,

      maxStagesPerMarketDay,

      settledStagesToday:
        0,

      remainingStagesToday:
        maxStagesPerMarketDay,

      lastSettledAt:
        null,

      legacyFallbackUsed:
        false,
    };
  }


  /*
   * Equity without a valid client identity fails closed.
   */

  if (
    !userId
  ) {

    return {
      allowed:
        false,

      reason:
        "equity_stage_gate_lookup_failed",

      marketTimeZone:
        MARKET_TIME_ZONE,

      marketDate,

      maxStagesPerMarketDay,

      settledStagesToday:
        0,

      remainingStagesToday:
        0,

      lastSettledAt:
        null,

      legacyFallbackUsed:
        false,
    };
  }


  try {

    const supabase =
      getSupabaseAdmin();


    /*
     * ========================================================
     * AUTHORITATIVE + LEGACY SETTLEMENT LOOKUPS
     * ========================================================
     *
     * Authoritative executions are selected by settled_at.
     *
     * This is intentionally independent of created_at because
     * an unusually delayed execution may have been created more
     * than 48 hours ago but settle during the current market day.
     *
     * Historical executions that predate settled_at are queried
     * separately and may use created_at only as a conservative
     * market-day gating fallback.
     */

    const recentSince =
      new Date(
        now.getTime() -
        48 *
        60 *
        60 *
        1000
      ).toISOString();


    const {
      data: authoritativeData,
      error: authoritativeError,
    } =
      await supabase
        .from(
          "atlas_live_execution_logs"
        )
        .select(
          "created_at, settled_at"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "product_id",
          productId
        )
        .eq(
          "status",
          "SETTLED"
        )
        .not(
          "settled_at",
          "is",
          null
        )
        .gte(
          "settled_at",
          recentSince
        )
        .order(
          "settled_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          25
        );


    if (
      authoritativeError
    ) {

      throw authoritativeError;
    }


    const {
      data: legacyData,
      error: legacyError,
    } =
      await supabase
        .from(
          "atlas_live_execution_logs"
        )
        .select(
          "created_at, settled_at"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "product_id",
          productId
        )
        .eq(
          "status",
          "SETTLED"
        )
        .is(
          "settled_at",
          null
        )
        .gte(
          "created_at",
          recentSince
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          25
        );


    if (
      legacyError
    ) {

      throw legacyError;
    }


    const data =
      [
        ...(
          authoritativeData ??
          []
        ),
        ...(
          legacyData ??
          []
        ),
      ];


    const observations:
      SettlementObservation[] =
      [];


    for (
      const row of
      data
    ) {

      /*
       * Prefer authoritative settlement time whenever present.
       */

      if (
        typeof row.settled_at ===
          "string" &&
        row.settled_at.trim()
      ) {

        const settledDate =
          new Date(
            row.settled_at
          );


        if (
          !Number.isFinite(
            settledDate.getTime()
          )
        ) {

          /*
           * An invalid authoritative timestamp is uncertainty.
           * Fail the entire lookup closed.
           */
          throw new Error(
            "atlas_equity_stage_gate_invalid_settled_at"
          );
        }


        observations.push({
          effectiveAt:
            settledDate.toISOString(),

          authoritativeSettledAt:
            settledDate.toISOString(),

          legacyFallback:
            false,

          marketDate:
            marketDateFor(
              settledDate
            ),
        });


        continue;
      }


      /*
       * ======================================================
       * LEGACY FALLBACK
       * ======================================================
       *
       * Historical SETTLED rows may predate settled_at.
       *
       * created_at is used ONLY to conservatively answer:
       *
       * "Did this product already consume a stage on this
       * market date?"
       *
       * We deliberately do NOT expose created_at as
       * lastSettledAt because it is not authoritative
       * settlement time.
       */

      if (
        typeof row.created_at !==
          "string" ||
        !row.created_at.trim()
      ) {

        throw new Error(
          "atlas_equity_stage_gate_legacy_timestamp_missing"
        );
      }


      const createdDate =
        new Date(
          row.created_at
        );


      if (
        !Number.isFinite(
          createdDate.getTime()
        )
      ) {

        throw new Error(
          "atlas_equity_stage_gate_invalid_legacy_created_at"
        );
      }


      observations.push({
        effectiveAt:
          createdDate.toISOString(),

        authoritativeSettledAt:
          null,

        legacyFallback:
          true,

        marketDate:
          marketDateFor(
            createdDate
          ),
      });
    }


    const settledToday =
      observations
        .filter(
          (
            observation
          ) =>
            observation.marketDate ===
            marketDate
        )
        .sort(
          (
            left,
            right
          ) =>
            new Date(
              right.effectiveAt
            ).getTime() -
            new Date(
              left.effectiveAt
            ).getTime()
        );


    const settledStagesToday =
      settledToday.length;


    /*
     * Only report an actual settlement timestamp when we have
     * an authoritative settled_at value.
     */

    const lastSettledAt =
      settledToday.find(
        (
          observation
        ) =>
          observation.authoritativeSettledAt !==
          null
      )
        ?.authoritativeSettledAt ??
      null;


    const legacyFallbackUsed =
      settledToday.some(
        (
          observation
        ) =>
          observation.legacyFallback
      );


    const remainingStagesToday =
      Math.max(
        0,
        maxStagesPerMarketDay -
        settledStagesToday
      );


    /*
     * No successful settlement recorded for this market date.
     */

    if (
      settledStagesToday ===
      0
    ) {

      return {
        allowed:
          true,

        reason:
          "equity_no_settlement_today",

        marketTimeZone:
          MARKET_TIME_ZONE,

        marketDate,

        maxStagesPerMarketDay,

        settledStagesToday,

        remainingStagesToday,

        lastSettledAt,

        legacyFallbackUsed,
      };
    }


    /*
     * Future reviewed policy may intentionally permit multiple
     * stages per market date.
     *
     * Production launch default remains one.
     */

    if (
      settledStagesToday <
      maxStagesPerMarketDay
    ) {

      return {
        allowed:
          true,

        reason:
          "equity_daily_stage_available",

        marketTimeZone:
          MARKET_TIME_ZONE,

        marketDate,

        maxStagesPerMarketDay,

        settledStagesToday,

        remainingStagesToday,

        lastSettledAt,

        legacyFallbackUsed,
      };
    }


    /*
     * Stage allowance consumed.
     *
     * Pending capital remains intact for later reevaluation.
     */

    return {
      allowed:
        false,

      reason:
        "equity_daily_stage_limit_reached",

      marketTimeZone:
        MARKET_TIME_ZONE,

      marketDate,

      maxStagesPerMarketDay,

      settledStagesToday,

      remainingStagesToday:
        0,

      lastSettledAt,

      legacyFallbackUsed,
    };

  } catch {

    /*
     * ========================================================
     * FAIL CLOSED
     * ========================================================
     *
     * Uncertainty about whether the client/product already
     * consumed today's equity stage must never become permission
     * for another order.
     */

    return {
      allowed:
        false,

      reason:
        "equity_stage_gate_lookup_failed",

      marketTimeZone:
        MARKET_TIME_ZONE,

      marketDate,

      maxStagesPerMarketDay,

      settledStagesToday:
        0,

      remainingStagesToday:
        0,

      lastSettledAt:
        null,

      legacyFallbackUsed:
        false,
    };
  }
}