import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const RECENT_LOG_LIMIT = 25;
const BACKLOG_LIMIT = 25;
const MIN_SIGNAL_AGE_MINUTES = 35;

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

type ExistingOutcome = {
  id: string;
  log_id: string;
  scan_created_at: string | null;
  outcome_5m_bps: number | null;
  outcome_15m_bps: number | null;
  outcome_30m_bps: number | null;
};

type Candle = {
  time: Date;
  close: number;
};

type OutcomePayload = {
  log_id: string;
  scan_created_at: string;
  created_at: string;
  product_id: string;
  regime: string | null;
  structure: string | null;
  volatility_bps: number | null;
  status: string | null;
  note: string | null;
  sample: number | null;
  horizon_minutes: number;
  entry_price: number;
  future_price: number;
  move_bps: number;
  outcome_5m_bps: number;
  outcome_15m_bps: number;
  outcome_30m_bps: number;
};

function isSignalMature(createdAt: string): boolean {
  const signalTime = new Date(createdAt).getTime();

  if (!Number.isFinite(signalTime)) {
    return false;
  }

  const ageMs = Date.now() - signalTime;

  return ageMs >= MIN_SIGNAL_AGE_MINUTES * 60 * 1000;
}

function isComplete(row: ExistingOutcome): boolean {
  return (
    row.outcome_5m_bps != null &&
    row.outcome_15m_bps != null &&
    row.outcome_30m_bps != null
  );
}

async function fetchCandles(
  product: string,
  start: string,
  end: string
): Promise<Candle[]> {
  const url =
    `https://api.exchange.coinbase.com/products/${product}/candles` +
    `?granularity=60&start=${encodeURIComponent(start)}` +
    `&end=${encodeURIComponent(end)}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `Coinbase candles fetch failed: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error(
      `Unexpected candles response: ${JSON.stringify(data)}`
    );
  }

  return data
    .map((c: any) => ({
      time: new Date(Number(c[0]) * 1000),
      close: Number(c[4]),
    }))
    .filter(
      (c: Candle) =>
        Number.isFinite(c.time.getTime()) &&
        Number.isFinite(c.close)
    )
    .sort(
      (a: Candle, b: Candle) =>
        a.time.getTime() - b.time.getTime()
    );
}

async function getRecentLogs(
  limit = RECENT_LOG_LIMIT
): Promise<EdgeHunterLog[]> {
  const cutoff = new Date(
    Date.now() - MIN_SIGNAL_AGE_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("edge_hunter_logs")
    .select(
      "id, created_at, product_id, regime, structure, volatility_bps, status, note, sample"
    )
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []) as EdgeHunterLog[];
}

async function getBacklogOutcomes(
  limit = BACKLOG_LIMIT
): Promise<ExistingOutcome[]> {
  const cutoff = new Date(
    Date.now() - MIN_SIGNAL_AGE_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("edge_outcomes")
    .select(
      "id, log_id, scan_created_at, outcome_5m_bps, outcome_15m_bps, outcome_30m_bps"
    )
    .eq("horizon_minutes", 15)
    .lte("scan_created_at", cutoff)
    .or(
      "outcome_5m_bps.is.null,outcome_15m_bps.is.null,outcome_30m_bps.is.null"
    )
    .order("scan_created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []) as ExistingOutcome[];
}

async function getLogsByIds(
  logIds: string[]
): Promise<Map<string, EdgeHunterLog>> {
  const logMap = new Map<string, EdgeHunterLog>();

  if (logIds.length === 0) {
    return logMap;
  }

  const { data, error } = await supabase
    .from("edge_hunter_logs")
    .select(
      "id, created_at, product_id, regime, structure, volatility_bps, status, note, sample"
    )
    .in("id", logIds);

  if (error) throw error;

  for (const log of (data ?? []) as EdgeHunterLog[]) {
    logMap.set(log.id, log);
  }

  return logMap;
}

async function getExisting15mOutcomes(
  logIds: string[]
): Promise<Map<string, ExistingOutcome[]>> {
  const outcomeMap = new Map<string, ExistingOutcome[]>();

  if (logIds.length === 0) {
    return outcomeMap;
  }

  const { data, error } = await supabase
    .from("edge_outcomes")
    .select(
      "id, log_id, scan_created_at, outcome_5m_bps, outcome_15m_bps, outcome_30m_bps"
    )
    .in("log_id", logIds)
    .eq("horizon_minutes", 15);

  if (error) throw error;

  for (const row of (data ?? []) as ExistingOutcome[]) {
    const rows = outcomeMap.get(row.log_id) ?? [];
    rows.push(row);
    outcomeMap.set(row.log_id, rows);
  }

  return outcomeMap;
}

function getReturnBps(
  candles: Candle[],
  idx: number,
  entryPrice: number
): number | null {
  const candle = candles[idx];

  if (!candle) {
    return null;
  }

  return ((candle.close - entryPrice) / entryPrice) * 10000;
}

async function buildOutcomeRow(
  log: EdgeHunterLog
): Promise<OutcomePayload | null> {
  if (!isSignalMature(log.created_at)) {
    console.log(
      `Skipping ${log.id}: signal is younger than ${MIN_SIGNAL_AGE_MINUTES} minutes.`
    );
    return null;
  }

  const start = new Date(log.created_at);

  if (!Number.isFinite(start.getTime())) {
    console.log(`Skipping ${log.id}: invalid signal timestamp.`);
    return null;
  }

  // Request beyond +30m because the Coinbase end boundary may be
  // exclusive. This gives the +30 minute candle room to appear.
  const end = new Date(
    start.getTime() + 32 * 60 * 1000
  );

  const candles = await fetchCandles(
    log.product_id,
    start.toISOString(),
    end.toISOString()
  );

  if (!candles.length) {
    console.log(`Skipping ${log.id}: no candles returned.`);
    return null;
  }

  const entryPrice = candles[0]?.close;

  if (
    entryPrice == null ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0
  ) {
    console.log(`Skipping ${log.id}: invalid entry price.`);
    return null;
  }

  const outcome5 = getReturnBps(
    candles,
    5,
    entryPrice
  );

  const outcome15 = getReturnBps(
    candles,
    15,
    entryPrice
  );

  const outcome30 = getReturnBps(
    candles,
    30,
    entryPrice
  );

  // Never write partial evidence. The worker will retry later.
  if (
    outcome5 == null ||
    outcome15 == null ||
    outcome30 == null
  ) {
    console.log(
      `Skipping ${log.id}: full 5m/15m/30m evidence is not available.`
    );
    return null;
  }

  const futurePrice = candles[15]?.close;

  if (
    futurePrice == null ||
    !Number.isFinite(futurePrice)
  ) {
    console.log(
      `Skipping ${log.id}: invalid 15m future price.`
    );
    return null;
  }

  const moveBps =
    ((futurePrice - entryPrice) / entryPrice) * 10000;

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

async function insertOutcome(
  row: OutcomePayload
) {
  const { data, error } = await supabase
    .from("edge_outcomes")
    .insert(row)
    .select();

  if (error) throw error;

  return data;
}

async function updateOutcome(
  id: string,
  row: OutcomePayload
) {
  const {
    log_id: _logId,
    created_at: _createdAt,
    ...updatePayload
  } = row;

  const { data, error } = await supabase
    .from("edge_outcomes")
    .update(updatePayload)
    .eq("id", id)
    .eq("horizon_minutes", 15)
    .select();

  if (error) throw error;

  return data;
}

async function processBacklog() {
  console.log("\nHistorical backlog drain starting...");

  const backlogRows =
    await getBacklogOutcomes(BACKLOG_LIMIT);

  console.log(
    `Fetched active 15m backlog rows: ${backlogRows.length}`
  );

  if (backlogRows.length === 0) {
    return {
      repaired: 0,
      skipped: 0,
    };
  }

  const logIds = [
    ...new Set(
      backlogRows
        .map((row) => row.log_id)
        .filter(Boolean)
    ),
  ];

  const logMap = await getLogsByIds(logIds);

  let repaired = 0;
  let skipped = 0;

  for (const outcome of backlogRows) {
    try {
      const log = logMap.get(outcome.log_id);

      if (!log) {
        console.log(
          `Skipping backlog row ${outcome.id}: source log not found.`
        );
        skipped += 1;
        continue;
      }

      console.log("\n---");
      console.log(
        `Repairing backlog row ${outcome.id}`
      );
      console.log(
        `Signal ${log.id} @ ${log.created_at}`
      );

      const row = await buildOutcomeRow(log);

      if (!row) {
        skipped += 1;
        continue;
      }

      const updated = await updateOutcome(
        outcome.id,
        row
      );

      console.log(
        `Repaired backlog outcome ${outcome.id}:`
      );
      console.dir(updated, { depth: null });

      repaired += 1;
    } catch (err) {
      skipped += 1;

      console.error(
        `Failed backlog row ${outcome.id}:`
      );
      console.error(err);
    }
  }

  return {
    repaired,
    skipped,
  };
}

async function processRecent() {
  console.log("\nRecent signal processing starting...");

  const logs = await getRecentLogs(
    RECENT_LOG_LIMIT
  );

  console.log(
    `Fetched mature recent logs: ${logs.length}`
  );

  const existingOutcomes =
    await getExisting15mOutcomes(
      logs.map((log) => log.id)
    );

  let inserted = 0;
  let updated = 0;
  let complete = 0;
  let skipped = 0;

  for (const log of logs) {
    try {
      console.log("\n---");
      console.log(
        `Scoring recent log: ${log.id} @ ${log.created_at}`
      );

      const existingRows =
        existingOutcomes.get(log.id) ?? [];

      if (existingRows.some(isComplete)) {
        console.log(
          `Already complete: ${log.id}`
        );

        complete += 1;
        continue;
      }

      const row = await buildOutcomeRow(log);

      if (!row) {
        skipped += 1;
        continue;
      }

      if (existingRows.length > 0) {
        // Repair only one active 15m row by primary key.
        // Never create another duplicate when one already exists.
        const target = existingRows[0];

        const result = await updateOutcome(
          target.id,
          row
        );

        console.log(
          `Updated recent outcome ${target.id}:`
        );
        console.dir(result, { depth: null });

        updated += 1;
      } else {
        const result = await insertOutcome(row);

        console.log(
          "Inserted new normalized outcome:"
        );
        console.dir(result, { depth: null });

        inserted += 1;
      }
    } catch (err) {
      skipped += 1;

      console.error(
        `Failed recent log ${log.id}:`
      );
      console.error(err);
    }
  }

  return {
    inserted,
    updated,
    complete,
    skipped,
  };
}

async function main() {
  console.log(
    "Edge Outcomes normalized worker starting..."
  );

  console.log(
    `Safety: active horizon=15, backlog limit=${BACKLOG_LIMIT}, recent limit=${RECENT_LOG_LIMIT}, minimum signal age=${MIN_SIGNAL_AGE_MINUTES}m`
  );

  const backlog = await processBacklog();
  const recent = await processRecent();

  console.log("\n================================");
  console.log("Edge Outcomes batch complete.");
  console.log(
    `Backlog repaired: ${backlog.repaired}`
  );
  console.log(
    `Backlog skipped/failed: ${backlog.skipped}`
  );
  console.log(
    `Recent inserted: ${recent.inserted}`
  );
  console.log(
    `Recent updated: ${recent.updated}`
  );
  console.log(
    `Recent already complete: ${recent.complete}`
  );
  console.log(
    `Recent skipped/failed: ${recent.skipped}`
  );
  console.log("================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Script failed:");
    console.error(err);
    process.exit(1);
  });