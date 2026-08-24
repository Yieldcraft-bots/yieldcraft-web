/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Per-Client Coinbase Funding Reader
 * ------------------------------------------------------------
 * PURPOSE
 * Resolve authoritative read-only Coinbase funding balances for
 * one Atlas client using that client's stored Atlas credentials.
 *
 * SAFETY
 * - Read-only Coinbase access
 * - No order submission
 * - No execution
 * - No approval mutation
 * - No authorization mutation
 * - Atlas product scope only
 * - No Pulse
 * - No Recon
 * - Does not modify legacy Atlas BTC execution
 *
 * IMPORTANT
 * USD and USDC are intentionally kept separate.
 *
 * Until separately proven safe for all intended asset classes,
 * USDC is NOT automatically counted as deployable USD cash.
 * ============================================================
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";

import {
  createClient,
} from "@supabase/supabase-js";


type CoinbaseKeyAlg =
  | "ES256"
  | "EdDSA";


type AtlasClientFundingBalance = {
  userId: string;

  productScope: "atlas";

  usdAvailable: number;

  usdcAvailable: number;

  deployableCashUsd: number;

  checkedAt: string;
};


function normalizePem(
  pem: string
) {
  let normalized =
    (pem || "").trim();


  if (
    (
      normalized.startsWith('"') &&
      normalized.endsWith('"')
    ) ||
    (
      normalized.startsWith("'") &&
      normalized.endsWith("'")
    )
  ) {
    normalized =
      normalized.slice(
        1,
        -1
      );
  }


  return normalized
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
}


function safeJsonParse(
  text: string
): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}


function finiteNumber(
  value: unknown
): number {
  const parsed =
    Number(value);


  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function buildCdpJwt(
  apiKeyName: string,
  privateKeyPem: string,
  method: "GET",
  path: string,
  alg: CoinbaseKeyAlg
) {
  const now =
    Math.floor(
      Date.now() / 1000
    );


  const nonce =
    crypto
      .randomBytes(16)
      .toString("hex");


  const uri =
    `${method} api.coinbase.com${path}`;


  return jwt.sign(
    {
      iss: "cdp",
      sub: apiKeyName,
      nbf: now,
      exp: now + 60,
      uri,
    },

    privateKeyPem as any,

    {
      algorithm:
        alg as any,

      header: {
        kid: apiKeyName,
        nonce,
      } as any,
    } as any
  );
}


async function coinbaseGet(
  apiKeyName: string,
  privateKeyPem: string,
  path: string,
  alg: CoinbaseKeyAlg
) {
  const token =
    buildCdpJwt(
      apiKeyName,
      privateKeyPem,
      "GET",
      path,
      alg
    );


  const response =
    await fetch(
      `https://api.coinbase.com${path}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        cache: "no-store",
      }
    );


  const text =
    await response.text();


  const data =
    safeJsonParse(text);


  return {
    ok:
      response.ok,

    status:
      response.status,

    data,
  };
}


export async function getAtlasClientFundingBalance(
  userId: string
): Promise<AtlasClientFundingBalance> {

  const normalizedUserId =
    userId.trim();


  if (!normalizedUserId) {
    throw new Error(
      "atlas_client_user_id_missing"
    );
  }


  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";


  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ??
    "";


  if (!supabaseUrl) {
    throw new Error(
      "atlas_supabase_url_missing"
    );
  }


  if (!serviceRoleKey) {
    throw new Error(
      "atlas_supabase_service_role_missing"
    );
  }


  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );


  const {
    data: keys,
    error: keysError,
  } =
    await supabase
      .from("coinbase_keys")
      .select(
        "api_key_name, private_key, key_alg, product_scope"
      )
      .eq(
        "user_id",
        normalizedUserId
      )
      .eq(
        "product_scope",
        "atlas"
      )
      .maybeSingle();


  if (keysError) {
    throw new Error(
      `atlas_coinbase_keys_lookup_failed:${keysError.message}`
    );
  }


  if (
    !keys?.api_key_name ||
    !keys?.private_key
  ) {
    throw new Error(
      "atlas_coinbase_credentials_missing"
    );
  }


  const apiKeyName =
    String(
      keys.api_key_name
    ).trim();


  const privateKeyPem =
    normalizePem(
      String(
        keys.private_key
      )
    );


  if (
    !apiKeyName ||
    !privateKeyPem
  ) {
    throw new Error(
      "atlas_coinbase_credentials_invalid"
    );
  }


  const keyAlgRaw =
    String(
      keys.key_alg ??
      "ES256"
    ).toUpperCase();


  const keyAlg:
    CoinbaseKeyAlg =
      keyAlgRaw === "EDDSA"
        ? "EdDSA"
        : "ES256";


  const path =
    "/api/v3/brokerage/accounts";


  const accountsResponse =
    await coinbaseGet(
      apiKeyName,
      privateKeyPem,
      path,
      keyAlg
    );


  if (!accountsResponse.ok) {
    throw new Error(
      `atlas_coinbase_accounts_failed:${accountsResponse.status}`
    );
  }


  const accountsRaw =
    typeof accountsResponse.data ===
      "object" &&
    accountsResponse.data !== null
      ? Reflect.get(
          accountsResponse.data,
          "accounts"
        )
      : null;


  if (!Array.isArray(accountsRaw)) {
    throw new Error(
      "atlas_coinbase_accounts_invalid"
    );
  }


  let usdAvailable =
    0;


  let usdcAvailable =
    0;


  for (
    const account
    of accountsRaw
  ) {

    if (
      typeof account !== "object" ||
      account === null
    ) {
      continue;
    }


    const currencyValue =
      Reflect.get(
        account,
        "currency"
      );


    const availableBalance =
      Reflect.get(
        account,
        "available_balance"
      );


    const value =
      typeof availableBalance ===
        "object" &&
      availableBalance !== null
        ? Reflect.get(
            availableBalance,
            "value"
          )
        : null;


    const currency =
      typeof currencyValue ===
        "string"
        ? currencyValue
            .trim()
            .toUpperCase()
        : "";


    const balance =
      finiteNumber(
        value
      );


    if (balance < 0) {
      throw new Error(
        "atlas_coinbase_negative_balance"
      );
    }


    if (currency === "USD") {
      usdAvailable +=
        balance;
    }


    if (currency === "USDC") {
      usdcAvailable +=
        balance;
    }
  }


  if (
    !Number.isFinite(
      usdAvailable
    ) ||
    !Number.isFinite(
      usdcAvailable
    )
  ) {
    throw new Error(
      "atlas_coinbase_balance_invalid"
    );
  }


  const deployableCashUsd =
    Number(
      usdAvailable.toFixed(2)
    );


  return {
    userId:
      normalizedUserId,

    productScope:
      "atlas",

    usdAvailable:
      Number(
        usdAvailable.toFixed(2)
      ),

    usdcAvailable:
      Number(
        usdcAvailable.toFixed(2)
      ),

    deployableCashUsd,

    checkedAt:
      new Date()
        .toISOString(),
  };
}