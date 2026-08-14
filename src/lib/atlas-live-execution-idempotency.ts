/**
 * ============================================================
 * YieldCraft Atlas
 * Live Execution Idempotency
 *
 * PURPOSE
 * Prevent duplicate Atlas live execution submissions.
 *
 * SAFETY
 * - No trading logic
 * - No Coinbase calls
 * - No authorization decisions
 * - No UI access
 * - No Pulse
 * - No Recon
 *
 * This file only creates and checks execution fingerprints.
 * ============================================================
 */


export type AtlasExecutionFingerprintInput = {
  userId: string;
  authorizationId: string;
  productId: string;
  quoteSizeUsd: number;
};


export function createAtlasExecutionFingerprint(
  input: AtlasExecutionFingerprintInput
): string {

  return [
    input.userId,
    input.authorizationId,
    input.productId,
    input.quoteSizeUsd.toFixed(2),
  ].join(":");
}