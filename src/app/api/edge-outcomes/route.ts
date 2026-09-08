import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKAHEAD_WINDOWS = [5, 15, 30] as const;

const SCAN_PAGE_SIZE = 100;
const MAX_LOGS_SCANNED_PER_RUN = 3000;
const PROCESS_LOG_LIMIT = 40;
const COINBASE_CONCURRENCY = 1;

type HunterLog = {
  id: string;
  created_at: string;
  note: string | null;
  regime: string | null;
  structure: string | null;
  volatility_bps: number | null;
};

type ExistingOutcome = {
  log_id: string | null;
  minutes: number | null;
};

type CoinbaseCandle = {
  start?: string;
  low?: string;
  high?: string;
  open?: string;
  close?: string;
  volume?: string;
};

type LogWorkItem = HunterLog & {
  range_signal: string;
  missing_windows: number[];
};

type ProcessResult = {
  rows: Record<string, unknown>[];
  fetchFailed: boolean;
};

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function extractRangeSignal(note: string | null | undefined) {
  if (!note) return null;

  const match = note.match(/range_signal=([A-Z_]+)/);

  return match?.[1] || null;
}

function outcomeKey(logId: string, minutes: number) {
  return `${logId}:${minutes}`;
}

function candleCloseAtOrAfter(
  candles: CoinbaseCandle[],
  timestampSeconds: number
) {
  const candle = candles
    .filter((item) => Number(item.start) >= timestampSeconds)
    .sort((a, b) => Number(a.start) - Number(b.start))[0];

  if (!candle) return null;

  const close = Number(candle.close);

  if (!Number.isFinite(close) || close <= 0) {
    return null;
  }

  return close;
}

async function fetchCandlesForLog(log: HunterLog) {
  const entryTs = new Date(log.created_at);

  if (!Number.isFinite(entryTs.getTime())) {
    return null;
  }

  const entryStart = Math.floor(entryTs.getTime() / 1000);

  /*
   * One request gives us enough one-minute candles for:
   * entry + 5m + 15m + 30m outcomes.
   *
   * This replaces the old pattern of:
   * 1 entry request + 3 future requests per Hunter log.
   */
  const rangeEnd = entryStart + 31 * 60;

  const url =
    "https://api.coinbase.com/api/v3/brokerage/market/products/" +
    "BTC-USD/candles" +
    `?start=${entryStart}` +
    `&end=${rangeEnd}` +
    "&granularity=ONE_MINUTE";

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
    },
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();

  const candles = Array.isArray(json?.candles)
    ? (json.candles as CoinbaseCandle[])
    : [];

  if (candles.length === 0) {
    return null;
  }

  return {
    entryStart,
    candles,
  };
}

async function processLog(
  log: LogWorkItem
): Promise<ProcessResult> {
  const candleData = await fetchCandlesForLog(log);

  if (!candleData) {
    return {
      rows: [],
      fetchFailed: true,
    };
  }

  const { entryStart, candles } = candleData;

  const entryPrice = candleCloseAtOrAfter(candles, entryStart);

  if (entryPrice === null) {
    return {
      rows: [],
      fetchFailed: true,
    };
  }

  const direction =
    log.range_signal === "SELL_UPPER_BAND" ? -1 : 1;

  const rows: Record<string, unknown>[] = [];

  for (const minutes of log.missing_windows) {
    const exitTimestamp = entryStart + minutes * 60;

    const exitPrice = candleCloseAtOrAfter(
      candles,
      exitTimestamp
    );

    if (exitPrice === null) {
      continue;
    }

    const pnlBps =
      ((exitPrice - entryPrice) / entryPrice) *
      10000 *
      direction;

    rows.push({
      log_id: log.id,
      product_id: "BTC-USD",
      minutes,
      signal: log.range_signal,
      direction,
      entry_price: Number(entryPrice.toFixed(2)),
      exit_price: Number(exitPrice.toFixed(2)),
      pnl_bps: Number(pnlBps.toFixed(2)),
      regime: log.regime,
      structure: log.structure,
      volatility_bps: log.volatility_bps,

      /*
       * Preserve insertion time for operational auditing.
       */
      created_at: new Date().toISOString(),

      /*
       * Preserve the actual Edge Hunter observation time.
       * This gives Edge Mode the correct time axis for
       * 7d / 14d / 45d / decay analysis going forward.
       */
      scan_created_at: log.created_at,
    });
  }

  return {
    rows,
    fetchFailed: false,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length);

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        concurrency,
        items.length
      ),
    },
    () => runWorker()
  );

  await Promise.all(workers);

  return results;
}

export async function GET() {
  return POST();
}

export async function POST() {
  const startedAt = Date.now();

  try {
    const supabase = getAdminClient();

    /*
     * 31 minutes guarantees the full 30-minute
     * lookahead window has elapsed.
     */
    const cutoff = new Date(
      Date.now() - 31 * 60 * 1000
    ).toISOString();

    let offset = 0;
    let logsScanned = 0;
    let candidateLogsScanned = 0;

    const workItems: LogWorkItem[] = [];

    /*
     * Scan oldest first.
     *
     * This is the important repair:
     * old unprocessed Hunter observations can no longer
     * be permanently buried behind newer telemetry.
     */
    while (
      logsScanned < MAX_LOGS_SCANNED_PER_RUN &&
      workItems.length < PROCESS_LOG_LIMIT
    ) {
      const from = offset;
      const to =
        offset + SCAN_PAGE_SIZE - 1;

      const {
        data: logs,
        error: logsError,
      } = await supabase
        .from("edge_hunter_logs")
        .select(
          [
            "id",
            "created_at",
            "note",
            "regime",
            "structure",
            "volatility_bps",
          ].join(",")
        )
        .lte("created_at", cutoff)
        .order("created_at", {
          ascending: true,
        })
        .range(from, to);

      if (logsError) {
        return NextResponse.json(
          {
            ok: false,
            stage: "hunter_log_scan",
            error: logsError.message,
          },
          { status: 500 }
        );
      }

      const page = (logs || []) as unknown as HunterLog[];

      if (page.length === 0) {
        break;
      }

      logsScanned += page.length;
      offset += page.length;

      const candidates = page
        .map((log) => ({
          ...log,
          range_signal: extractRangeSignal(
            log.note
          ),
        }))
        .filter(
          (
            log
          ): log is HunterLog & {
            range_signal: string;
          } => Boolean(log.range_signal)
        );

      candidateLogsScanned +=
        candidates.length;

      if (candidates.length === 0) {
        if (page.length < SCAN_PAGE_SIZE) {
          break;
        }

        continue;
      }

      const candidateIds = candidates.map(
        (log) => log.id
      );

      /*
       * Bulk-read existing outcomes for this page.
       *
       * Old code issued a database query for every
       * log × every lookahead window.
       */
      const {
        data: existingRows,
        error: existingError,
      } = await supabase
        .from("edge_outcomes")
        .select("log_id, minutes")
        .in("log_id", candidateIds);

      if (existingError) {
        return NextResponse.json(
          {
            ok: false,
            stage: "existing_outcome_scan",
            error: existingError.message,
          },
          { status: 500 }
        );
      }

      const existingKeys = new Set(
        (
          (existingRows ||
            []) as ExistingOutcome[]
        )
          .filter(
            (row) =>
              row.log_id &&
              row.minutes !== null
          )
          .map((row) =>
            outcomeKey(
              row.log_id as string,
              row.minutes as number
            )
          )
      );

      for (const candidate of candidates) {
        const missingWindows =
          LOOKAHEAD_WINDOWS.filter(
            (minutes) =>
              !existingKeys.has(
                outcomeKey(
                  candidate.id,
                  minutes
                )
              )
          );

        if (missingWindows.length === 0) {
          continue;
        }

        workItems.push({
          ...candidate,
          missing_windows: [
            ...missingWindows,
          ],
        });

        if (
          workItems.length >=
          PROCESS_LOG_LIMIT
        ) {
          break;
        }
      }

      if (page.length < SCAN_PAGE_SIZE) {
        break;
      }
    }

    /*
     * Process a bounded number of missing logs with
     * controlled concurrency.
     *
     * One Coinbase candle-range request per log.
     */
    const processed = await mapWithConcurrency(
      workItems,
      COINBASE_CONCURRENCY,
      processLog
    );

    const results = processed.flatMap(
      (item) => item.rows
    );

    const marketFetchFailures =
      processed.filter(
        (item) => item.fetchFailed
      ).length;

    if (results.length > 0) {
      /*
       * Final duplicate protection.
       *
       * A concurrent invocation could theoretically
       * create an outcome after our earlier scan.
       * Re-check immediately before insert.
       */
      const touchedLogIds = [
        ...new Set(
          results.map(
            (row) =>
              row.log_id as string
          )
        ),
      ];

      const {
        data: finalExisting,
        error: finalExistingError,
      } = await supabase
        .from("edge_outcomes")
        .select("log_id, minutes")
        .in("log_id", touchedLogIds);

      if (finalExistingError) {
        return NextResponse.json(
          {
            ok: false,
            stage:
              "final_duplicate_check",
            error:
              finalExistingError.message,
          },
          { status: 500 }
        );
      }

      const finalExistingKeys =
        new Set(
          (
            (finalExisting ||
              []) as ExistingOutcome[]
          )
            .filter(
              (row) =>
                row.log_id &&
                row.minutes !== null
            )
            .map((row) =>
              outcomeKey(
                row.log_id as string,
                row.minutes as number
              )
            )
        );

      const rowsToInsert =
        results.filter(
          (row) =>
            !finalExistingKeys.has(
              outcomeKey(
                row.log_id as string,
                row.minutes as number
              )
            )
        );

      if (rowsToInsert.length > 0) {
        const {
          error: insertError,
        } = await supabase
          .from("edge_outcomes")
          .insert(rowsToInsert);

        if (insertError) {
          return NextResponse.json(
            {
              ok: false,
              stage: "outcome_insert",
              error: insertError.message,
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        ok: true,
        mode:
          "oldest_missing_first",
        cutoff,
        logs_scanned: logsScanned,
        candidate_logs_scanned:
          candidateLogsScanned,
        missing_logs_selected:
          workItems.length,
        market_fetch_failures:
          marketFetchFailures,
        outcomes_calculated:
          results.length,
        outcomes_inserted:
          rowsToInsert.length,
        oldest_selected_at:
          workItems[0]?.created_at ??
          null,
        newest_selected_at:
          workItems.at(-1)
            ?.created_at ?? null,
        duration_ms:
          Date.now() - startedAt,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "oldest_missing_first",
      cutoff,
      logs_scanned: logsScanned,
      candidate_logs_scanned:
        candidateLogsScanned,
      missing_logs_selected:
        workItems.length,
      market_fetch_failures:
        marketFetchFailures,
      outcomes_calculated: 0,
      outcomes_inserted: 0,
      oldest_selected_at:
        workItems[0]?.created_at ??
        null,
      newest_selected_at:
        workItems.at(-1)?.created_at ??
        null,
      duration_ms:
        Date.now() - startedAt,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "unknown_error";

    return NextResponse.json(
      {
        ok: false,
        stage: "unhandled",
        error: message,
      },
      { status: 500 }
    );
  }
}