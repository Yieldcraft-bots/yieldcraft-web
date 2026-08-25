/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Entry Intelligence V1
 * ------------------------------------------------------------
 * PURPOSE
 * Produce a disciplined BUY-only accumulation decision for one
 * Atlas Multi-Asset pending asset bucket.
 *
 * CORE PHILOSOPHY
 * - Client capital is intended to be invested.
 * - Intelligence improves entry timing and staging.
 * - Intelligence must not become permanently paralyzed waiting
 *   for a perfect entry.
 * - Pending capital is reevaluated every cycle.
 * - Atlas NEVER creates a SELL decision.
 *
 * SAFETY
 * - Multi-Asset only
 * - Pure calculation
 * - No Coinbase
 * - No Supabase
 * - No database
 * - No credentials
 * - No order submission
 * - No legacy Atlas
 * - No Pulse
 * - No Recon
 * - No telemetry mutation
 * ============================================================
 */


export type AtlasMultiAssetEntryAction =
  | "BUY_NOW"
  | "SCALE_IN"
  | "WAIT"
  | "BLOCK";


export type AtlasMarketRegime =
  | "STRONG_BULL"
  | "BULL"
  | "NEUTRAL"
  | "BEAR"
  | "STRONG_BEAR";


export interface AtlasMultiAssetMarketSnapshot {
  /**
   * Overall market/regime classification for this asset.
   */
  regime:
    AtlasMarketRegime;

  /**
   * -1 = strongly bearish trend
   *  0 = neutral
   * +1 = strongly bullish trend
   */
  trendScore:
    number;

  /**
   * -1 = strongly negative momentum
   *  0 = neutral
   * +1 = strongly positive momentum
   */
  momentumScore:
    number;

  /**
   * 0 = poor/extended entry
   * 1 = excellent pullback/value entry
   */
  pullbackQuality:
    number;

  /**
   * 0 = very stable
   * 1 = extremely volatile
   */
  volatilityScore:
    number;

  /**
   * -1 = materially underperforming peers/benchmark
   *  0 = neutral
   * +1 = materially outperforming
   */
  relativeStrengthScore:
    number;

  /**
   * Whether the relevant market/product is presently tradable.
   */
  marketOpen:
    boolean;

  /**
   * Whether the observation is sufficiently current to use.
   */
  dataFresh:
    boolean;
}


export interface AtlasMultiAssetEntryInput {
  symbol:
    string;

  /**
   * Dollars currently committed to this asset but not yet filled.
   */
  pendingUsd:
    number;

  /**
   * Client's authoritative target allocation percentage.
   */
  targetPercent:
    number;

  /**
   * Current execution minimum for this asset/order path.
   */
  minOrderUsd:
    number;

  /**
   * Whether downstream product/broker capability is executable.
   *
   * Intelligence does not decide this itself.
   */
  executionEligible:
    boolean;

  /**
   * Number of consecutive evaluation cycles this capital has
   * remained pending without successful execution.
   *
   * Used to prevent endless WAIT decisions.
   */
  waitCycles:
    number;

  market:
    AtlasMultiAssetMarketSnapshot;
}


export interface AtlasMultiAssetEntryDecision {
  symbol:
    string;

  action:
    AtlasMultiAssetEntryAction;

  /**
   * 0-100 composite entry score.
   */
  score:
    number;

  /**
   * Fraction of current pending dollars that intelligence
   * recommends deploying this cycle.
   *
   * 0   = deploy nothing
   * 0.5 = staged entry
   * 1   = deploy full currently executable pending bucket
   */
  deploymentFraction:
    number;

  recommendedBuyUsd:
    number;

  urgencyScore:
    number;

  reason:
    string;

  components: {
    regime:
      number;

    trend:
      number;

    momentum:
      number;

    pullback:
      number;

    volatility:
      number;

    relativeStrength:
      number;

    urgency:
      number;
  };
}


function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}


function money(
  value: number
): number {
  return Number(
    value.toFixed(2)
  );
}


function normalizeSigned(
  value: number
): number {
  return clamp(
    value,
    -1,
    1
  );
}


function normalizeUnit(
  value: number
): number {
  return clamp(
    value,
    0,
    1
  );
}


function regimePoints(
  regime: AtlasMarketRegime
): number {
  switch (regime) {
    case "STRONG_BULL":
      return 15;

    case "BULL":
      return 10;

    case "NEUTRAL":
      return 5;

    case "BEAR":
      return -5;

    case "STRONG_BEAR":
      return -12;

    default:
      return 0;
  }
}


/**
 * Waiting urgency increases gradually.
 *
 * The purpose is NOT to force a reckless trade.
 *
 * It prevents capital from repeatedly receiving WAIT simply
 * because a merely-good entry never becomes a perfect entry.
 */
function calculateUrgency(
  waitCycles: number
): number {
  const normalizedCycles =
    Math.max(
      0,
      Math.floor(
        waitCycles
      )
    );

  return clamp(
    normalizedCycles * 3,
    0,
    20
  );
}


export function evaluateAtlasMultiAssetEntry(
  input: AtlasMultiAssetEntryInput
): AtlasMultiAssetEntryDecision {
  const symbol =
    input.symbol
      .trim()
      .toUpperCase();

  const pendingUsd =
    money(
      input.pendingUsd
    );

  const minOrderUsd =
    money(
      input.minOrderUsd
    );

  /*
   * ==========================================================
   * HARD SAFETY / EXECUTION CONDITIONS
   * ==========================================================
   */

  if (!symbol) {
    return {
      symbol:
        "",

      action:
        "BLOCK",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        0,

      reason:
        "Asset symbol is missing.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency: 0,
      },
    };
  }


  if (
    !Number.isFinite(
      pendingUsd
    ) ||
    pendingUsd <=
      0
  ) {
    return {
      symbol,

      action:
        "WAIT",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        0,

      reason:
        "No pending capital is available for this asset.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency: 0,
      },
    };
  }


  if (
    !input.executionEligible
  ) {
    return {
      symbol,

      action:
        "BLOCK",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        0,

      reason:
        "Asset is not currently eligible for production execution.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency: 0,
      },
    };
  }


  if (
    !Number.isFinite(
      minOrderUsd
    ) ||
    minOrderUsd <=
      0
  ) {
    return {
      symbol,

      action:
        "BLOCK",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        0,

      reason:
        "Execution minimum is invalid.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency: 0,
      },
    };
  }


  if (
    pendingUsd <
      minOrderUsd
  ) {
    return {
      symbol,

      action:
        "WAIT",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        calculateUrgency(
          input.waitCycles
        ),

      reason:
        "Pending capital remains assigned but is below the execution minimum.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency:
          calculateUrgency(
            input.waitCycles
          ),
      },
    };
  }


  if (
    !input.market.dataFresh
  ) {
    return {
      symbol,

      action:
        "WAIT",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        calculateUrgency(
          input.waitCycles
        ),

      reason:
        "Market data is stale; pending capital remains assigned for reevaluation.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency:
          calculateUrgency(
            input.waitCycles
          ),
      },
    };
  }


  if (
    !input.market.marketOpen
  ) {
    return {
      symbol,

      action:
        "WAIT",

      score:
        0,

      deploymentFraction:
        0,

      recommendedBuyUsd:
        0,

      urgencyScore:
        calculateUrgency(
          input.waitCycles
        ),

      reason:
        "Market is not currently executable; pending capital remains assigned.",

      components: {
        regime: 0,
        trend: 0,
        momentum: 0,
        pullback: 0,
        volatility: 0,
        relativeStrength: 0,
        urgency:
          calculateUrgency(
            input.waitCycles
          ),
      },
    };
  }


  /*
   * ==========================================================
   * ENTRY SCORE
   * ==========================================================
   *
   * V1 deliberately uses transparent factors.
   *
   * Future versions can improve or replace individual factors
   * without changing the execution/governance architecture.
   */

  const regime =
    regimePoints(
      input.market.regime
    );

  const trend =
    normalizeSigned(
      input.market.trendScore
    ) *
    20;

  const momentum =
    normalizeSigned(
      input.market.momentumScore
    ) *
    15;

  const pullback =
    normalizeUnit(
      input.market.pullbackQuality
    ) *
    20;

  /*
   * Lower volatility receives less penalty.
   *
   * Very high volatility subtracts up to 15 points.
   */
  const volatility =
    -(
      normalizeUnit(
        input.market.volatilityScore
      ) *
      15
    );

  const relativeStrength =
    normalizeSigned(
      input.market.relativeStrengthScore
    ) *
    15;

  const urgency =
    calculateUrgency(
      input.waitCycles
    );


  /*
   * Neutral starting point = 50.
   *
   * Favorable factors raise the score.
   * Unfavorable factors lower it.
   * Waiting urgency progressively raises willingness to deploy.
   */
  const rawScore =
    50 +
    regime +
    trend +
    momentum +
    pullback +
    volatility +
    relativeStrength +
    urgency;


  const score =
    Math.round(
      clamp(
        rawScore,
        0,
        100
      )
    );


  /*
   * ==========================================================
   * ACTION POLICY
   * ==========================================================
   *
   * Strong entry:
   *   deploy all currently approved pending capital.
   *
   * Good/acceptable entry:
   *   stage capital rather than waiting for perfection.
   *
   * Weak entry:
   *   wait briefly and reevaluate.
   *
   * Persistent waiting:
   *   urgency progressively moves acceptable opportunities
   *   toward deployment.
   */

  let action:
    AtlasMultiAssetEntryAction;

  let deploymentFraction:
    number;

  let reason:
    string;


  if (
    score >=
      80
  ) {
    action =
      "BUY_NOW";

    deploymentFraction =
      1;

    reason =
      "Strong entry quality; deploy the currently executable pending allocation.";
  } else if (
    score >=
      60
  ) {
    action =
      "SCALE_IN";

    deploymentFraction =
      0.5;

    reason =
      "Constructive entry quality; stage capital into the position.";
  } else if (
    urgency >=
      15 &&
    score >=
      45
  ) {
    action =
      "SCALE_IN";

    deploymentFraction =
      0.35;

    reason =
      "Entry is acceptable and capital has waited multiple cycles; begin disciplined accumulation.";
  } else {
    action =
      "WAIT";

    deploymentFraction =
      0;

    reason =
      "Entry quality is currently weak; preserve assigned capital and reevaluate next cycle.";
  }


  const recommendedBuyUsd =
    action ===
      "BUY_NOW" ||
    action ===
      "SCALE_IN"
      ? money(
          Math.max(
            minOrderUsd,
            pendingUsd *
              deploymentFraction
          )
        )
      : 0;


  /*
   * Never recommend more than is actually pending.
   */
  const boundedBuyUsd =
    money(
      Math.min(
        recommendedBuyUsd,
        pendingUsd
      )
    );


  return {
    symbol,

    action,

    score,

    deploymentFraction,

    recommendedBuyUsd:
      boundedBuyUsd,

    urgencyScore:
      urgency,

    reason,

    components: {
      regime:
        regime,

      trend:
        Number(
          trend.toFixed(
            2
          )
        ),

      momentum:
        Number(
          momentum.toFixed(
            2
          )
        ),

      pullback:
        Number(
          pullback.toFixed(
            2
          )
        ),

      volatility:
        Number(
          volatility.toFixed(
            2
          )
        ),

      relativeStrength:
        Number(
          relativeStrength.toFixed(
            2
          )
        ),

      urgency:
        urgency,
    },
  };
}