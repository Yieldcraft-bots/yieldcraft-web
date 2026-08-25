import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import {
  getClientAllocationPlan,
} from "@/lib/repositories/clientAllocationRepository";


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
        "Cache-Control":
          "no-store",
      },
    }
  );
}


async function createRequestClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


  if (
    !url ||
    !anonKey
  ) {
    throw new Error(
      "Missing Supabase environment variables."
    );
  }


  const cookieStore =
    await cookies();


  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll() {
          /*
           * Preview is read only.
           */
        },
      },
    }
  );
}


async function getSession() {
  const supabase =
    await createRequestClient();


  const {
    data,
    error,
  } =
    await supabase.auth.getUser();


  if (
    error ||
    !data.user
  ) {
    return null;
  }


  const {
    data: sessionData,
  } =
    await supabase.auth.getSession();


  return {
    userId:
      data.user.id,

    accessToken:
      sessionData.session
        ?.access_token ??
      null,
  };
}


async function hasAtlasEntitlement(
  userId: string
) {
  const supabase =
    await createRequestClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "entitlements"
      )
      .select(
        "atlas"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();


  if (error) {
    throw new Error(
      "atlas_entitlement_check_failed"
    );
  }


  return (
    data?.atlas ===
    true
  );
}


async function getAtlasAvailableCash(
  req: Request,
  accessToken: string
): Promise<number | null> {

  const balanceUrl =
    new URL(
      "/api/coinbase/balances?product=atlas",
      req.url
    );


  try {

    const response =
      await fetch(
        balanceUrl,
        {
          cache:
            "no-store",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );


    if (!response.ok) {
      return null;
    }


    const data =
      await response
        .json()
        .catch(
          () => null
        );


    if (!data?.ok) {
      return null;
    }


    const value =
      Number(
        data.available_usd
      );


    return Number.isFinite(
      value
    )
      ? value
      : null;

  } catch {

    return null;
  }
}


export async function GET(
  req: Request
) {

  try {

    /*
     * ========================================================
     * AUTHENTICATION
     * ========================================================
     */

    const session =
      await getSession();


    if (!session) {
      return json(
        401,
        {
          ok: false,
          preview: true,
          reason:
            "not_authenticated",
        }
      );
    }


    /*
     * ========================================================
     * ATLAS ENTITLEMENT
     * ========================================================
     */

    const atlasEnabled =
      await hasAtlasEntitlement(
        session.userId
      );


    if (!atlasEnabled) {
      return json(
        200,
        {
          ok: true,
          preview: true,
          status:
            "blocked",
          reason:
            "atlas_entitlement_required",
        }
      );
    }


    /*
     * ========================================================
     * SAVED CLIENT ALLOCATION
     * ========================================================
     *
     * READ ONLY.
     *
     * Preview never creates a portfolio plan, approval,
     * authorization, execution reservation, or Coinbase order.
     */

    const allocationRows =
      await getClientAllocationPlan(
        session.userId
      );


    const allocations =
      allocationRows.map(
        (
          row
        ) => ({
          symbol:
            row.asset_symbol,

          targetPercent:
            Number(
              row.target_percent
            ),
        })
      );


    const allocationTotalPercent =
      allocations.reduce(
        (
          total,
          allocation
        ) =>
          total +
          allocation.targetPercent,
        0
      );


    const allocationValid =
      allocations.length >
        0 &&
      allocationTotalPercent ===
        100;


    /*
     * ========================================================
     * OPTIONAL BALANCE CONTEXT
     * ========================================================
     *
     * A balance failure must NOT prevent a client from seeing
     * their saved portfolio allocation.
     */

    const availableCash =
      session.accessToken
        ? await getAtlasAvailableCash(
            req,
            session.accessToken
          )
        : null;


    return json(
      200,
      {
        ok: true,

        preview:
          true,

        status:
          allocationValid
            ? "allocation_ready"
            : "allocation_incomplete",

        userId:
          session.userId,

        allocation: {
          valid:
            allocationValid,

          totalPercent:
            allocationTotalPercent,

          assetCount:
            allocations.length,

          allocations,
        },

        account: {
          availableCashUsd:
            availableCash,

          balanceVerified:
            availableCash !==
            null,
        },

        safety: {
          readOnly:
            true,

          portfolioPlanCreated:
            false,

          approvalCreated:
            false,

          authorizationCreated:
            false,

          executionCalled:
            false,

          coinbaseOrderSubmitted:
            false,
        },
      }
    );

  } catch (
    error
  ) {

    return json(
      500,
      {
        ok: false,

        preview:
          true,

        reason:
          "atlas_preview_failed",

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      }
    );
  }
}