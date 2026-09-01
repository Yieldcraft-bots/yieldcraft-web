/**
 * ============================================================
 * YieldCraft Pulse
 * Coinbase Credential Scope Boundary
 * ------------------------------------------------------------
 * PURPOSE
 * Provide a single fail-closed rule for determining whether a
 * Coinbase credential row is eligible for Pulse execution.
 *
 * SAFETY INVARIANT
 *
 *   Pulse may use ONLY credentials explicitly scoped:
 *
 *     product_scope = "pulse"
 *
 * Atlas-scoped credentials are rejected.
 * Legacy/null-scoped credentials are rejected.
 * Unknown scopes are rejected.
 *
 * THIS MODULE:
 * - does NOT submit orders
 * - does NOT access Coinbase
 * - does NOT access Supabase
 * - does NOT mutate state
 * - does NOT contain BUY/SELL logic
 * - does NOT modify Atlas
 * - does NOT modify Recon
 * ============================================================
 */

export type PulseCoinbaseKeyRow = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
  product_scope?: string | null;
};

export function isPulseScopedCoinbaseKey(
  row: unknown
): row is PulseCoinbaseKeyRow {
  if (!row || typeof row !== "object") {
    return false;
  }

  const candidate =
    row as Partial<PulseCoinbaseKeyRow>;

  const userId =
    String(candidate.user_id ?? "").trim();

  const apiKeyName =
    String(candidate.api_key_name ?? "").trim();

  const privateKey =
    String(candidate.private_key ?? "").trim();

  const productScope =
    String(candidate.product_scope ?? "")
      .trim()
      .toLowerCase();

  return (
    userId.length > 0 &&
    apiKeyName.startsWith("organizations/") &&
    privateKey.length > 0 &&
    productScope === "pulse"
  );
}

export function filterPulseScopedCoinbaseKeys(
  rows: unknown
): PulseCoinbaseKeyRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter(
    isPulseScopedCoinbaseKey
  );
}