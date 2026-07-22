/**
 * ============================================================
 * Atlas Portfolio State
 * ------------------------------------------------------------
 * PURPOSE
 * Portfolio-aware state model.
 *
 * Pure types only.
 * No database.
 * No Coinbase.
 * No execution.
 * ============================================================
 */

export interface AtlasAssetState {
  symbol: string;
  quantity: number;
  averageCostUsd?: number;
  lastBuyAt?: string | null;
  lastSellAt?: string | null;
}

export interface AtlasPortfolioState {
  userId: string;

  cashAvailableUsd: number;

  assets: AtlasAssetState[];

  cooldownUntil?: string | null;

  marketState?: string | null;

  updatedAt?: string | null;
}

export function getPortfolioAsset(
  state: AtlasPortfolioState,
  symbol: string
): AtlasAssetState | undefined {
  return state.assets.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

export function hasPortfolioAsset(
  state: AtlasPortfolioState,
  symbol: string
): boolean {
  return getPortfolioAsset(state, symbol) !== undefined;
}