import { NextResponse } from "next/server";

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

function detectRegime(prices: number[]) {
  if (prices.length < 20) return "UNKNOWN";

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const avg = average(returns);
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;

  const volatilityBps = Math.sqrt(variance) * 10000;

  if (volatilityBps < 20) return "RANGING";
  if (volatilityBps < 60) return "NORMAL";
  return "VOLATILE";
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

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 60 * 100; // last 100 minutes
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

    if (prices.length < 20) {
      return NextResponse.json({
        ok: false,
        error: "not_enough_price_data",
        sample: prices.length,
      });
    }

    const regime = detectRegime(prices);
    const structure = detectStructure(prices);

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const avg = average(returns);
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    const volatility_bps = Math.round(Math.sqrt(variance) * 10000 * 100) / 100;

    let status: "favorable" | "neutral" | "avoid" = "neutral";
    let note = "Mixed conditions. Stay selective.";

    if (regime === "RANGING" && structure !== "expanding") {
      status = "avoid";
      note = "Low-volatility chop. Historically poor edge environment.";
    } else if (regime === "VOLATILE" && structure === "expanding") {
      status = "favorable";
      note = "Expansion with movement. Better environment for edge discovery.";
    } else if (regime === "NORMAL" && structure === "stable") {
      status = "neutral";
      note = "Moderate conditions. Selective entries only.";
    } else if (structure === "compressing") {
      status = "avoid";
      note = "Compression detected. Wait for clearer expansion.";
    }

    return NextResponse.json({
      ok: true,
      product_id: "BTC-USD",
      status,
      regime,
      structure,
      volatility_bps,
      sample: prices.length,
      note,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
}