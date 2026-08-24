/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Credentials Boundary
 *
 * PURPOSE
 * Provide per-client Coinbase authentication context to the
 * Atlas live execution infrastructure.
 *
 * SAFETY
 * - Credentials are scoped to the authorization user
 * - Atlas product_scope only
 * - Supports request-specific GET/POST JWT creation
 * - No execution logic
 * - No order decisions
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 *
 * This file only provides credentials.
 * ============================================================
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import type {
  AtlasCoinbaseRequestContext,
} from "./atlas-live-coinbase-client";


type CoinbaseKeyAlg =
  | "ES256"
  | "EdDSA";


type AtlasCoinbaseHttpMethod =
  | "GET"
  | "POST";


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


function buildAtlasClientCoinbaseJwt(
  apiKeyName: string,
  privateKeyPem: string,
  method: AtlasCoinbaseHttpMethod,
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


async function loadAtlasClientCoinbaseKeys(
  userId: string
) {

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


  return {
    apiKeyName,
    privateKeyPem,
    keyAlg,
  };
}


async function createAtlasCoinbaseRequestContext(
  userId: string,
  method: AtlasCoinbaseHttpMethod,
  path: string
): Promise<AtlasCoinbaseRequestContext> {

  const keys =
    await loadAtlasClientCoinbaseKeys(
      userId
    );


  const signedJwt =
    buildAtlasClientCoinbaseJwt(
      keys.apiKeyName,
      keys.privateKeyPem,
      method,
      path,
      keys.keyAlg
    );


  return {
    apiKey:
      keys.apiKeyName,

    jwt:
      signedJwt,
  };
}


export async function getAtlasLiveCoinbaseCredentials(
  userId: string
): Promise<AtlasCoinbaseRequestContext> {

  return createAtlasCoinbaseRequestContext(
    userId,
    "POST",
    "/api/v3/brokerage/orders"
  );
}


export async function getAtlasCoinbaseProductCredentials(
  userId: string,
  productId: string
): Promise<AtlasCoinbaseRequestContext> {

  const normalizedProductId =
    productId.trim();


  if (!normalizedProductId) {
    throw new Error(
      "atlas_coinbase_product_id_missing"
    );
  }


  return createAtlasCoinbaseRequestContext(
    userId,
    "GET",
    `/api/v3/brokerage/products/${encodeURIComponent(
      normalizedProductId
    )}`
  );
}


export async function getAtlasCoinbaseOrderCredentials(
  userId: string,
  orderId: string
): Promise<AtlasCoinbaseRequestContext> {

  const normalizedOrderId =
    orderId.trim();


  if (!normalizedOrderId) {
    throw new Error(
      "atlas_coinbase_order_id_missing"
    );
  }


  return createAtlasCoinbaseRequestContext(
    userId,
    "GET",
    `/api/v3/brokerage/orders/historical/${encodeURIComponent(
      normalizedOrderId
    )}`
  );
}


export async function refreshAtlasLiveCoinbaseCredentials(
  userId: string
): Promise<void> {

  await createAtlasCoinbaseRequestContext(
    userId,
    "POST",
    "/api/v3/brokerage/orders"
  );
}