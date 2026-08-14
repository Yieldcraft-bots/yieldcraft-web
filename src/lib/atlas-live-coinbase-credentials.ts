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


export function getAtlasLiveCoinbaseCredentials():
  AtlasCoinbaseRequestContext | null {

  const apiKey =
    process.env.ATLAS_COINBASE_API_KEY ?? "";

  const jwt =
    process.env.ATLAS_COINBASE_JWT ?? "";


  if (
    !apiKey ||
    !jwt
  ) {
    return null;
  }


  return {
    apiKey,
    jwt,
  };
}