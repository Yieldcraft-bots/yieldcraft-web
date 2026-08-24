/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Coinbase Account + Portfolio Map Diagnostic
 * ------------------------------------------------------------
 * PURPOSE
 * READ-ONLY diagnostic to identify exactly which Coinbase
 * accounts and portfolio are visible to this Atlas client's
 * stored Atlas-scoped API credentials.
 *
 * SAFETY
 * - GET only
 * - No orders
 * - No execution
 * - No mutations
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC changes
 * - Does not print private key or JWT
 * ============================================================
 */

import { config } from "dotenv";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";


config({
  path: ".env.production.local",
});


const USER_ID =
  "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e";


type CoinbaseKeyAlg =
  | "ES256"
  | "EdDSA";


function normalizePem(
  pem: string
): string {

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


function buildJwt(
  apiKeyName: string,
  privateKeyPem: string,
  method: "GET",
  path: string,
  alg: CoinbaseKeyAlg
): string {

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


function valueOf(
  object: unknown,
  field: string
): unknown {

  if (
    typeof object !== "object" ||
    object === null
  ) {
    return null;
  }


  return Reflect.get(
    object,
    field
  );
}


async function coinbaseGet(
  apiKeyName: string,
  privateKeyPem: string,
  path: string,
  alg: CoinbaseKeyAlg
) {

  const token =
    buildJwt(
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

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  let data: unknown;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw:
        text,
    };
  }


  return {
    ok:
      response.ok,

    status:
      response.status,

    data,
  };
}


async function main() {

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";


  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";


  if (
    !supabaseUrl ||
    !serviceRole
  ) {
    throw new Error(
      "Missing Supabase production environment"
    );
  }


  const supabase =
    createClient(
      supabaseUrl,
      serviceRole,
      {
        auth: {
          persistSession: false,
        },
      }
    );


  const {
    data: keys,
    error,
  } =
    await supabase
      .from("coinbase_keys")
      .select(
        "api_key_name, private_key, key_alg, product_scope, updated_at"
      )
      .eq(
        "user_id",
        USER_ID
      )
      .eq(
        "product_scope",
        "atlas"
      )
      .maybeSingle();


  if (error) {
    throw new Error(
      `coinbase_keys_lookup_failed:${error.message}`
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


  const alg:
    CoinbaseKeyAlg =
      String(
        keys.key_alg ??
        "ES256"
      ).toUpperCase() ===
      "EDDSA"
        ? "EdDSA"
        : "ES256";


  /*
   * Non-secret fingerprint only.
   */
  const keyFingerprint =
    crypto
      .createHash("sha256")
      .update(apiKeyName)
      .digest("hex")
      .slice(0, 12);


  console.log(
    "\nATLAS COINBASE ACCOUNT + PORTFOLIO MAP"
  );


  console.log(
    "--------------------------------------"
  );


  console.log(
    "USER ID:",
    USER_ID
  );


  console.log(
    "PRODUCT SCOPE:",
    keys.product_scope
  );


  console.log(
    "KEY FINGERPRINT:",
    keyFingerprint
  );


  console.log(
    "KEY ROW UPDATED:",
    keys.updated_at ??
    null
  );


  /*
   * ==========================================================
   * 1. BROKERAGE ACCOUNTS
   * ==========================================================
   */

  const accountsPath =
    "/api/v3/brokerage/accounts";


  const accountsResponse =
    await coinbaseGet(
      apiKeyName,
      privateKeyPem,
      accountsPath,
      alg
    );


  console.log(
    "\nACCOUNTS STATUS:",
    accountsResponse.status
  );


  if (!accountsResponse.ok) {

    console.log(
      JSON.stringify(
        accountsResponse.data,
        null,
        2
      )
    );


    throw new Error(
      "Coinbase accounts request failed"
    );
  }


  const accountsData: any =
    accountsResponse.data;


  const accounts =
    Array.isArray(
      accountsData?.accounts
    )
      ? accountsData.accounts
      : [];


  const relevant =
    accounts.filter(
      (account: unknown) => {

        const currency =
          String(
            valueOf(
              account,
              "currency"
            ) ??
            ""
          )
            .trim()
            .toUpperCase();


        return (
          currency === "USD" ||
          currency === "USDC"
        );
      }
    );


  console.log(
    "\nUSD / USDC ACCOUNTS:"
  );


  const portfolioIds =
    new Set<string>();


  for (
    const account
    of relevant
  ) {

    const available =
      valueOf(
        account,
        "available_balance"
      );


    const hold =
      valueOf(
        account,
        "hold"
      );


    const portfolioIdValue =
      valueOf(
        account,
        "retail_portfolio_id"
      );


    const portfolioId =
      typeof portfolioIdValue ===
        "string"
        ? portfolioIdValue.trim()
        : "";


    if (portfolioId) {
      portfolioIds.add(
        portfolioId
      );
    }


    console.log(
      JSON.stringify(
        {
          uuid:
            valueOf(
              account,
              "uuid"
            ),

          name:
            valueOf(
              account,
              "name"
            ),

          currency:
            valueOf(
              account,
              "currency"
            ),

          type:
            valueOf(
              account,
              "type"
            ),

          default:
            valueOf(
              account,
              "default"
            ),

          active:
            valueOf(
              account,
              "active"
            ),

          ready:
            valueOf(
              account,
              "ready"
            ),

          retailPortfolioId:
            portfolioId ||
            null,

          platform:
            valueOf(
              account,
              "platform"
            ),

          availableBalance:
            valueOf(
              available,
              "value"
            ),

          availableCurrency:
            valueOf(
              available,
              "currency"
            ),

          holdValue:
            valueOf(
              hold,
              "value"
            ),

          holdCurrency:
            valueOf(
              hold,
              "currency"
            ),
        },
        null,
        2
      )
    );
  }


  console.log(
    "\nTOTAL COINBASE ACCOUNTS:",
    accounts.length
  );


  console.log(
    "PORTFOLIO IDS FROM USD/USDC:",
    Array.from(
      portfolioIds
    )
  );


  /*
   * ==========================================================
   * 2. LIST PORTFOLIOS
   * ==========================================================
   */

  const portfoliosPath =
    "/api/v3/brokerage/portfolios";


  const portfoliosResponse =
    await coinbaseGet(
      apiKeyName,
      privateKeyPem,
      portfoliosPath,
      alg
    );


  console.log(
    "\nPORTFOLIOS STATUS:",
    portfoliosResponse.status
  );


  if (portfoliosResponse.ok) {

    console.log(
      "PORTFOLIOS RESPONSE:"
    );


    console.log(
      JSON.stringify(
        portfoliosResponse.data,
        null,
        2
      )
    );

  } else {

    console.log(
      "PORTFOLIOS REQUEST DID NOT SUCCEED:"
    );


    console.log(
      JSON.stringify(
        portfoliosResponse.data,
        null,
        2
      )
    );
  }


  /*
   * ==========================================================
   * 3. PORTFOLIO BREAKDOWN
   * ==========================================================
   *
   * Query each portfolio ID Coinbase returned on the actual
   * USD/USDC accounts.
   *
   * Still GET/read-only.
   */

  for (
    const portfolioId
    of portfolioIds
  ) {

    const breakdownPath =
      `/api/v3/brokerage/portfolios/${portfolioId}`;


    const breakdownResponse =
      await coinbaseGet(
        apiKeyName,
        privateKeyPem,
        breakdownPath,
        alg
      );


    console.log(
      `\nPORTFOLIO BREAKDOWN STATUS (${portfolioId}):`,
      breakdownResponse.status
    );


    console.log(
      JSON.stringify(
        breakdownResponse.data,
        null,
        2
      )
    );
  }


  console.log(
    "\nRESULT: READ-ONLY ACCOUNT + PORTFOLIO MAP COMPLETE"
  );
}


main().catch(
  (error) => {

    console.error(
      "\nRESULT: FAIL"
    );


    console.error(
      error
    );


    process.exitCode = 1;
  }
);