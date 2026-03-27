import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const HORIZONS = [5, 15, 30] as const;
const MAX_LOGS = 250;
const LOOKBACK_HOURS = 48;

type EdgeHunterLogRow = {
  id: string;
  created_at: string;
  product_id: string;
  status: string | null;
  regime: string | null;
  structure: string | null;
  volatility_bps: number | string | null;
  sample: number | null;
  note: string | null;
};

type EdgeOutcomeRow = {
  log_id: string;
  product_id: string;
  scan_created_at: string;
  horizon_minutes: number;
  entry_price: number;
  future_price: number;
  move_bps: number;
  status: string | null;
  regime: string | null;
  structure: string | null;
  volatility_bps: number | null;
  sample: number | null;
  note: string | null;
};

type CoinbaseCandle = {
  time: number;
  close: number;
};

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorized(req: NextRequest) {
  if (!CRON_SECRET) return true;

  const headerSecret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  const urlSecret = req.nextUrl.searchParams.get("secret") || "";

  return headerSecret === CRON_SECRET || urlSecret === CRON_SECRET;
}

function toIso(date: Date) {
  return date.toISOString();
}

function addMinutes(dateString: string, minutes: number) {
  return new Date(new Date(dateString).getTime() + minutes * 60_000);
}

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60_000);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function calcMoveBps(entryPrice: number, futurePrice: number) {
  return ((futurePrice - entryPrice) / entryPrice) * 10_000;
}

async function fetchNearestClosePrice(
  productId: string,
  targetTime: Date
): Promise<number | null> {
  const start = new Date(targetTime.getTime() - 3 * 60_000);
  const end = new Date(targetTime.getTime() + 3 * 60_000);

  const url = new URL(
    `https://api.exchange.coinbase.com/products/${encodeURIComponent(productId)}/candles`
  );
  url.searchParams.set("granularity", "60");
  url.searchParams.set("start", toIso(start));
  url.searchParams.set("end", toIso(end));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "yieldcraft-edge-hunter-outcomes/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const raw = (await res.json()) as unknown;

  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const candles: CoinbaseCandle[] = raw
    .map((row): CoinbaseCandle | null => {
      if (!Array.isArray(row) || row.length < 5) return null;

      const time = Number(row[0]);
      const close = Number(row[4]);

      if (!Number.isFinite(time) || !Number.isFinite(close)) return null;

      return { time, close };
    })
    .filter((row): row is CoinbaseCandle => row !== null);

  if (!candles.length) {
    return null;
  }

  const targetUnix = Math.floor(targetTime.getTime() / 1000);

  candles.sort(
    (a, b) => Math.abs(a.time - targetUnix) - Math.abs(b.time - targetUnix)
  );

  return candles[0]?.close ?? null;
}

export async function GET(req: NextRequest) {
  return runOutcomeLogger(req);
}

export async function POST(req: NextRequest) {
  return runOutcomeLogger(req);
}

async function runOutcomeLogger(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const cutoff = subtractHours(now, LOOKBACK_HOURS).toISOString();

    const { data: logs, error: logsError } = await supabase
      .from("edge_hunter_logs")
      .select(
        "id, created_at, product_id, status, regime, structure, volatility_bps, sample, note"
      )
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(MAX_LOGS);

    if (logsError) {
      throw new Error(`Failed to read edge_hunter_logs: ${logsError.message}`);
    }

    const typedLogs = (logs ?? []) as EdgeHunterLogRow[];

    if (!typedLogs.length) {
      return NextResponse.json({
        ok: true,
        scanned_logs: 0,
        inserted: 0,
        pending: 0,
        skipped_existing: 0,
        skipped_missing_prices: 0,
      });
    }

    const logIds = typedLogs.map((row) => row.id);

    const { data: existingOutcomes, error: existingError } = await supabase
      .from("edge_outcomes")
      .select("log_id, horizon_minutes")
      .in("log_id", logIds);

    if (existingError) {
      throw new Error(`Failed to read edge_outcomes: ${existingError.message}`);
    }

    const existingSet = new Set(
      (existingOutcomes ?? []).map(
        (row: { log_id: string; horizon_minutes: number }) =>
          `${row.log_id}:${row.horizon_minutes}`
      )
    );

    const rowsToInsert: EdgeOutcomeRow[] = [];
    let pending = 0;
    let skippedExisting = 0;
    let skippedMissingPrices = 0;

    for (const log of typedLogs) {
      const scanTime = new Date(log.created_at);
      if (Number.isNaN(scanTime.getTime())) continue;

      for (const horizon of HORIZONS) {
        const existingKey = `${log.id}:${horizon}`;
        if (existingSet.has(existingKey)) {
          skippedExisting += 1;
          continue;
        }

        const futureTime = addMinutes(log.created_at, horizon);

        if (futureTime.getTime() > now.getTime()) {
          pending += 1;
          continue;
        }

        const entryPrice = await fetchNearestClosePrice(log.product_id, scanTime);
        const futurePrice = await fetchNearestClosePrice(log.product_id, futureTime);

        if (!entryPrice || !futurePrice) {
          skippedMissingPrices += 1;
          continue;
        }

        rowsToInsert.push({
          log_id: log.id,
          product_id: log.product_id,
          scan_created_at: log.created_at,
          horizon_minutes: horizon,
          entry_price: entryPrice,
          future_price: futurePrice,
          move_bps: calcMoveBps(entryPrice, futurePrice),
          status: log.status,
          regime: log.regime,
          structure: log.structure,
          volatility_bps: toNumber(log.volatility_bps),
          sample: log.sample ?? null,
          note: log.note,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("edge_outcomes")
        .insert(rowsToInsert);

      if (insertError) {
        throw new Error(`Failed to insert edge_outcomes: ${insertError.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      scanned_logs: typedLogs.length,
      inserted: rowsToInsert.length,
      pending,
      skipped_existing: skippedExisting,
      skipped_missing_prices: skippedMissingPrices,
      horizons: HORIZONS,
      lookback_hours: LOOKBACK_HOURS,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in outcome logger.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}