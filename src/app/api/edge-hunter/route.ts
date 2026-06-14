import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runRangeBounceTest } from "@/lib/edge/rangeBounceTest";

type Candle = {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
};

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pctMoveBps(from: number, to: number) {
  if (!Number.isFinite(from) || from <= 0) return 0;
  return ((to - from) / from) * 10000;
}

function calcVolatilityBps(prices: number[]) {
  if (prices.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const avg = average(returns);
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;

  return Math.sqrt(variance) * 10000;
}

function detectRegime(prices: number[]) {
  if (prices.length < 30) return "UNKNOWN";

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];

  const fullMoveBps = pctMoveBps(firstPrice, lastPrice);
  const volatilityBps = calcVolatilityBps(prices);

  const highs = Math.max(...prices);
  const lows = Math.min(...prices);
  const mid = (highs + lows) / 2;
  const rangeWidthBps = mid > 0 ? ((highs - lows) / mid) * 10000 : 0;

  const lastReturnBps = pctMoveBps(
    prices[prices.length - 2],
    prices[prices.length - 1]
  );

  if (Math.abs(lastReturnBps) >= 35 || volatilityBps >= 80) {
    return "LIQUIDITY_SHOCK";
  }

  if (volatilityBps >= 40) {
    return "HIGH_VOLATILITY";
  }

  if (rangeWidthBps >= 45 && Math.abs(fullMoveBps) >= 25) {
    return "BREAKOUT";
  }

  if (fullMoveBps >= 20) {
    return "TRENDING_UP";
  }

  if (fullMoveBps <= -20) {
    return "TRENDING_DOWN";
  }

  if (volatilityBps < 20) {
    return "RANGING";
  }

  return "NORMAL";
}

function detectStructure(prices: number[]) {
  if (prices.length < 30) return "unknown";

  const first = prices.slice(0, Math.floor(prices.length / 2));
  const second = prices.slice(Math.floor(prices.length / 2));

  const firstRange = Math.max(...first) - Math.min(...first);
  const secondRange = Math.max(...second) - Math.min(...second);

  if (secondRange > firstRange * 1.2) return "expanding";
  if (secondRange < firstRange * 0.8) return "compressing";
  return "stable";
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function logEdgeHunterScan(payload: {
  product_id: string;
  status: string;
  regime: string;
  structure: string;
  volatility_bps: number;
  sample: number;
  note: string;
}) {
  try {
    const supabase = getAdminClient();

    await supabase.from("edge_hunter_logs").insert([
      {
        product_id: payload.product_id,
        status: payload.status,
        regime: payload.regime,
        structure: payload.structure,
        volatility_bps: payload.volatility_bps,
        sample: payload.sample,
        note: payload.note,
      },
    ]);
  } catch (err) {
    console.error("edge_hunter_log_failed", err);
  }
}

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 60 * 100;
    const end = now;

    const url =
      `https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles` +
      `?start=${start}&end=${end}&granularity=ONE_MINUTE`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });

    const text = await res.text();
    const data = JSON.parse(text) as { candles?: Candle[] };

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `coinbase_http_${res.status}`,
        details: data,
      });
    }

    if (!data.candles || !Array.isArray(data.candles) || !data.candles.length) {
      return NextResponse.json({
        ok: false,
        error: "no_candles",
      });
    }

    const candles = [...data.candles].sort(
      (a, b) => Number(a.start) - Number(b.start)
    );

    const prices = candles
      .map((c) => Number(c.close))
      .filter((n) => Number.isFinite(n));

    const rangeTest = runRangeBounceTest(prices);

    if (prices.length < 20) {
      return NextResponse.json({
        ok: false,
        error: "not_enough_price_data",
        sample: prices.length,
      });
    }

    const regime = detectRegime(prices);
    const structure = detectStructure(prices);

    const volatility_bps =
      Math.round(calcVolatilityBps(prices) * 100) / 100;

    let status: "favorable" | "neutral" | "avoid" = "neutral";
    let note = "Mixed conditions. Stay selective.";

    if (regime === "RANGING" && structure !== "expanding") {
      status = "avoid";
      note = "Low-volatility chop. Historically poor edge environment.";
    } else if (regime === "TRENDING_UP" && structure === "expanding") {
      status = "favorable";
      note = "Upside trend expansion detected. Offensive telemetry only.";
    } else if (regime === "TRENDING_DOWN") {
      status = "avoid";
      note = "Downside trend detected. Defensive telemetry only.";
    } else if (regime === "HIGH_VOLATILITY") {
      status = "avoid";
      note = "High volatility detected. Risk telemetry only.";
    } else if (regime === "BREAKOUT" && structure === "expanding") {
      status = "favorable";
      note = "Breakout expansion detected. Offensive telemetry only.";
    } else if (regime === "LIQUIDITY_SHOCK") {
      status = "avoid";
      note = "Liquidity shock detected. Protective telemetry only.";
    } else if (regime === "NORMAL" && structure === "stable") {
      status = "neutral";
      note = "Moderate conditions. Selective entries only.";
    } else if (structure === "compressing") {
      status = "avoid";
      note = "Compression detected. Wait for clearer expansion.";
    }

    const responsePayload = {
      ok: true,
      product_id: "BTC-USD",
      status,
      regime,
      structure,
      volatility_bps,
      sample: prices.length,
      note,
      range_test: rangeTest,
    };

    await logEdgeHunterScan({
      product_id: responsePayload.product_id,
      status: responsePayload.status,
      regime: responsePayload.regime,
      structure: responsePayload.structure,
      volatility_bps: responsePayload.volatility_bps,
      sample: responsePayload.sample,
      note:
        responsePayload.note +
        " | classifier=edge_hunter_v2" +
        (responsePayload.range_test?.signal
          ? ` | range_signal=${responsePayload.range_test.signal}`
          : ""),
    });

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
}