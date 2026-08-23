/**
 * ============================================================
 * YieldCraft Atlas
 * Coinbase Account Verification
 *
 * PURPOSE
 * Read-only verification of the Coinbase account connected to
 * the isolated Atlas live credentials.
 *
 * SAFETY
 * - Operator controlled
 * - GET request only
 * - No order submission
 * - No execution
 * - No approval mutation
 * - No authorization mutation
 * - No Pulse
 * - No Recon
 * - Does not modify legacy Atlas BTC
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  createAtlasCoinbaseJwt,
} from "@/lib/atlas-live-coinbase-jwt";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function json(
  status: number,
  body: unknown
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}


export async function GET(
  req: Request
) {
  try {

    /*
     * Require the same protected Atlas operator token
     * used by the execution boundary.
     */
    const configuredToken =
      process.env
        .ATLAS_APPROVAL_OPERATOR_TOKEN;

    if (!configuredToken) {
      return json(500, {
        ok: false,
        error:
          "missing_ATLAS_APPROVAL_OPERATOR_TOKEN",
      });
    }


    const suppliedToken =
      (
        req.headers.get(
          "x-atlas-operator-token"
        ) ?? ""
      ).trim();


    if (
      !suppliedToken ||
      suppliedToken !== configuredToken
    ) {
      return json(401, {
        ok: false,
        error: "unauthorized",
      });
    }


    /*
     * Sign specifically for the READ-ONLY Coinbase
     * accounts endpoint.
     */
    const path =
      "/api/v3/brokerage/accounts";


    const jwt =
      await createAtlasCoinbaseJwt(
        "GET",
        path
      );


    /*
     * GET ONLY.
     *
     * There is deliberately no order endpoint,
     * payload, POST, or execution call in this route.
     */
    const response =
      await fetch(
        `https://api.coinbase.com${path}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${jwt}`,
          },
        }
      );


    const data: unknown =
      await response
        .json()
        .catch(() => null);


    if (!response.ok) {
      return json(
        response.status,
        {
          ok: false,
          error:
            "coinbase_accounts_request_failed",
          coinbaseStatus:
            response.status,
        }
      );
    }


    /*
     * Sanitize the response.
     *
     * Return only currency + available balance.
     * Do not expose account IDs, API key information,
     * JWTs, or credential material.
     */
    const accountsRaw =
      typeof data === "object" &&
      data !== null
        ? Reflect.get(
            data,
            "accounts"
          )
        : null;


    const accounts =
      Array.isArray(accountsRaw)
        ? accountsRaw.map(
            (account: unknown) => {

              const currency =
                typeof account === "object" &&
                account !== null
                  ? Reflect.get(
                      account,
                      "currency"
                    )
                  : null;


              const availableBalance =
                typeof account === "object" &&
                account !== null
                  ? Reflect.get(
                      account,
                      "available_balance"
                    )
                  : null;


              const value =
                typeof availableBalance ===
                  "object" &&
                availableBalance !== null
                  ? Reflect.get(
                      availableBalance,
                      "value"
                    )
                  : null;


              return {
                currency:
                  typeof currency ===
                    "string"
                    ? currency
                    : null,

                availableBalance:
                  typeof value ===
                    "string"
                    ? value
                    : null,
              };
            }
          )
        : [];


    return json(200, {
      ok: true,

      mode:
        "read_only_account_verification",

      accountCount:
        accounts.length,

      accounts:
        accounts.filter(
          (
            account: {
              currency: string | null;
              availableBalance:
                string | null;
            }
          ) =>
            account.currency &&
            account.availableBalance &&
            Number(
              account.availableBalance
            ) !== 0
        ),
    });

  } catch (error) {

    return json(500, {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });
  }
}