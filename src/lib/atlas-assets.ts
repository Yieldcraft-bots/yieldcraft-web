/**
 * Atlas Asset Registry
 *
 * Single responsibility:
 * Define assets Atlas understands.
 *
 * This file knows NOTHING about:
 * - execution
 * - Coinbase API calls
 * - users
 * - allocations
 * - orders
 * - APIs
 */

export type AtlasBroker = "coinbase";

export type AtlasAsset = {
  id: string;
  symbol: string;
  displayName: string;

  broker: AtlasBroker;

  usdPair?: string;
  usdcPair?: string;

  accumulationEnabled: boolean;
};

export const ATLAS_ASSETS: readonly AtlasAsset[] = [

  // ============================================================
  // Crypto
  // ============================================================

  {
    id: "btc",
    symbol: "BTC",
    displayName: "Bitcoin",
    broker: "coinbase",
    usdPair: "BTC-USD",
    usdcPair: "BTC-USDC",
    accumulationEnabled: true,
  },

  {
    id: "eth",
    symbol: "ETH",
    displayName: "Ethereum",
    broker: "coinbase",
    usdPair: "ETH-USD",
    usdcPair: "ETH-USDC",
    accumulationEnabled: true,
  },

  {
    id: "sol",
    symbol: "SOL",
    displayName: "Solana",
    broker: "coinbase",
    usdPair: "SOL-USD",
    usdcPair: "SOL-USDC",
    accumulationEnabled: true,
  },

  {
    id: "xrp",
    symbol: "XRP",
    displayName: "XRP",
    broker: "coinbase",
    usdPair: "XRP-USD",
    usdcPair: "XRP-USDC",
    accumulationEnabled: true,
  },

  {
    id: "xlm",
    symbol: "XLM",
    displayName: "Stellar",
    broker: "coinbase",
    usdPair: "XLM-USD",
    usdcPair: "XLM-USDC",
    accumulationEnabled: true,
  },

  // ============================================================
  // Equities — Coinbase canonical product IDs
  // ============================================================

  {
    id: "aapl",
    symbol: "AAPL",
    displayName: "Apple",
    broker: "coinbase",
    usdPair:
      "ec78ee42e2d0c969366fc2540fd2f49f0e8d2b8a8ad258417a814287eb8a2994",
    usdcPair:
      "2f1650bd6b89ea2252ba90ccad27dc5e59868c361e488360a473ba831eae8f13",
    accumulationEnabled: true,
  },

  {
    id: "msft",
    symbol: "MSFT",
    displayName: "Microsoft",
    broker: "coinbase",
    usdPair:
      "19c51a954ce8fe1b426cb03dbf0a7aafcbc5974e6def77d7d7748de857077a6a",
    usdcPair:
      "da6ae33c26d66c691a5f74274d45ff05ad4c417618a83cb588802d4d337846c9",
    accumulationEnabled: true,
  },

  {
    id: "nvda",
    symbol: "NVDA",
    displayName: "NVIDIA",
    broker: "coinbase",
    usdPair:
      "0768434bfc699ec64c5f8e98f357444e72fcb1f2ac16a3126584d86c57a25c90",
    usdcPair:
      "d1d4306c886d02df435f4ee6e9eb933ef7dc48686554470f1798bea628b22ae9",
    accumulationEnabled: true,
  },

  {
    id: "amzn",
    symbol: "AMZN",
    displayName: "Amazon",
    broker: "coinbase",
    usdPair:
      "1863240f697ecfead180e27f4c0999cde5a3280cf48ccb62ddc23f1d9b7ec422",
    usdcPair:
      "f6b32ab9f9fafdd016467dcb31bb4047f0e225ddd37708176d4a791cbb41181e",
    accumulationEnabled: true,
  },

  {
    id: "meta",
    symbol: "META",
    displayName: "Meta",
    broker: "coinbase",
    usdPair:
      "f66c67e68612e01c3ea155ac44704157b8650cfc7ac443bf5671b5b05a416c38",
    usdcPair:
      "39de09048f828e84a2c23ce0dc59e925f7921e82a1c7b4442bec10c858d22016",
    accumulationEnabled: true,
  },

  {
    id: "googl",
    symbol: "GOOGL",
    displayName: "Alphabet",
    broker: "coinbase",
    usdPair:
      "55af8e09d5845ff96668e8c755652a42ce6ec3b1f6dd06e9aec843e8f4510299",
    usdcPair:
      "bfa84caebe649c7d0fe84485126d2021c31275da4485aff90f335af7dee8d456",
    accumulationEnabled: true,
  },

  {
    id: "tsla",
    symbol: "TSLA",
    displayName: "Tesla",
    broker: "coinbase",
    usdPair:
      "391b3854ce43dd60b22c0b3b635ebe7b8075e0a7f13b2a4fe2c302d229f00de7",
    usdcPair:
      "5144e79cde557e52eaace354836e6d98ae27747ed33c2a854a19545c71fbcf37",
    accumulationEnabled: true,
  },

  {
    id: "spacex",
    symbol: "SPACEX",
    displayName: "SpaceX",
    broker: "coinbase",
    usdPair:
      "d0484aeacc93f88a18b0431b8d2aac6efededa3b203ff4b55c72b64805aa5a2e",
    usdcPair:
      "ed1f01897dcd14d8e9a30890288cfd1c547dcbe5072a64f236111d8dc7a4a238",
    accumulationEnabled: true,
  },

] as const;

export function getAtlasAsset(
  symbol: string
): AtlasAsset | undefined {
  return ATLAS_ASSETS.find(
    (asset) =>
      asset.symbol === symbol.trim().toUpperCase()
  );
}