/**
 * Target Portfolio Engine
 *
 * Single responsibility:
 * Convert a client's selected assets and baskets
 * into one clean, validated target portfolio.
 *
 * This file knows NOTHING about:
 * - Coinbase
 * - Pulse
 * - Atlas execution
 * - Orders
 * - Users
 * - Allocations
 * - Policy
 * - Databases
 */

import type { SupportedAsset } from "./types";
import {
  getBasketAssets,
  type SupportedBasket,
} from "./basket-registry";
import { ATLAS_ASSET_REGISTRY } from "./asset-registry";

export type ClientSelection = {
  assets?: SupportedAsset[];
  baskets?: Exclude<SupportedBasket, "CUSTOM">[];
};

const registeredSymbols = new Set<SupportedAsset>(
  ATLAS_ASSET_REGISTRY.map((asset) => asset.symbol)
);

export function buildTargetPortfolio(
  selection: ClientSelection
): SupportedAsset[] {
  const portfolio = new Set<SupportedAsset>();

  for (const asset of selection.assets ?? []) {
    if (registeredSymbols.has(asset)) {
      portfolio.add(asset);
    }
  }

  for (const basket of selection.baskets ?? []) {
    for (const asset of getBasketAssets(basket)) {
      if (registeredSymbols.has(asset)) {
        portfolio.add(asset);
      }
    }
  }

  return [...portfolio].sort();
}