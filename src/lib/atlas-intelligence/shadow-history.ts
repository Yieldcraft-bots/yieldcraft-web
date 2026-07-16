/**
 * ============================================================
 * Shadow History Model
 * ------------------------------------------------------------
 * PURPOSE
 * Define the read-only history model used to track Atlas
 * shadow recommendations over time.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No API
 * - No Database
 * ============================================================
 */

import type { SupportedAsset } from "./types";

export interface ShadowHistoryEntry {
  generatedAt: string;
  asset: SupportedAsset | null;
  recommendedAmountUsd: number;
  eligible: boolean;
  reason: string;
}

export interface ShadowHistorySummary {
  totalRecommendations: number;
  eligibleRecommendations: number;
  lastRecommendation: ShadowHistoryEntry | null;
}

export function summarizeShadowHistory(
  history: ShadowHistoryEntry[]
): ShadowHistorySummary {
  return {
    totalRecommendations: history.length,
    eligibleRecommendations: history.filter(
      (entry) => entry.eligible
    ).length,
    lastRecommendation:
      history.length > 0
        ? history[history.length - 1]
        : null,
  };
}