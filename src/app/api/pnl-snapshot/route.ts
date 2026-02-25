// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Admin-only PnL Snapshot (best-effort FIFO realized + open position)
 *
 * Query:
 *   ?secret=...            (required; matches CRON_SECRET or YC_CRON_SECRET or PNL_SNAPSHOT_SECRET)
 *   ?since=ISO             (optional; default last 30d)
 *   ?limit=NUM             (optional; default 2000; max 10000)
 *   ?user_id=UUID|string   (optional; if omitted uses env PULSE_ONLY_USER_ID if set, else all users)
 *
 * Assumes trade_logs has (at minimum):
 *   created_at, side, base_size, price, quote_size, raw (jsonb)
 * And optionally:
 *   user_id, ok (boolean), status (integer)
 */

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
  const dflt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (!sinceRaw) return dflt.toISOString();
  const d = new Date(sinceRaw);
  if (!Number.isFinite(d.getTime())) return dflt.toISOString();
  return d.toISOString();
}

function safeObj(v: any) {
  return v && typeof v === "object" ? v : {};
}

function asNum(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function normSide(v: any): "BUY" | "SELL" | null {
  const s = String(v ?? "").toUpperCase();
  if (s === "BUY") return "BUY";
  if (s === "SELL") return "SELL";
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type Row = {
  created_at?: string;
  side?: any;
  base_size?: any;
  price?: any;
  quote_size?: any;
  order_id?: any;
  user_id?: any;
  ok?: any;
  status?: any;
  raw?: any;
};

type Fill = {
  ts: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  feeUsd: number;
  orderId?: string;
  userId?: string | null;
  ok?: boolean | null;
  status?: number | null;
};

function extractFeeUsd(row: Row): number {
  // best-effort fee from raw
  const raw = safeObj(row.raw);
  const fee =
    raw?.fee_usd ??
    raw?.feeUsd ??
    raw?.fees_usd ??
    raw?.feesUsd ??
    raw?.commission_usd ??
    raw?.commissionUsd ??
    raw?.fees?.usd ??
    raw?.fee ??
    0;
  return asNum(fee);
}

function extractFillFromRow(row: Row): Fill | null {
  const raw = safeObj(row.raw);

  const side =
    normSide(row.side) ||
    normSide(raw?.side) ||
    normSide(raw?.order?.side) ||
    normSide(raw?.result?.side) ||
    normSide(raw?.response?.side);

  if (!side) return null;

  // prefer real columns (your schema)
  const price =
    asNum(row.price) ||
    asNum(raw?.execution_price) ||
    asNum(raw?.price) ||
    asNum(raw?.fill_price) ||
    0;

  const size =
    asNum(row.base_size) ||
    asNum(raw?.executed_size) ||
    asNum(raw?.base_size) ||
    asNum(raw?.size) ||
    0;

  if (!(price > 0) || !(size > 0)) return null;

  const ts = String(row.created_at || raw?.created_at || raw?.time || raw?.timestamp || new Date().toISOString());

  const feeUsd = extractFeeUsd(row);

  const orderId = String(row.order_id ?? raw?.order_id ?? raw?.orderId ?? raw?.id ?? "") || undefined;

  const userId = row.user_id != null ? String(row.user_id) : null;
  const ok = row.ok != null ? Boolean(row.ok) : null;
  const status = row.status != null ? Number(row.status) : null;

  return { ts, side, price, size, feeUsd, orderId, userId, ok, status };
}

type Snapshot = {
  rows_scanned: number;
  rows_usable: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_win_bps: number;
  avg_loss_bps: number;
  net_realized_pnl_usd: number;

  open_position_base: number;
  open_cost_usd: number;
  open_avg_price: number | null;
  spot_price: number | null;
  current_open_pnl_usd: number;

  starting_equity_usd: number;
  running_equity_usd: number;
  max_drawdown_pct: number;

  fees_usd: number;
};

function computeSnapshot(rows: Row[]): Snapshot {
  const fills = rows
    .map(extractFillFromRow)
    .filter(Boolean) as Fill[];

  // time asc FIFO
  fills.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  const rowsUsable = fills.length;

  // consider “trades” as usable fills (same as your endpoint “total_trades” style)
  const totalTrades = rowsUsable;

  // FIFO queue for open position
  let buys: { size: number; price: number; feeUsd: number }[] = [];

  let feesUsd = 0;

  // realized stats
  let realizedNet = 0;
  let wins = 0;
  let losses = 0;
  const winBps: number[] = [];
  const lossBps: number[] = [];

  // equity curve on realized only
  let equity = 0;
  let peak = 0;
  let maxDd = 0;

  for (const f of fills) {
    feesUsd += f.feeUsd;

    if (f.side === "BUY") {
      buys.push({ size: f.size, price: f.price, feeUsd: f.feeUsd });
      continue;
    }

    // SELL: match FIFO
    let sellRemaining = f.size;

    while (sellRemaining > 0 && buys.length) {
      const b = buys[0];
      const matchSize = Math.min(sellRemaining, b.size);

      const legGross = (f.price - b.price) * matchSize;

      // prorata fees
      const buyFeeAlloc = b.feeUsd * (matchSize / b.size);
      const sellFeeAlloc = f.feeUsd * (matchSize / f.size);

      const legNet = legGross - buyFeeAlloc - sellFeeAlloc;
      realizedNet += legNet;

      const entryNotional = b.price * matchSize;
      const legBps = entryNotional > 0 ? (legNet / entryNotional) * 10000 : 0;

      if (legNet >= 0) {
        wins += 1;
        winBps.push(legBps);
      } else {
        losses += 1;
        lossBps.push(legBps);
      }

      equity += legNet;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDd) maxDd = dd;

      // reduce
      b.size -= matchSize;
      sellRemaining -= matchSize;

      if (b.size <= 1e-12) {
        buys.shift();
      } else {
        b.feeUsd -= buyFeeAlloc;
      }
    }
  }

  const openBase = buys.reduce((s, b) => s + b.size, 0);
  const openCost = buys.reduce((s, b) => s + b.price * b.size + b.feeUsd, 0);
  const openAvg = openBase > 0 ? openCost / openBase : null;

  // best-effort spot: last seen fill price
  const spot = fills.length ? fills[fills.length - 1].price : null;

  const openPnl = openBase > 0 && spot != null ? (spot - (openAvg ?? spot)) * openBase : 0;

  const winRate = totalTrades ? wins / totalTrades : 0;

  const avgWinBps = winBps.length ? winBps.reduce((a, b) => a + b, 0) / winBps.length : 0;
  const avgLossBps = lossBps.length ? lossBps.reduce((a, b) => a + b, 0) / lossBps.length : 0;

  const maxDdPct = peak > 0 ? maxDd / peak : 0;

  return {
    rows_scanned: rows.length,
    rows_usable: rowsUsable,
    total_trades: totalTrades,
    wins,
    losses,
    win_rate: Number((winRate * 100).toFixed(2)),
    avg_win_bps: Number(avgWinBps.toFixed(2)),
    avg_loss_bps: Number(avgLossBps.toFixed(2)),
    net_realized_pnl_usd: Number(realizedNet.toFixed(6)),

    open_position_base: Number(openBase.toFixed(8)),
    open_cost_usd: Number(openCost.toFixed(6)),
    open_avg_price: openAvg != null ? Number(openAvg.toFixed(2)) : null,
    spot_price: spot != null ? Number(spot.toFixed(2)) : null,
    current_open_pnl_usd: Number(openPnl.toFixed(6)),

    starting_equity_usd: 0,
    running_equity_usd: Number(equity.toFixed(6)),
    max_drawdown_pct: Number((maxDdPct * 100).toFixed(3)),

    fees_usd: Number(feesUsd.toFixed(6)),
  };
}

export async function GET(req: Request) {
  const runId = `pnl_${Math.random().toString(16).slice(2, 10)}`;

  try {
    const url = new URL(req.url);

    // --- secret gate ---
    const secret = (url.searchParams.get("secret") || "").trim();
    const expected =
      (process.env.CRON_SECRET || "").trim() ||
      (process.env.YC_CRON_SECRET || "").trim() ||
      (process.env.PNL_SNAPSHOT_SECRET || "").trim();

    if (!expected) return json(500, { ok: false, runId, error: "missing_server_secret_env" });
    if (!secret || secret !== expected) return json(401, { ok: false, runId, error: "unauthorized" });

    // --- params ---
    const since = parseSinceOrDefault(url.searchParams.get("since"));
    const limitRaw = Number(url.searchParams.get("limit") || "2000");
    const limit = clampInt(limitRaw, 1, 10000);

    const userIdParam = (url.searchParams.get("user_id") || "").trim();
    const envOnlyUser = (process.env.PULSE_ONLY_USER_ID || "").trim();
    const effectiveUserId = userIdParam || envOnlyUser || null;

    // --- supabase admin client ---
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Select only what we need (faster/safer than *)
    let q = sb
      .from("trade_logs")
      .select("created_at, side, base_size, quote_size, price, order_id, user_id, ok, status, raw")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (effectiveUserId) q = q.eq("user_id", effectiveUserId);

    const { data, error } = await q;

    if (error) {
      return json(500, { ok: false, runId, error: "db_read_failed", details: String((error as any)?.message || error) });
    }

    const rows: Row[] = Array.isArray(data) ? (data as any) : [];

    const snap = computeSnapshot(rows);

    return json(200, {
      ok: true,
      runId,
      since,
      limit,
      user_id: effectiveUserId,
      symbol: "BTC-USD",

      ...snap,

      debug: {
        only_user_id_env: envOnlyUser || null,
        note:
          "PnL is best-effort FIFO on trade_logs. Uses columns (side/base_size/price) first, falls back to raw if needed.",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}

// Optional: allow POST (same auth/behavior)
export async function POST(req: Request) {
  return GET(req);
}