/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Portfolio Intelligence V1
 * ------------------------------------------------------------
 * PURPOSE
 * Evaluate an entire client's pending Atlas Multi-Asset
 * portfolio and determine how much of each pending allocation
 * intelligence recommends deploying during this cycle.
 *
 * CORE RULES
 * - Client allocation remains authoritative.
 * - Intelligence may control entry timing/staging.
 * - Intelligence may NEVER redirect one asset's dollars into
 *   another asset.
 * - Intelligence may NEVER create SELL instructions.
 * - Intelligence may NEVER recommend more than pending capital.
 * - Pending capital remains assigned when intelligence waits.
 *
 * SAFETY
 * - Atlas Multi-Asset only
 * - Pure calculation
 * - No Coinbase
 * - No Supabase
 * - No database
 * - No credentials
 * - No orders
 * - No legacy Atlas
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  evaluateAtlasMultiAssetEntry,
  type AtlasMultiAssetEntryDecision,
  type AtlasMultiAssetMarketSnapshot,
} from "./entry-intelligence";


export interface AtlasMultiAssetPortfolioCandidate {
  symbol: string;

  targetPercent: number;

  pendingUsd: number;

  minOrderUsd: number;

  executionEligible: boolean;

  waitCycles: number;

  market:
    AtlasMultiAssetMarketSnapshot;
}


export interface AtlasMultiAssetPortfolioIntelligenceInput {
  candidates:
    readonly AtlasMultiAssetPortfolioCandidate[];
}


export interface AtlasMultiAssetPortfolioDecision {
  valid: boolean;

  reason: string;

  totalPendingUsd: number;

  recommendedDeployUsd: number;

  remainingPendingUsd: number;

  executableDecisionCount: number;

  waitingDecisionCount: number;

  blockedDecisionCount: number;

  decisions:
    AtlasMultiAssetEntryDecision[];
}


function money(
  value: number
): number {

  return Number(
    value.toFixed(2)
  );
}


export function evaluateAtlasMultiAssetPortfolio(
  input: AtlasMultiAssetPortfolioIntelligenceInput
): AtlasMultiAssetPortfolioDecision {

  if (
    !Array.isArray(
      input.candidates
    ) ||
    input.candidates.length ===
      0
  ) {
    return {
      valid:
        false,

      reason:
        "no_portfolio_candidates",

      totalPendingUsd:
        0,

      recommendedDeployUsd:
        0,

      remainingPendingUsd:
        0,

      executableDecisionCount:
        0,

      waitingDecisionCount:
        0,

      blockedDecisionCount:
        0,

      decisions:
        [],
    };
  }


  const normalizedSymbols =
    input.candidates.map(
      (
        candidate
      ) =>
        candidate.symbol
          .trim()
          .toUpperCase()
    );


  if (
    normalizedSymbols.some(
      (
        symbol
      ) =>
        !symbol
    )
  ) {
    return {
      valid:
        false,

      reason:
        "portfolio_candidate_symbol_missing",

      totalPendingUsd:
        0,

      recommendedDeployUsd:
        0,

      remainingPendingUsd:
        0,

      executableDecisionCount:
        0,

      waitingDecisionCount:
        0,

      blockedDecisionCount:
        0,

      decisions:
        [],
    };
  }


  const uniqueSymbols =
    new Set(
      normalizedSymbols
    );


  if (
    uniqueSymbols.size !==
    normalizedSymbols.length
  ) {
    return {
      valid:
        false,

      reason:
        "duplicate_portfolio_candidate",

      totalPendingUsd:
        0,

      recommendedDeployUsd:
        0,

      remainingPendingUsd:
        0,

      executableDecisionCount:
        0,

      waitingDecisionCount:
        0,

      blockedDecisionCount:
        0,

      decisions:
        [],
    };
  }


  for (
    const candidate
    of input.candidates
  ) {

    if (
      !Number.isFinite(
        candidate.pendingUsd
      ) ||
      candidate.pendingUsd <
        0
    ) {
      return {
        valid:
          false,

        reason:
          "portfolio_pending_usd_invalid",

        totalPendingUsd:
          0,

        recommendedDeployUsd:
          0,

        remainingPendingUsd:
          0,

        executableDecisionCount:
          0,

        waitingDecisionCount:
          0,

        blockedDecisionCount:
          0,

        decisions:
          [],
      };
    }


    if (
      !Number.isFinite(
        candidate.targetPercent
      ) ||
      candidate.targetPercent <=
        0 ||
      candidate.targetPercent >
        100
    ) {
      return {
        valid:
          false,

        reason:
          "portfolio_target_percent_invalid",

        totalPendingUsd:
          0,

        recommendedDeployUsd:
          0,

        remainingPendingUsd:
          0,

        executableDecisionCount:
          0,

        waitingDecisionCount:
          0,

        blockedDecisionCount:
          0,

        decisions:
          [],
      };
    }
  }


  const allocationTotalPercent =
    money(
      input.candidates.reduce(
        (
          total,
          candidate
        ) =>
          total +
          candidate.targetPercent,
        0
      )
    );


  if (
    allocationTotalPercent !==
      100
  ) {
    return {
      valid:
        false,

      reason:
        "portfolio_allocation_not_100",

      totalPendingUsd:
        money(
          input.candidates.reduce(
            (
              total,
              candidate
            ) =>
              total +
              candidate.pendingUsd,
            0
          )
        ),

      recommendedDeployUsd:
        0,

      remainingPendingUsd:
        money(
          input.candidates.reduce(
            (
              total,
              candidate
            ) =>
              total +
              candidate.pendingUsd,
            0
          )
        ),

      executableDecisionCount:
        0,

      waitingDecisionCount:
        0,

      blockedDecisionCount:
        0,

      decisions:
        [],
    };
  }


  const decisions =
    input.candidates.map(
      (
        candidate
      ) =>
        evaluateAtlasMultiAssetEntry({
          symbol:
            candidate.symbol,

          pendingUsd:
            candidate.pendingUsd,

          targetPercent:
            candidate.targetPercent,

          minOrderUsd:
            candidate.minOrderUsd,

          executionEligible:
            candidate.executionEligible,

          waitCycles:
            candidate.waitCycles,

          market:
            candidate.market,
        })
    );


  const totalPendingUsd =
    money(
      input.candidates.reduce(
        (
          total,
          candidate
        ) =>
          total +
          candidate.pendingUsd,
        0
      )
    );


  const recommendedDeployUsd =
    money(
      decisions.reduce(
        (
          total,
          decision
        ) =>
          total +
          decision.recommendedBuyUsd,
        0
      )
    );


  /*
   * Fail closed if intelligence ever attempts to recommend
   * more capital than actually exists in pending state.
   */
  if (
    recommendedDeployUsd >
      totalPendingUsd
  ) {
    return {
      valid:
        false,

      reason:
        "intelligence_overallocated_pending_capital",

      totalPendingUsd,

      recommendedDeployUsd:
        0,

      remainingPendingUsd:
        totalPendingUsd,

      executableDecisionCount:
        0,

      waitingDecisionCount:
        0,

      blockedDecisionCount:
        0,

      decisions:
        [],
    };
  }


  const executableDecisionCount =
    decisions.filter(
      (
        decision
      ) =>
        (
          decision.action ===
            "BUY_NOW" ||
          decision.action ===
            "SCALE_IN"
        ) &&
        decision.recommendedBuyUsd >
          0
    ).length;


  const waitingDecisionCount =
    decisions.filter(
      (
        decision
      ) =>
        decision.action ===
          "WAIT"
    ).length;


  const blockedDecisionCount =
    decisions.filter(
      (
        decision
      ) =>
        decision.action ===
          "BLOCK"
    ).length;


  return {
    valid:
      true,

    reason:
      executableDecisionCount >
        0
        ? "portfolio_intelligence_ready"
        : "portfolio_intelligence_waiting",

    totalPendingUsd,

    recommendedDeployUsd,

    remainingPendingUsd:
      money(
        totalPendingUsd -
        recommendedDeployUsd
      ),

    executableDecisionCount,

    waitingDecisionCount,

    blockedDecisionCount,

    decisions,
  };
}