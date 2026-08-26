/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Shared Coinbase Account Safety Gate
 * ------------------------------------------------------------
 * PURPOSE
 * Prevent Atlas Multi-Asset BTC accumulation on a Coinbase
 * account whose BTC balance may also be visible to Pulse.
 *
 * TEMPORARY PRODUCTION SAFETY INVARIANT
 *
 * Until BTC custody / portfolio isolation is proven:
 *
 *   Atlas Multi-Asset BTC-USD live execution = BLOCKED
 *
 * Other Atlas Multi-Asset products are unaffected.
 *
 * THIS MODULE:
 * - does NOT modify Pulse
 * - does NOT modify legacy Atlas
 * - does NOT submit orders
 * - does NOT access credentials
 * - does NOT mutate state
 * - does NOT create SELL capability
 * ============================================================
 */

export type AtlasSharedAccountSafetyResult =
  | {
      allowed: true;
      reason: "shared_account_product_allowed";
    }
  | {
      allowed: false;
      reason: "atlas_btc_blocked_shared_pulse_account";
    };

export function evaluateAtlasSharedAccountSafety(
  productIdInput: string
): AtlasSharedAccountSafetyResult {
  const productId =
    String(productIdInput ?? "")
      .trim()
      .toUpperCase();

  if (productId === "BTC-USD") {
    return {
      allowed: false,
      reason: "atlas_btc_blocked_shared_pulse_account",
    };
  }

  return {
    allowed: true,
    reason: "shared_account_product_allowed",
  };
}