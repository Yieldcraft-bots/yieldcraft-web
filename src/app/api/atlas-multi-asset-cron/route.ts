/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Production Orchestration Cron
 * ------------------------------------------------------------
 * PURPOSE
 * Periodically move eligible Atlas Multi-Asset clients through
 * the already-proven isolated production lifecycle.
 *
 * FLOW
 * Vercel Cron
 * -> Eligible Multi-Asset roster
 * -> Explicit rollout gate
 * -> Existing /api/atlas-multi-asset-run
 * -> Funding / accumulation / intelligence
 * -> Persisted deterministic plan
 * -> Approval
 * -> Authorization
 * -> Existing protected execution route, one product at a time
 * -> Existing execution fingerprint
 * -> Existing submitted-order reconciliation route
 * -> Atomic PostgreSQL settlement
 *
 * SAFETY
 * - Multi-Asset only
 * - Existing eligibility roster required
 * - Existing governance route reused
 * - Existing protected executor reused
 * - Existing reconciler reused
 * - Existing atomic settlement reused
 * - Sequential client processing
 * - Sequential product processing
 * - Automatic execution requires explicit enable flag
 * - Canary rollout is default
 * - Broad rollout requires explicit "eligible" mode
 * - No caller-created instructions
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


function asRecord(
  value: unknown
): Record<string, unknown> | null {

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as
    Record<string, unknown>;
}


function stringValue(
  value: unknown
): string | null {

  return typeof value === "string"
    ? value.trim() || null
    : null;
}


function booleanValue(
  value: unknown
): boolean {

  return value === true;
}


async function readJsonResponse(
  response: Response
): Promise<Record<string, unknown> | null> {

  const text =
    await response.text();

  try {

    return asRecord(
      JSON.parse(
        text
      )
    );

  } catch {

    return null;
  }
}


function authorizedCronRequest(
  req: Request
): boolean {

  /*
   * Vercel Cron may identify itself through this header.
   *
   * Manual/operator invocations may use CRON_SECRET.
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

    return configured.replace(
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


type RolloutMode =
  | "canary"
  | "eligible";


function rolloutMode():
RolloutMode {

  const configured =
    (
      process.env
        .ATLAS_MULTI_ASSET_ROLLOUT_MODE ??
      "canary"
    )
      .trim()
      .toLowerCase();


  return configured ===
    "eligible"
      ? "eligible"
      : "canary";
}


function canaryUserIds():
Set<string> {

  const configured =
    (
      process.env
        .ATLAS_MULTI_ASSET_CANARY_USER_IDS ??
      ""
    ).trim();


  return new Set(
    configured
      .split(",")
      .map(
        (
          value
        ) =>
          value.trim()
      )
      .filter(Boolean)
  );
}


type ReconciliationSummary = {
  attempted: boolean;

  httpStatus:
    number | null;

  ok:
    boolean;

  status:
    string | null;

  reason:
    string | null;

  executionKey:
    string | null;
};


type ProductExecutionResult = {
  productId: string;

  executionHttpStatus:
    number;

  executionOk:
    boolean;

  submitted:
    boolean;

  duplicateBlocked:
    boolean;

  executionKey:
    string | null;

  executionReason:
    string | null;

  reconciliation:
    ReconciliationSummary;
};


type ClientRunResult = {
  userId: string;

  ok: boolean;

  status:
    string;

  reason:
    string | null;

  governanceHttpStatus:
    number;

  approvalId:
    string | null;

  authorizationId:
    string | null;

  portfolioPlanId:
    string | null;

  executableProducts:
    string[];

  productResults:
    ProductExecutionResult[];
};


function extractExecutableProductIds(
  payload: Record<string, unknown>
): string[] {

  const plan =
    asRecord(
      payload.plan
    );


  const portfolioPlan =
    asRecord(
      plan?.portfolioPlan
    );


  const orders =
    Array.isArray(
      portfolioPlan?.orders
    )
      ? portfolioPlan.orders
      : [];


  const productIds =
    orders
      .map(
        (
          rawOrder
        ) => {

          const order =
            asRecord(
              rawOrder
            );


          if (
            !order ||
            order.executable !==
              true
          ) {
            return null;
          }


          return stringValue(
            order.productId
          );
        }
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      );


  return [
    ...new Set(
      productIds
    ),
  ];
}


function extractExecutionOutcome(
  payload:
    Record<string, unknown> | null
): {
  executionOk: boolean;
  submitted: boolean;
  duplicateBlocked: boolean;
  executionKey: string | null;
  reason: string | null;
} {

  const dispatch =
    asRecord(
      payload?.dispatch
    );


  const results =
    Array.isArray(
      dispatch?.results
    )
      ? dispatch.results
      : [];


  const firstResult =
    asRecord(
      results[0]
    );


  const executorResponse =
    asRecord(
      firstResult?.response
    );


  const executionKey =
    stringValue(
      executorResponse?.fingerprint
    );


  const reason =
    stringValue(
      executorResponse?.reason
    );


  return {
    executionOk:
      booleanValue(
        firstResult?.success
      ),

    submitted:
      booleanValue(
        firstResult?.submitted
      ),

    duplicateBlocked:
      reason ===
        "duplicate_live_execution_blocked",

    executionKey,

    reason,
  };
}


async function reconcileExecution(
  input: {
    baseUrl: string;
    operatorToken: string;
    executionKey: string;
  }
): Promise<ReconciliationSummary> {

  try {

    const response =
      await fetch(
        `${input.baseUrl}/api/operator/atlas-execution-reconcile`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-atlas-operator-token":
              input.operatorToken,
          },

          body:
            JSON.stringify({
              executionKey:
                input.executionKey,
            }),

          cache:
            "no-store",
        }
      );


    const payload =
      await readJsonResponse(
        response
      );


    const status =
      stringValue(
        payload?.status
      );


    const reason =
      stringValue(
        payload?.reason ??
        payload?.error
      );


    /*
     * "waiting" is healthy.
     *
     * Coinbase accepted the order, but authoritative settlement
     * is not terminal yet. A later cron cycle will derive the
     * same execution fingerprint, hit duplicate reservation
     * protection, and reconcile the existing SUBMITTED order.
     */
    const ok =
      response.ok &&
      (
        status ===
          "settled" ||
        status ===
          "waiting"
      );


    return {
      attempted:
        true,

      httpStatus:
        response.status,

      ok,

      status,

      reason,

      executionKey:
        input.executionKey,
    };

  } catch (
    error
  ) {

    return {
      attempted:
        true,

      httpStatus:
        null,

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

      executionKey:
        input.executionKey,
    };
  }
}


export async function GET(
  req: Request
) {

  try {

    /*
     * ========================================================
     * 1. CRON AUTH
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
          ok:
            false,

          error:
            "unauthorized",
        }
      );
    }


    /*
     * ========================================================
     * 2. EXPLICIT LIVE-AUTOMATION GATE
     * ========================================================
     */

    const autoExecutionEnabled =
      process.env
        .ATLAS_MULTI_ASSET_AUTO_EXECUTION_ENABLED ===
      "true";


    if (
      !autoExecutionEnabled
    ) {

      return json(
        200,
        {
          ok:
            true,

          status:
            "automatic_execution_disabled",

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,
        }
      );
    }


    /*
     * ========================================================
     * 3. REQUIRED INTERNAL SECRETS
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
          ok:
            false,

          error:
            "missing_ATLAS_MULTI_ASSET_RUN_SECRET",
        }
      );
    }


    const operatorToken =
      (
        process.env
          .ATLAS_APPROVAL_OPERATOR_TOKEN ??
        ""
      ).trim();


    if (!operatorToken) {

      return json(
        500,
        {
          ok:
            false,

          error:
            "missing_ATLAS_APPROVAL_OPERATOR_TOKEN",
        }
      );
    }


    /*
     * ========================================================
     * 4. AUTHORITATIVE ELIGIBLE ROSTER
     * ========================================================
     */

    const roster =
      await loadAtlasMultiAssetClientRoster();


    const mode =
      rolloutMode();


    const canaryIds =
      canaryUserIds();


    /*
     * Canary is the fail-safe default.
     *
     * If no canary IDs are configured, execution stops.
     */
    if (
      mode === "canary" &&
      canaryIds.size ===
        0
    ) {

      return json(
        200,
        {
          ok:
            true,

          status:
            "canary_not_configured",

          rolloutMode:
            mode,

          roster:
            roster.summary,

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,
        }
      );
    }


    const selectedUserIds =
      mode ===
        "eligible"
        ? roster.eligibleUserIds
        : roster.eligibleUserIds.filter(
            (
              userId
            ) =>
              canaryIds.has(
                userId
              )
          );


    if (
      selectedUserIds.length ===
        0
    ) {

      return json(
        200,
        {
          ok:
            true,

          status:
            mode ===
              "canary"
              ? "no_eligible_canary_clients"
              : "no_eligible_clients",

          rolloutMode:
            mode,

          roster:
            roster.summary,

          selected:
            0,

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,

          results:
            [],
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
     * 5. PROCESS CLIENTS SEQUENTIALLY
     * ========================================================
     */

    for (
      const userId
      of selectedUserIds
    ) {

      try {

        /*
         * ====================================================
         * 5A. EXISTING FUNDING / INTELLIGENCE / GOVERNANCE
         * ====================================================
         */

        const governanceResponse =
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


        const governancePayload =
          await readJsonResponse(
            governanceResponse
          );


        const governanceStatus =
          stringValue(
            governancePayload?.status
          );


        const governanceReason =
          stringValue(
            governancePayload?.reason ??
            governancePayload?.error
          );


        /*
         * WAIT / BLOCK states are normal fail-closed outcomes.
         *
         * Do not attempt execution unless the existing governance
         * route explicitly returns authorized_ready.
         */
        if (
          !governanceResponse.ok ||
          governancePayload?.ok !==
            true ||
          governanceStatus !==
            "authorized_ready"
        ) {

          results.push({
            userId,

            ok:
              governanceResponse.ok &&
              governancePayload?.ok ===
                true,

            status:
              governanceStatus ??
              "governance_not_ready",

            reason:
              governanceReason,

            governanceHttpStatus:
              governanceResponse.status,

            approvalId:
              null,

            authorizationId:
              null,

            portfolioPlanId:
              null,

            executableProducts:
              [],

            productResults:
              [],
          });

          continue;
        }


        /*
         * ====================================================
         * 5B. EXACT GOVERNANCE HANDOFF
         * ====================================================
         */

        const governance =
          asRecord(
            governancePayload.governance
          );


        const approvalId =
          stringValue(
            governance?.approvalId
          );


        const authorizationId =
          stringValue(
            governance?.authorizationId
          );


        const plan =
          asRecord(
            governancePayload.plan
          );


        const portfolioPlanId =
          stringValue(
            plan?.portfolioPlanId
          );


        if (
          !approvalId ||
          !authorizationId ||
          !portfolioPlanId
        ) {

          results.push({
            userId,

            ok:
              false,

            status:
              "governance_handoff_invalid",

            reason:
              "approval_authorization_or_plan_id_missing",

            governanceHttpStatus:
              governanceResponse.status,

            approvalId,

            authorizationId,

            portfolioPlanId,

            executableProducts:
              [],

            productResults:
              [],
          });

          continue;
        }


        /*
         * Exact executable product IDs come only from the
         * persisted intelligence-approved plan returned by the
         * governance route.
         *
         * The protected executor reloads the persisted plan and
         * independently verifies each requested product.
         */
        const executableProducts =
          extractExecutableProductIds(
            governancePayload
          );


        if (
          executableProducts.length ===
            0
        ) {

          results.push({
            userId,

            ok:
              true,

            status:
              "no_executable_products",

            reason:
              null,

            governanceHttpStatus:
              governanceResponse.status,

            approvalId,

            authorizationId,

            portfolioPlanId,

            executableProducts,

            productResults:
              [],
          });

          continue;
        }


        const productResults:
          ProductExecutionResult[] =
            [];


        /*
         * ====================================================
         * 5C. PROTECTED EXECUTION — ONE PRODUCT AT A TIME
         * ====================================================
         *
         * A failure/duplicate on one product does not cause the
         * dispatcher inside the executor to prevent unrelated
         * authorized products from receiving their own isolated
         * execution attempt.
         */

        for (
          const productId
          of executableProducts
        ) {

          try {

            const executionResponse =
              await fetch(
                `${baseUrl}/api/operator/atlas-execution-run`,
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    "x-atlas-operator-token":
                      operatorToken,
                  },

                  body:
                    JSON.stringify({
                      userId,
                      approvalId,
                      authorizationId,
                      productId,
                    }),

                  cache:
                    "no-store",
                }
              );


            const executionPayload =
              await readJsonResponse(
                executionResponse
              );


            const outcome =
              extractExecutionOutcome(
                executionPayload
              );


            /*
             * ==================================================
             * 5D. RECONCILIATION HANDOFF
             * ==================================================
             *
             * New submission:
             *   fingerprint -> reconcile
             *
             * Duplicate reservation:
             *   SAME fingerprint -> reconcile existing SUBMITTED
             *
             * Credential/gateway/other failures:
             *   do not attempt reconciliation.
             */
            const shouldReconcile =
              Boolean(
                outcome.executionKey
              ) &&
              (
                outcome.submitted ||
                outcome.duplicateBlocked
              );


            const reconciliation =
              shouldReconcile &&
              outcome.executionKey
                ? await reconcileExecution({
                    baseUrl,

                    operatorToken,

                    executionKey:
                      outcome.executionKey,
                  })
                : {
                    attempted:
                      false,

                    httpStatus:
                      null,

                    ok:
                      false,

                    status:
                      null,

                    reason:
                      null,

                    executionKey:
                      outcome.executionKey,
                  };


            productResults.push({
              productId,

              executionHttpStatus:
                executionResponse.status,

              executionOk:
                outcome.executionOk,

              submitted:
                outcome.submitted,

              duplicateBlocked:
                outcome.duplicateBlocked,

              executionKey:
                outcome.executionKey,

              executionReason:
                outcome.reason,

              reconciliation,
            });

          } catch (
            error
          ) {

            productResults.push({
              productId,

              executionHttpStatus:
                0,

              executionOk:
                false,

              submitted:
                false,

              duplicateBlocked:
                false,

              executionKey:
                null,

              executionReason:
                error instanceof Error
                  ? error.message
                  : String(
                      error
                    ),

              reconciliation: {
                attempted:
                  false,

                httpStatus:
                  null,

                ok:
                  false,

                status:
                  null,

                reason:
                  null,

                executionKey:
                  null,
              },
            });
          }
        }


        /*
         * A newly submitted order that is still "waiting" is a
         * healthy orchestration result, not a client failure.
         *
         * A later cycle safely retries reconciliation using the
         * deterministic execution fingerprint.
         */
        const productFailure =
          productResults.some(
            (
              result
            ) => {

              if (
                result.reconciliation
                  .attempted
              ) {

                return !(
                  result.reconciliation
                    .status ===
                      "settled" ||
                  result.reconciliation
                    .status ===
                      "waiting"
                );
              }


              return (
                !result.executionOk &&
                !result.duplicateBlocked
              );
            }
          );


        const waiting =
          productResults.some(
            (
              result
            ) =>
              result.reconciliation
                .status ===
              "waiting"
          );


        results.push({
          userId,

          ok:
            !productFailure,

          status:
            productFailure
              ? "execution_cycle_partial_failure"
              : waiting
                ? "submitted_waiting_reconciliation"
                : "execution_cycle_complete",

          reason:
            productFailure
              ? "one_or_more_products_failed"
              : null,

          governanceHttpStatus:
            governanceResponse.status,

          approvalId,

          authorizationId,

          portfolioPlanId,

          executableProducts,

          productResults,
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

          governanceHttpStatus:
            0,

          approvalId:
            null,

          authorizationId:
            null,

          portfolioPlanId:
            null,

          executableProducts:
            [],

          productResults:
            [],
        });
      }
    }


    /*
     * ========================================================
     * 6. SUMMARY
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


    const submitted =
      results.reduce(
        (
          total,
          client
        ) =>
          total +
          client.productResults.filter(
            (
              result
            ) =>
              result.submitted
          ).length,
        0
      );


    const settled =
      results.reduce(
        (
          total,
          client
        ) =>
          total +
          client.productResults.filter(
            (
              result
            ) =>
              result.reconciliation
                .status ===
              "settled"
          ).length,
        0
      );


    const waiting =
      results.reduce(
        (
          total,
          client
        ) =>
          total +
          client.productResults.filter(
            (
              result
            ) =>
              result.reconciliation
                .status ===
              "waiting"
          ).length,
        0
      );


    return json(
      200,
      {
        ok:
          failed ===
          0,

        status:
          failed ===
            0
            ? "atlas_multi_asset_cycle_complete"
            : "atlas_multi_asset_cycle_partial_failure",

        rolloutMode:
          mode,

        roster:
          roster.summary,

        selected:
          selectedUserIds.length,

        processed:
          results.length,

        successful,

        failed,

        coinbaseOrdersSubmitted:
          submitted,

        settled,

        waiting,

        results,
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

        status:
          "error",

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

        coinbaseOrdersSubmitted:
          0,
      }
    );
  }
}