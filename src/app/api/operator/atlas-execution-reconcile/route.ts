/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Submitted Execution Reconciliation Route
 * ------------------------------------------------------------
 * PURPOSE
 * Reconcile an already-submitted Atlas Multi-Asset live order
 * after Coinbase has had time to settle it.
 *
 * THIS ROUTE DOES NOT EXECUTE ORDERS.
 *
 * FLOW
 * - Operator authentication
 * - Accept existing executionKey
 * - Load existing SUBMITTED audit
 * - GET authoritative Coinbase order state
 * - Confirm actual filled_value
 * - Consume only confirmed pending USD
 * - Transition existing audit SUBMITTED -> SETTLED
 *
 * SAFETY
 * - NO Coinbase order submission
 * - NO new execution reservation
 * - NO approval mutation
 * - NO authorization mutation
 * - NO portfolio-plan mutation
 * - NO SELL logic
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  NextResponse,
} from "next/server";

import {
  reconcileAtlasSubmittedLiveOrder,
} from "@/lib/atlas-live-submitted-order-reconciler";


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


function getOperatorToken(
  request: Request
): string {

  return (
    request.headers.get(
      "x-atlas-operator-token"
    ) ??
    ""
  ).trim();
}


export async function POST(
  request: Request
) {

  try {

    /*
     * ========================================================
     * 1. OPERATOR AUTHENTICATION
     * ========================================================
     */

    const configuredToken =
      process.env
        .ATLAS_APPROVAL_OPERATOR_TOKEN;


    if (
      !configuredToken
    ) {

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


    const suppliedToken =
      getOperatorToken(
        request
      );


    if (
      !suppliedToken ||
      suppliedToken !==
        configuredToken
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
     * 2. REQUEST
     * ========================================================
     */

    const body =
      await request
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


    const executionKeyValue =
      Reflect.get(
        body,
        "executionKey"
      );


    const executionKey =
      typeof executionKeyValue ===
        "string"
        ? executionKeyValue.trim()
        : "";


    if (
      !executionKey
    ) {

      return json(
        400,
        {
          ok:
            false,

          error:
            "missing_execution_key",
        }
      );
    }


    /*
     * ========================================================
     * 3. RECONCILIATION ONLY
     * ========================================================
     *
     * IMPORTANT:
     *
     * This does NOT invoke:
     *
     * executeAtlasLiveInstruction()
     *
     * or:
     *
     * submitAtlasLiveCoinbaseOrder()
     *
     * It operates only on the already-existing submitted order.
     */

    const result =
      await reconcileAtlasSubmittedLiveOrder(
        executionKey
      );


    /*
     * ========================================================
     * 4. RESPONSE
     * ========================================================
     */

    if (
      result.status ===
        "blocked"
    ) {

      return json(
        409,
        {
          ...result,

          execution:
            "NOT_CALLED",

          coinbaseOrderSubmission:
            "NOT_CALLED",
        }
      );
    }


    return json(
      200,
      {
        ...result,

        execution:
          "NOT_CALLED",

        coinbaseOrderSubmission:
          "NOT_CALLED",
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

        execution:
          "NOT_CALLED",

        coinbaseOrderSubmission:
          "NOT_CALLED",
      }
    );
  }
}