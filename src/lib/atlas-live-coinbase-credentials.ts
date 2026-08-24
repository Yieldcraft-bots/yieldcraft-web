/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Credentials Boundary
 *
 * PURPOSE
 * Provide per-client Coinbase authentication context to the
 * Atlas live execution adapter.
 *
 * SAFETY
 * - Credentials are scoped to the authorization user
 * - Atlas product_scope only
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
  method: "POST",
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


export async function getAtlasLiveCoinbaseCredentials(
  userId: string
): Promise<AtlasCoinbaseRequestContext> {

  const keys =
    await loadAtlasClientCoinbaseKeys(
      userId
    );


  const path =
    "/api/v3/brokerage/orders";


  const signedJwt =
    buildAtlasClientCoinbaseJwt(
      keys.apiKeyName,
      keys.privateKeyPem,
      "POST",
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


export async function refreshAtlasLiveCoinbaseCredentials(
  userId: string
): Promise<void> {

  const keys =
    await loadAtlasClientCoinbaseKeys(
      userId
    );


  buildAtlasClientCoinbaseJwt(
    keys.apiKeyName,
    keys.privateKeyPem,
    "POST",
    "/api/v3/brokerage/orders",
    keys.keyAlg
  );
}