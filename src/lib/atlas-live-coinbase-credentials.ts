/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Credentials Boundary
 *
 * PURPOSE
 * Provide Coinbase authentication context to the
 * Atlas live execution adapter.
 *
 * SAFETY
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

import type {
  AtlasCoinbaseRequestContext,
} from "./atlas-live-coinbase-client";

import {
  createAtlasCoinbaseJwt,
} from "./atlas-live-coinbase-jwt";


export async function getAtlasLiveCoinbaseCredentials():
  Promise<AtlasCoinbaseRequestContext | null> {

  const apiKey =
    process.env.ATLAS_COINBASE_API_KEY_NAME ?? "";


  if (!apiKey) {
    return null;
  }


  const jwt =
    await createAtlasCoinbaseJwt(
      "POST",
      "/api/v3/brokerage/orders"
    );


  return {
    apiKey,
    jwt,
  };
}


export async function refreshAtlasLiveCoinbaseCredentials():
  Promise<void> {

  const apiKey =
    process.env.ATLAS_COINBASE_API_KEY_NAME ?? "";


  if (!apiKey) {
    throw new Error(
      "ATLAS_COINBASE_API_KEY_NAME missing"
    );
  }


  await createAtlasCoinbaseJwt(
    "POST",
    "/api/v3/brokerage/orders"
  );
}