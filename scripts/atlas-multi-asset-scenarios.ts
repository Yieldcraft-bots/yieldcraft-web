/**
 * ============================================================
 * YieldCraft Atlas
 * Multi-Asset Launch Scenario Test
 * ------------------------------------------------------------
 * PURPOSE
 * Validate Atlas portfolio planning before controlled launch.
 *
 * TESTS
 * 1. BTC 100% using USD
 * 2. BTC 70% / ETH 30% using USD
 * 3. BTC 70% / ETH 30% using USDC
 * 4. Invalid BTC 80% / ETH 40% must reject
 *
 * SAFETY
 * - Pure planning only
 * - No trading
 * - No order submission
 * - No Coinbase calls
 * - No Supabase
 * - No Pulse
 * - No Recon
 * - No database
 * - No API routes
 * ============================================================
 */

import {
  buildPortfolioExecutionPlan,
  type PortfolioExecutionPlan,
} from "../src/lib/portfolio-execution-planner";

function requireCondition(
  condition: boolean,
  message: string
): void {
  if (!condition) {
    throw new Error(message);
  }
}

function getOrder(
  plan: PortfolioExecutionPlan,
  symbol: string
) {
  const order = plan.orders.find(
    (item) => item.symbol === symbol
  );

  if (!order) {
    throw new Error(
      `Expected ${symbol} order was not created.`
    );
  }

  return order;
}

function testBtcOnlyUsd(): void {
  const plan = buildPortfolioExecutionPlan({
    allocations: [
      {
        symbol: "BTC",
        targetPercent: 100,
      },
    ],
    deployableUsd: 1000,
    fundingCurrency: "USD",
    minOrderUsd: 1,
  });

  requireCondition(
    plan.valid,
    `BTC-only plan should be valid. Reason: ${plan.reason}`
  );

  requireCondition(
    plan.allocationTotalPercent === 100,
    "BTC-only allocation should total 100%."
  );

  requireCondition(
    plan.plannedUsd === 1000,
    `BTC-only planned USD should equal 1000. Received ${plan.plannedUsd}.`
  );

  requireCondition(
    plan.unplannedUsd === 0,
    `BTC-only plan should leave $0 unplanned. Received ${plan.unplannedUsd}.`
  );

  const btc = getOrder(plan, "BTC");

  requireCondition(
    btc.executable,
    `BTC order should be executable. Reason: ${btc.reason}`
  );

  requireCondition(
    btc.proposedBuyUsd === 1000,
    `BTC proposed buy should equal $1000. Received ${btc.proposedBuyUsd}.`
  );

  requireCondition(
    btc.productId === "BTC-USD",
    `Expected BTC-USD. Received ${btc.productId}.`
  );

  console.log(
    "1. BTC 100% / USD funding: PASS"
  );
}

function testBtcEthUsd(): void {
  const plan = buildPortfolioExecutionPlan({
    allocations: [
      {
        symbol: "BTC",
        targetPercent: 70,
      },
      {
        symbol: "ETH",
        targetPercent: 30,
      },
    ],
    deployableUsd: 1000,
    fundingCurrency: "USD",
    minOrderUsd: 1,
  });

  requireCondition(
    plan.valid,
    `BTC/ETH plan should be valid. Reason: ${plan.reason}`
  );

  requireCondition(
    plan.allocationTotalPercent === 100,
    "BTC/ETH allocation should total 100%."
  );

  requireCondition(
    plan.plannedUsd === 1000,
    `BTC/ETH planned USD should equal 1000. Received ${plan.plannedUsd}.`
  );

  requireCondition(
    plan.unplannedUsd === 0,
    `BTC/ETH plan should leave $0 unplanned. Received ${plan.unplannedUsd}.`
  );

  const btc = getOrder(plan, "BTC");
  const eth = getOrder(plan, "ETH");

  requireCondition(
    btc.executable,
    `BTC order should be executable. Reason: ${btc.reason}`
  );

  requireCondition(
    eth.executable,
    `ETH order should be executable. Reason: ${eth.reason}`
  );

  requireCondition(
    btc.proposedBuyUsd === 700,
    `BTC proposed buy should equal $700. Received ${btc.proposedBuyUsd}.`
  );

  requireCondition(
    eth.proposedBuyUsd === 300,
    `ETH proposed buy should equal $300. Received ${eth.proposedBuyUsd}.`
  );

  requireCondition(
    btc.productId === "BTC-USD",
    `Expected BTC-USD. Received ${btc.productId}.`
  );

  requireCondition(
    eth.productId === "ETH-USD",
    `Expected ETH-USD. Received ${eth.productId}.`
  );

  console.log(
    "2. BTC 70% / ETH 30% / USD funding: PASS"
  );
}

function testBtcEthUsdc(): void {
  const plan = buildPortfolioExecutionPlan({
    allocations: [
      {
        symbol: "BTC",
        targetPercent: 70,
      },
      {
        symbol: "ETH",
        targetPercent: 30,
      },
    ],
    deployableUsd: 1000,
    fundingCurrency: "USDC",
    minOrderUsd: 1,
  });

  requireCondition(
    plan.valid,
    `BTC/ETH USDC plan should be valid. Reason: ${plan.reason}`
  );

  requireCondition(
    plan.plannedUsd === 1000,
    `USDC-funded plan should allocate the full $1000. Received ${plan.plannedUsd}.`
  );

  requireCondition(
    plan.unplannedUsd === 0,
    `USDC-funded plan should leave $0 unplanned. Received ${plan.unplannedUsd}.`
  );

  const btc = getOrder(plan, "BTC");
  const eth = getOrder(plan, "ETH");

  requireCondition(
    btc.productId === "BTC-USDC",
    `Expected BTC-USDC. Received ${btc.productId}.`
  );

  requireCondition(
    eth.productId === "ETH-USDC",
    `Expected ETH-USDC. Received ${eth.productId}.`
  );

  requireCondition(
    btc.proposedBuyUsd === 700,
    `BTC proposed buy should equal $700. Received ${btc.proposedBuyUsd}.`
  );

  requireCondition(
    eth.proposedBuyUsd === 300,
    `ETH proposed buy should equal $300. Received ${eth.proposedBuyUsd}.`
  );

  console.log(
    "3. BTC 70% / ETH 30% / USDC funding: PASS"
  );
}

function testOverAllocationRejected(): void {
  const plan = buildPortfolioExecutionPlan({
    allocations: [
      {
        symbol: "BTC",
        targetPercent: 80,
      },
      {
        symbol: "ETH",
        targetPercent: 40,
      },
    ],
    deployableUsd: 1000,
    fundingCurrency: "USD",
    minOrderUsd: 1,
  });

  requireCondition(
    !plan.valid,
    "120% allocation must be rejected."
  );

  requireCondition(
    plan.reason === "allocation_total_not_100",
    `Expected allocation_total_not_100. Received ${plan.reason}.`
  );

  requireCondition(
    plan.allocationTotalPercent === 120,
    `Expected rejected total of 120%. Received ${plan.allocationTotalPercent}%.`
  );

  requireCondition(
    plan.plannedUsd === 0,
    "Rejected plan must not create planned purchases."
  );

  requireCondition(
    plan.orders.length === 0,
    "Rejected plan must not create execution-plan orders."
  );

  console.log(
    "4. BTC 80% / ETH 40% rejection: PASS"
  );
}

function main(): void {
  console.log("ATLAS_MULTI_ASSET_SCENARIOS");
  console.log("--------------------------------");

  testBtcOnlyUsd();
  testBtcEthUsd();
  testBtcEthUsdc();
  testOverAllocationRejected();

  console.log("--------------------------------");
  console.log(
    "RESULT: PASS — Atlas multi-asset planning scenarios are healthy."
  );
}

try {
  main();
} catch (error) {
  console.error("--------------------------------");
  console.error("RESULT: FAIL");
  console.error(error);
  process.exitCode = 1;
}