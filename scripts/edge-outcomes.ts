import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type EdgeHunterLog = {
  id: string;
  created_at: string;
  product_id: string;
  regime: string | null;
  structure: string | null;
  volatility_bps: number | null;
  status: string | null;
  note: string | null;
  sample: number | null;
};

type Candle = {
  time: Date;
  close: number;
};

async function fetchCandles(
  product: string,
  start: string,
  end: string
): Promise<Candle[]> {
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=60&start=${start}&end=${end}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Coinbase candles fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error(`Unexpected candles response: ${JSON.stringify(data)}`);
  }

  return data
    .map((c: any) => ({
      time: new Date(c[0] * 1000),
      close: Number(c[4]),
    }))
    .sort((a: Candle, b: Candle) => a.time.getTime() - b.time.getTime());
}

async function getRecentLogs(limit = 25): Promise<EdgeHunterLog[]> {
  const { data, error } = await supabase
    .from("edge_hunter_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []) as EdgeHunterLog[];
}

async function getExistingOutcomeLogIds(logIds: string[]): Promise<Set<string>> {
  if (logIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("edge_outcomes")
    .select("log_id")
    .in("log_id", logIds);

  if (error) throw error;

  return new Set((data ?? []).map((row: any) => row.log_id));
}

function getReturnBps(candles: Candle[], idx: number, entryPrice: number): number | null {
  const candle = candles[idx];
  if (!candle) return null;
  return ((candle.close - entryPrice) / entryPrice) * 10000;
}

async function buildOutcomeRow(log: EdgeHunterLog) {
  const start = new Date(log.created_at);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const candles = await fetchCandles(
    log.product_id,
    start.toISOString(),
    end.toISOString()
  );

  if (!candles.length) {
    console.log(`Skipping ${log.id}: no candles returned.`);
    return null;
  }

  const entryPrice = candles[0].close;

  const outcome5 = getReturnBps(candles, 5, entryPrice);
  const outcome15 = getReturnBps(candles, 15, entryPrice);
  const outcome30 = getReturnBps(candles, 30, entryPrice);

  const futurePrice =
    candles[15]?.close ?? candles[candles.length - 1]?.close ?? entryPrice;

  const moveBps =
    futurePrice != null
      ? ((futurePrice - entryPrice) / entryPrice) * 10000
      : null;

  return {
    log_id: log.id,
    scan_created_at: log.created_at,
    created_at: new Date().toISOString(),
    product_id: log.product_id,
    regime: log.regime,
    structure: log.structure,
    volatility_bps: log.volatility_bps,
    status: log.status,
    note: log.note,
    sample: log.sample,
    horizon_minutes: 15,
    entry_price: entryPrice,
    future_price: futurePrice,
    move_bps: moveBps,
    outcome_5m_bps: outcome5,
    outcome_15m_bps: outcome15,
    outcome_30m_bps: outcome30,
  };
}

async function insertOutcome(row: any) {
  const { data, error } = await supabase
    .from("edge_outcomes")
    .insert(row)
    .select();

  if (error) throw error;

  return data;
}

async function main() {
  console.log("Edge Outcomes batch starting...");

  const logs = await getRecentLogs(25);
  console.log(`Fetched recent logs: ${logs.length}`);

  const existingLogIds = await getExistingOutcomeLogIds(logs.map((l) => l.id));
  console.log(`Already processed logs: ${existingLogIds.size}`);

  const unprocessedLogs = logs.filter((log) => !existingLogIds.has(log.id));
  console.log(`Unprocessed logs to score: ${unprocessedLogs.length}`);

  if (unprocessedLogs.length === 0) {
    console.log("Nothing new to process.");
    return;
  }

  let insertedCount = 0;
  let skippedCount = 0;

  for (const log of unprocessedLogs) {
    try {
      console.log("\n---");
      console.log(`Scoring log: ${log.id} @ ${log.created_at}`);

      const row = await buildOutcomeRow(log);

      if (!row) {
        skippedCount += 1;
        continue;
      }

      console.log("Insert payload:");
      console.dir(row, { depth: null });

      const inserted = await insertOutcome(row);

      console.log("Inserted row:");
      console.dir(inserted, { depth: null });

      insertedCount += 1;
    } catch (err) {
      skippedCount += 1;
      console.error(`Failed scoring log ${log.id}:`);
      console.error(err);
    }
  }

  console.log("\nBatch complete.");
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Skipped/failed: ${skippedCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Script failed:");
    console.error(err);
    process.exit(1);
  });