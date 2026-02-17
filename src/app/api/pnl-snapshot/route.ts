// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Admin-only Performance Snapshot (FIFO realized PnL)
 * - Reads public.trade_logs via SUPABASE_SERVICE_ROLE_KEY
 * - Extracts fills from row.raw (best-effort paths) and computes:
 *    gross_pnl_usd, fees_usd, net_realized_pnl_usd
 *    wins/losses/win_rate
 *    equity curve peak + max drawdown ($ + %)
 *    open position (base size + cost basis including buy fees)
 * - Supports:
 *    ?secret=...   (required)
 *    ?since=ISO    (optional override; default = last 30 days)
 *    ?limit=NUM    (optional; default 2000; max 10000)
 */

function nowIso() {
  return new Date().toISOString();
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parseSinceOrDefault(sinceRaw: string | null) {
  // default: last 30 days
  const dflt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (!sinceRaw) return dflt.toISOString();
  const d = new Date(sinceRaw);
  if (!Number.isFinite(d.getTime())) return dflt.toISOString();
  return d.toISOString();
}

function safeObj(v: any) {
  return v && typeof v === "object" ? v : {};
}

type Fill = {
  ts: string; // ISO
  side: "BUY" | "SELL";
  price: number; // USD per BTC
  size: number; // BTC
  feeUsd: number; // USD
  orderId?: string;
  source?: string;
};

function asNum(v: any): number {
  const n =
    typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function normSide(v: any): "BUY" | "SELL" | null {
  const s = String(v ?? "").toUpperCase();
  if (s === "BUY") return "BUY";
  if (s === "SELL") return "SELL";
  return null;
}

function pickFirst(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Extract fills from a trade_logs row.
 * We try common shapes your logger may store:
 * - raw.fills
 * - raw.order.fills
 * - raw.response.fills
 * - raw.result.fills
 *
 * Each fill should provide price + size + fee.
 * If we can't find fills arrays, we try a "summary-style" row with top-level fields.
 */
function extractFillsFromTradeLogRow(row: any): Fill[] {
  const raw = safeObj(row?.raw);
  const created = row?.created_at ?? raw?.created_at ?? raw?.time ?? raw?.timestamp;

  const rootSide = normSide(raw?.side ?? row?.side ?? raw?.order?.side);
  const orderId = String(
    row?.order_id ??
      raw?.order_id ??
      raw?.orderId ??
      raw?.id ??
      row?.id ??
      ""
  );

  const candidates: any[] = [
    ...(Array.isArray(raw?.fills) ? raw.fills : []),
    ...(Array.isArray(raw?.order?.fills) ? raw.order.fills : []),
    ...(Array.isArray(raw?.response?.fills) ? raw.response.fills : []),
    ...(Array.isArray(raw?.result?.fills) ? raw.result.fills : []),
  ];

  if (candidates.length) {
    const fills = candidates
      .map((f: any) => {
        const side = normSide(f?.side) ?? rootSide;
        if (!side) return null;

        const price = asNum(
          pickFirst(f, ["price", "fill_price", "execution_price", "avg_price", "rate"])
        );
        const size = asNum(
          pickFirst(f, ["size", "base_size", "filled_size", "quantity", "baseQuantity"])
        );

        // fee may be stored as:
        // fee, fee_usd, commission_usd, commission, fees.usd, etc.
        const feeUsd = asNum(
          pickFirst(f, ["fee", "fee_usd", "commission_usd", "commission"]) ??
            pickFirst(f?.fees, ["usd"]) ??
            0
        );

        const ts = String(
          pickFirst(f, ["trade_time", "time", "timestamp"]) ??
            created ??
            new Date().toISOString()
        );

        if (!(price > 0) || !(size > 0)) return null;

        return {
          ts,
          side,
          price,
          size,
          feeUsd,
          orderId,
          source: "fills_array",
        } as Fill;
      })
      .filter(Boolean) as Fill[];

    return fills;
  }

  // Fallback: summary-style single fill at top level
  const side = normSide(
    raw?.side ??
      row?.side ??
      raw?.order?.side ??
      raw?.result?.side ??
      raw?.response?.side
  );

  const price = asNum(
    pickFirst(raw, ["execution_price", "price", "fill_price"]) ??
      pickFirst(row, ["execution_price", "price", "fill_price"])
  );
  const size = asNum(
    pickFirst(raw, ["executed_size", "base_size", "size"]) ??
      pickFirst(row, ["executed_size", "base_size", "size"])
  );
  const feeUsd = asNum(
    pickFirst(raw, ["fee", "fee_usd", "fees_usd"]) ??
      pickFirst(row, ["fee", "fee_usd", "fees_usd"])
  );

  if (side && price > 0 && size > 0) {
    return [
      {
        ts: String(
          pickFirst(raw, ["time_of_last_fill", "created_at", "time"]) ??
            created ??
            new Date().toISOString()
        ),
        side,
        price,
        size,
        feeUsd,
        orderId,
        source: "summary_row",
      },
    ];
  }

  return [];
}

type PnlResult = {
  rowsScanned: number;
  fillsUsed: number;
  tradesClosed: number;
  wins: number;
  losses: number;
  winRate: number;

  grossPnlUsd: number;
  feesUsd: number;
  netRealizedPnlUsd: number;

  equityPeakUsd: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;

  openBaseSize: number;
  openCostBasisUsd: number; // includes remaining buy fees
};

function computeFifoPnl(rows: any[]): PnlResult {
  const fills: Fill[] = rows.flatMap((r) => extractFillsFromTradeLogRow(r));

  // Sort by time ascending for FIFO
  const ordered = fills
    .slice()
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // FIFO buy queue
  let buys: { size: number; price: number; feeUsd: number; ts: string }[] = [];

  let gross = 0;
  let fees = 0;
  let net = 0;

  let wins = 0;
  let losses = 0;
  let tradesClosed = 0;

  // Equity curve from realized net only
  let equity = 0;
  let peak = 0;
  let maxDd = 0;

  for (const f of ordered) {
    fees += f.feeUsd;

    if (f.side === "BUY") {
      buys.push({ size: f.size, price: f.price, feeUsd: f.feeUsd, ts: f.ts });
      continue;
    }

    // SELL: match against queued buys FIFO
    let sellRemaining = f.size;

    while (sellRemaining > 0 && buys.length) {
      const b = buys[0];
      const matchSize = Math.min(sellRemaining, b.size);

      const legGross = (f.price - b.price) * matchSize;

      // Allocate fees prorata
      const buyFeeAlloc = b.feeUsd * (matchSize / b.size);
      const sellFeeAlloc = f.feeUsd * (matchSize / f.size);

      const legNet = legGross - buyFeeAlloc - sellFeeAlloc;

      gross += legGross;
      net += legNet;

      // Each matched pair becomes one closed "trade leg"
      tradesClosed += 1;
      if (legNet >= 0) wins += 1;
      else losses += 1;

      equity += legNet;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDd) maxDd = dd;

      // Reduce quantities
      b.size -= matchSize;
      sellRemaining -= matchSize;

      // If that buy is fully consumed, pop it
      if (b.size <= 1e-12) {
        buys.shift();
      } else {
        // reduce its remaining fee in-line with allocation
        b.feeUsd -= buyFeeAlloc;
      }
    }
  }

  // Open position = remaining buys
  const openBaseSize = buys.reduce((s, b) => s + b.size, 0);

  // Cost basis includes buy price*size + remaining buy fees
  const openCostBasisUsd = buys.reduce(
    (s, b) => s + b.price * b.size + b.feeUsd,
    0
  );

  const winRate = tradesClosed ? wins / tradesClosed : 0;
  const maxDdPct = peak > 0 ? maxDd / peak : 0;

  return {
    rowsScanned: rows.length,
    fillsUsed: ordered.length,
    tradesClosed,
    wins,
    losses,
    winRate,

    grossPnlUsd: gross,
    feesUsd: fees,
    netRealizedPnlUsd: net,

    equityPeakUsd: peak,
    maxDrawdownUsd: maxDd,
    maxDrawdownPct: maxDdPct,

    openBaseSize,
    openCostBasisUsd,
  };
}

export async function GET(req: Request) {
  const runId = `pnl_${Math.random().toString(16).slice(2, 10)}`;

  try {
    // --- Admin secret gate ---
    const url = new URL(req.url);
    const secret = (url.searchParams.get("secret") || "").trim();

    const expected =
      (process.env.CRON_SECRET || "").trim() ||
      (process.env.YC_CRON_SECRET || "").trim() ||
      (process.env.PNL_SNAPSHOT_SECRET || "").trim();

    if (!expected) {
      return json(500, { ok: false, runId, error: "missing_server_secret_env" });
    }
    if (!secret || secret !== expected) {
      return json(401, { ok: false, runId, error: "unauthorized" });
    }

    // --- Params ---
    const since = parseSinceOrDefault(url.searchParams.get("since"));
    const limitRaw = Number(url.searchParams.get("limit") || "2000");
    const limit = clampInt(limitRaw, 1, 10000);

    // --- Supabase admin client ---
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Pull rows since timestamp (ASC so FIFO/equity makes sense)
    const { data, error } = await sb
      .from("trade_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return json(500, {
        ok: false,
        runId,
        error: "db_read_failed",
        details: String((error as any)?.message || error),
      });
    }

    const rows = Array.isArray(data) ? data : [];

    // All-time (within since)
    const statsAll = computeFifoPnl(rows);

    // last 24h window
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows24h = rows.filter((r: any) => {
      const t = new Date(r?.created_at || 0).getTime();
      return Number.isFinite(t) && t >= new Date(since24h).getTime();
    });
    const stats24h = computeFifoPnl(rows24h);

    const payload = {
      ok: true,
      runId,
      user_id: null,
      since,

      rows_scanned: statsAll.rowsScanned,
      fills_used: statsAll.fillsUsed,

      trades_closed: statsAll.tradesClosed,
      wins: statsAll.wins,
      losses: statsAll.losses,
      win_rate: Number((statsAll.winRate * 100).toFixed(2)),

      gross_pnl_usd: Number(statsAll.grossPnlUsd.toFixed(6)),
      fees_usd: Number(statsAll.feesUsd.toFixed(6)),
      net_realized_pnl_usd: Number(statsAll.netRealizedPnlUsd.toFixed(6)),

      equity_peak_usd: Number(statsAll.equityPeakUsd.toFixed(6)),
      max_drawdown_usd: Number(statsAll.maxDrawdownUsd.toFixed(6)),
      max_drawdown_pct: Number((statsAll.maxDrawdownPct * 100).toFixed(3)),

      open_position_base: Number(statsAll.openBaseSize.toFixed(8)),
      open_cost_basis_usd: Number(statsAll.openCostBasisUsd.toFixed(6)),

      last_24h: {
        since: since24h,
        rows_scanned: stats24h.rowsScanned,
        fills_used: stats24h.fillsUsed,
        trades_closed: stats24h.tradesClosed,
        wins: stats24h.wins,
        losses: stats24h.losses,
        win_rate: Number((stats24h.winRate * 100).toFixed(2)),
        gross_pnl_usd: Number(stats24h.grossPnlUsd.toFixed(6)),
        fees_usd: Number(stats24h.feesUsd.toFixed(6)),
        net_realized_pnl_usd: Number(stats24h.netRealizedPnlUsd.toFixed(6)),
        max_drawdown_usd: Number(stats24h.maxDrawdownUsd.toFixed(6)),
        max_drawdown_pct: Number((stats24h.maxDrawdownPct * 100).toFixed(3)),
      },

      debug: {
        limit,
        generated_at: nowIso(),
        note:
          "FIFO realized PnL computed from extracted fills. If fills_used is 0, trade_logs.raw likely doesn't include fills; adjust extractor paths.",
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, {
      ok: false,
      runId,
      error: String(e?.message || e),
    });
  }
}
