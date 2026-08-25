/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Governance Cron Coordinator
 * ------------------------------------------------------------
 * PURPOSE
 * Periodically process every eligible Atlas Multi-Asset client
 * through the existing isolated governance entry point.
 *
 * FLOW
 * Vercel Cron
 * -> Eligible Multi-Asset roster
 * -> Existing /api/atlas-multi-asset-run
 * -> Coinbase funding READ
 * -> Persistent accumulation
 * -> Portfolio plan
 * -> Approval
 * -> Authorization
 * -> STOP
 *
 * SAFETY
 * - Multi-Asset only
 * - Eligibility roster required
 * - Existing governance route reused
 * - Sequential client processing
 * - No execution route
 * - No Coinbase order submission
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  NextResponse,
} from "next/server";

import {
  loadAtlasMultiAssetClientRoster,
} from "@/lib/atlas-multi-asset-client-roster";


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


function authorizedCronRequest(
  req: Request
): boolean {

  /*
   * Vercel cron requests may identify themselves through the
   * cron header. We also support the configured CRON_SECRET
   * authorization boundary.
   */

  if (
    req.headers.get(
      "x-vercel-cron"
    ) === "1"
  ) {
    return true;
  }


  const cronSecret =
    (
      process.env
        .CRON_SECRET ??
      ""
    ).trim();


  if (!cronSecret) {
    return false;
  }


  const authorization =
    (
      req.headers.get(
        "authorization"
      ) ??
      ""
    ).trim();


  const cronHeader =
    (
      req.headers.get(
        "x-cron-secret"
      ) ??
      ""
    ).trim();


  return (
    authorization ===
      `Bearer ${cronSecret}` ||
    cronHeader ===
      cronSecret
  );
}


function productionBaseUrl(): string {

  const configured =
    (
      process.env
        .NEXT_PUBLIC_SITE_URL ??
      process.env
        .NEXT_PUBLIC_APP_URL ??
      ""
    ).trim();


  if (configured) {
    return configured
      .replace(
        /\/+$/,
        ""
      );
  }


  const vercelHost =
    (
      process.env
        .VERCEL_PROJECT_PRODUCTION_URL ??
      ""
    ).trim();


  if (vercelHost) {
    return `https://${vercelHost}`
      .replace(
        /\/+$/,
        ""
      );
  }


  return "https://yieldcraft.co";
}


type ClientRunResult = {
  userId: string;

  ok: boolean;

  status:
    | string
    | null;

  reason:
    | string
    | null;

  httpStatus:
    number;
};


export async function GET(
  req: Request
) {

  try {

    /*
     * ========================================================
     * CRON AUTH
     * ========================================================
     */

    if (
      !authorizedCronRequest(
        req
      )
    ) {
      return json(
        401,
        {
          ok: false,

          error:
            "unauthorized",
        }
      );
    }


    /*
     * ========================================================
     * ISOLATED CLIENT ROSTER
     * ========================================================
     */

    const roster =
      await loadAtlasMultiAssetClientRoster();


    if (
      roster.eligibleUserIds.length ===
      0
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "no_eligible_clients",

          roster:
            roster.summary,

          processed:
            0,

          results:
            [],
        }
      );
    }


    /*
     * ========================================================
     * GOVERNANCE SECRET
     * ========================================================
     */

    const runSecret =
      (
        process.env
          .ATLAS_MULTI_ASSET_RUN_SECRET ??
        ""
      ).trim();


    if (!runSecret) {
      return json(
        500,
        {
          ok: false,

          error:
            "missing_ATLAS_MULTI_ASSET_RUN_SECRET",
        }
      );
    }


    const baseUrl =
      productionBaseUrl();


    const results:
      ClientRunResult[] =
        [];


    /*
     * ========================================================
     * PROCESS ELIGIBLE CLIENTS
     * ========================================================
     *
     * Sequential processing is intentional.
     *
     * It avoids unnecessary Coinbase/Supabase bursts and makes
     * each client's result independently observable.
     *
     * IMPORTANT:
     * The target route performs governance only.
     * It contains NO execution dispatch.
     */

    for (
      const userId
      of roster.eligibleUserIds
    ) {

      try {

        const response =
          await fetch(
            `${baseUrl}/api/atlas-multi-asset-run`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-atlas-run-secret":
                  runSecret,
              },

              body:
                JSON.stringify({
                  userId,
                }),

              cache:
                "no-store",
            }
          );


        const text =
          await response.text();


        let payload:
          Record<string, unknown> | null =
            null;


        try {

          const parsed =
            JSON.parse(
              text
            );


          payload =
            (
              typeof parsed ===
                "object" &&
              parsed !== null
            )
              ? parsed as
                  Record<
                    string,
                    unknown
                  >
              : null;

        } catch {

          payload =
            null;
        }


        results.push({
          userId,

          ok:
            response.ok &&
            payload?.ok ===
              true,

          status:
            typeof payload?.status ===
              "string"
              ? payload.status
              : null,

          reason:
            typeof payload?.reason ===
              "string"
              ? payload.reason
              : null,

          httpStatus:
            response.status,
        });

      } catch (
        error
      ) {

        results.push({
          userId,

          ok:
            false,

          status:
            "error",

          reason:
            error instanceof Error
              ? error.message
              : String(
                  error
                ),

          httpStatus:
            0,
        });
      }
    }


    /*
     * ========================================================
     * SUMMARY
     * ========================================================
     */

    const successful =
      results.filter(
        (
          result
        ) =>
          result.ok
      ).length;


    const failed =
      results.length -
      successful;


    return json(
      200,
      {
        ok:
          failed ===
          0,

        status:
          failed ===
          0
            ? "governance_cycle_complete"
            : "governance_cycle_partial_failure",

        roster:
          roster.summary,

        processed:
          results.length,

        successful,

        failed,

        results,

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
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

        execution:
          "NOT_CALLED",

        coinbaseOrdersSubmitted:
          0,
      }
    );
  }
}