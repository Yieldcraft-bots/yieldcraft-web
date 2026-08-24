/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Coinbase Equity Product Map Diagnostic
 * ------------------------------------------------------------
 * PURPOSE
 * READ-ONLY lookup of Coinbase EQUITY products visible to the
 * connected Atlas client credentials.
 *
 * TARGETS
 * - AAPL
 * - AMZN
 * - GOOGL
 * - META
 * - MSFT
 * - NVDA
 * - SPCX
 * - TSLA
 *
 * SAFETY
 * - GET only
 * - No orders
 * - No execution
 * - No mutations
 * - No approval
 * - No authorization
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


const TARGETS = [
  "AAPL",
  "AMZN",
  "GOOGL",
  "META",
  "MSFT",
  "NVDA",
  "SPCX",
  "TSLA",
] as const;


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
  pathForJwt: string,
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
    `${method} api.coinbase.com${pathForJwt}`;


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


function textOf(
  object: unknown,
  field: string
): string {

  const value =
    valueOf(
      object,
      field
    );


  return typeof value === "string"
    ? value
    : "";
}


function containsTarget(
  product: unknown,
  target: string
): boolean {

  const fields = [
    textOf(product, "product_id"),
    textOf(product, "display_name"),
    textOf(product, "base_name"),
    textOf(product, "base_currency_id"),
    textOf(product, "quote_currency_id"),
  ]
    .join(" ")
    .toUpperCase();


  return fields.includes(
    target.toUpperCase()
  );
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


  const keyFingerprint =
    crypto
      .createHash("sha256")
      .update(apiKeyName)
      .digest("hex")
      .slice(0, 12);


  console.log(
    "\nATLAS COINBASE EQUITY PRODUCT MAP"
  );


  console.log(
    "--------------------------------"
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


  /*
   * Coinbase equity product catalog.
   *
   * IMPORTANT:
   * Query string is sent to Coinbase, but the JWT URI claim
   * signs only the endpoint path.
   */
  const pathForJwt =
    "/api/v3/brokerage/products";


  const requestPath =
    `${pathForJwt}?product_type=EQUITY`;


  const token =
    buildJwt(
      apiKeyName,
      privateKeyPem,
      "GET",
      pathForJwt,
      alg
    );


  const response =
    await fetch(
      `https://api.coinbase.com${requestPath}`,
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


  let data: any;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw:
        text,
    };
  }


  console.log(
    "COINBASE STATUS:",
    response.status
  );


  if (!response.ok) {

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );


    throw new Error(
      "Coinbase equity products request failed"
    );
  }


  const products =
    Array.isArray(
      data?.products
    )
      ? data.products
      : [];


  console.log(
    "TOTAL EQUITY PRODUCTS:",
    products.length
  );


  for (
    const target
    of TARGETS
  ) {

    const matches =
      products.filter(
        (product: unknown) =>
          containsTarget(
            product,
            target
          )
      );


    console.log(
      `\n===== ${target} =====`
    );


    if (
      matches.length === 0
    ) {

      console.log(
        "NO MATCH"
      );

      continue;
    }


    for (
      const product
      of matches
    ) {

      console.log(
        JSON.stringify(
          {
            productId:
              valueOf(
                product,
                "product_id"
              ),

            displayName:
              valueOf(
                product,
                "display_name"
              ),

            baseName:
              valueOf(
                product,
                "base_name"
              ),

            baseCurrencyId:
              valueOf(
                product,
                "base_currency_id"
              ),

            quoteCurrencyId:
              valueOf(
                product,
                "quote_currency_id"
              ),

            productType:
              valueOf(
                product,
                "product_type"
              ),

            tradingDisabled:
              valueOf(
                product,
                "trading_disabled"
              ),

            cancelOnly:
              valueOf(
                product,
                "cancel_only"
              ),

            limitOnly:
              valueOf(
                product,
                "limit_only"
              ),

            postOnly:
              valueOf(
                product,
                "post_only"
              ),

            isDisabled:
              valueOf(
                product,
                "is_disabled"
              ),

            viewOnly:
              valueOf(
                product,
                "view_only"
              ),

            status:
              valueOf(
                product,
                "status"
              ),

            equityProductDetails:
              valueOf(
                product,
                "equity_product_details"
              ),
          },
          null,
          2
        )
      );
    }
  }


  console.log(
    "\nRESULT: READ-ONLY EQUITY PRODUCT MAP COMPLETE"
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