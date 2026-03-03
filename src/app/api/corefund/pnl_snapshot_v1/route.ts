// src/app/api/corefund/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Core Fund PnL Snapshot (server, admin-only)
 *
 * Reads: public.corefund_trade_logs
 * Computes:
 *  - realized PnL via FIFO matching (BUY lots matched to SELL)
 *  - open position + open PnL from last seen trade price (best-effort)
 *  - basic max drawdown from realized equity points (best-effort)
 *
 * Auth (either/or):
 *  A) Admin allowlist by email:
 *     - Set COREFUND_ADMIN_EMAILS="a@b.com,c@d.com"
 *     - Client must send an email header (x-user-email). Your /corefund page should do this server-side.
 *
 *  B) Secret:
 *     - secret query param OR header x-cron-secret OR Authorization: Bearer <secret>
 *     - Uses CRON_SECRET or YC_CRON_SECRET
 *
 * Query:
 *  - secret=...
 *  - since=ISO (default: 2025-12-01T00:00:00.000Z)
 *  - limit=number (default 10000, max 100000)
 *  - symbol=BTC-USD (optional, default BTC-USD)
 *  - exchange=coinbase (optional, default coinbase)
 */

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

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function shortId() {
  return crypto.randomBytes(6).toString("hex");
}

// -------------------- Auth helpers --------------------

function parseEmailList(v: string): Set<string> {
  return new Set(
    v
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getRequestEmail(req: Request): string {
  // Your server-side /corefund page should send x-user-email = logged-in email
  const candidates = [
    req.headers.get("x-user-email"),
    req.headers.get("x-yc-email"),
    req.headers.get("x-email"),
  ];

  for (const c of candidates) {
    const e = (c || "").trim().toLowerCase();
    if (e && e.includes("@")) return e;
  }
  return "";
}

function isSameOrigin(req: Request): boolean {
  // best-effort: blocks obvious cross-site calls
  const origin = (req.headers.get("origin") || "").toLowerCase();
  const host = (req.headers.get("host") || "").toLowerCase();
  if (!host) return true; // if host missing, don't hard-fail
  if (!origin) return true; // some server-to-server calls won't have origin
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return true;
  }
}

function okSecret(req: Request) {
  const secret =
    (process.env.CRON_SECRET || "").trim() ||
    (process.env.YC_CRON_SECRET || "").trim();

  if (!secret) return false;

  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization") ||
    req.headers.get("x-yc-secret");

  if (h && (h === secret || h === `Bearer ${secret}`)) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

function okAdminAllowlist(req: Request) {
  const raw = (process.env.COREFUND_ADMIN_EMAILS || "").trim();
  if (!raw) return false;

  // basic same-origin guard (not perfect, but helps)
  if (!isSameOrigin(req)) return false;

  const allow = parseEmailList(raw);
  const email = getRequestEmail(req);
  if (!email) return false;

  return allow.has(email);
}

function okAuth(req: Request) {
  // Either secret OR allowlist is sufficient
  return okSecret(req) || okAdminAllowlist(req);
}

function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---- Types we expect in corefund_trade_logs (best effort) ----
type TradeRow = {
  created_at: string;
  exchange: string | null;
  symbol: string | null;
  side: "BUY" | "SELL" | string;
  order_id: string | null;
  base_size: number | null; // BTC amount
  quote_size: number | null; // USD notional
  price: number | null; // avg price (USD)
  fee_usd: number | null;
  ok?: boolean | null;
};

type Lot = { qty: number; price: number; time: string; order_id?: string | null };

function safeSide(s: any): "BUY" | "SELL" | "OTHER" {
  const v = String(s || "").toUpperCase();
  if (v === "BUY") return "BUY";
  if (v === "SELL") return "SELL";
  return "OTHER";
}

function round2(x: number) {
  return Number(x.toFixed(2));
}
function round4(x: number) {
  return Number(x.toFixed(4));
}

function bps(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return ((a - b) / b) * 10_000;
}

export async function GET(req: Request) {
  const runId = `corefund_pnl_${shortId()}`;

  try {
    if (!okAuth(req)) {
      return json(401, {
        ok: false,
        runId,
        error: "unauthorized",
        hint: "Provide CRON_SECRET/YC_CRON_SECRET OR set COREFUND_ADMIN_EMAILS and send x-user-email header.",
      });
    }

    const url = new URL(req.url);

    const since = cleanString(url.searchParams.get("since")) || "2025-12-01T00:00:00.000Z";
    const limit = Math.max(1, Math.min(100000, num(url.searchParams.get("limit"), 10000)));

    const symbol = (cleanString(url.searchParams.get("symbol")) || "BTC-USD").toUpperCase();
    const exchange = (cleanString(url.searchParams.get("exchange")) || "coinbase").toLowerCase();

    const client = sb();

    let q = client
      .from("corefund_trade_logs")
      .select("created_at,exchange,symbol,side,order_id,base_size,quote_size,price,fee_usd,ok")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (exchange) q = q.eq("exchange", exchange);
    if (symbol) q = q.eq("symbol", symbol);

    const { data, error } = await q;
    if (error) return json(500, { ok: false, runId, error: error.message || String(error) });

    const rows = (Array.isArray(data) ? (data as any as TradeRow[]) : []).filter(Boolean);

    const usable: TradeRow[] = rows.filter((r) => {
      const side = safeSide(r.side);
      if (side === "OTHER") return false;

      const b = Number(r.base_size ?? 0);
      const qv = Number(r.quote_size ?? 0);
      const p = Number(r.price ?? 0);
      return (Number.isFinite(b) && b > 0) || (Number.isFinite(qv) && qv > 0) || (Number.isFinite(p) && p > 0);
    });

    const buys: Lot[] = [];
    const realizedTrades: {
      time: string;
      entry_price: number;
      exit_price: number;
      qty: number;
      pnl_usd: number;
      pnl_bps: number;
      fee_usd: number;
      entry_order_id?: string | null;
      exit_order_id?: string | null;
    }[] = [];

    let lastPrice = 0;
    let feeTotal = 0;

    for (const r of usable) {
      const side = safeSide(r.side);
      const px = Number(r.price ?? 0);
      const base = Number(r.base_size ?? 0);
      const quote = Number(r.quote_size ?? 0);
      const fee = Number(r.fee_usd ?? 0);
      const t = cleanString(r.created_at) || nowIso();

      if (Number.isFinite(px) && px > 0) lastPrice = px;
      if (Number.isFinite(fee) && fee > 0) feeTotal += fee;

      let effBase = Number.isFinite(base) && base > 0 ? base : 0;
      let effPrice = Number.isFinite(px) && px > 0 ? px : 0;

      if (!effBase && quote > 0 && effPrice > 0) effBase = quote / effPrice;
      if (!effPrice && quote > 0 && effBase > 0) effPrice = quote / effBase;

      if (!Number.isFinite(effBase) || effBase <= 0) continue;
      if (!Number.isFinite(effPrice) || effPrice <= 0) continue;

      if (side === "BUY") {
        buys.push({ qty: effBase, price: effPrice, time: t, order_id: r.order_id });
        continue;
      }

      let sellQty = effBase;

      while (sellQty > 0 && buys.length > 0) {
        const lot = buys[0];
        const matched = Math.min(sellQty, lot.qty);

        const entryPrice = lot.price;
        const exitPrice = effPrice;

        const pnlUsd = (exitPrice - entryPrice) * matched;
        const pnlBps = bps(exitPrice, entryPrice);

        realizedTrades.push({
          time: t,
          entry_price: entryPrice,
          exit_price: exitPrice,
          qty: matched,
          pnl_usd: pnlUsd,
          pnl_bps: pnlBps,
          fee_usd: 0,
          entry_order_id: lot.order_id ?? null,
          exit_order_id: r.order_id ?? null,
        });

        lot.qty -= matched;
        sellQty -= matched;

        if (lot.qty <= 1e-12) buys.shift();
      }
    }

    const realizedPnLGross = realizedTrades.reduce((s, x) => s + (Number(x.pnl_usd) || 0), 0);
    const realizedPnLNet = realizedPnLGross - feeTotal;

    const wins = realizedTrades.filter((x) => x.pnl_usd > 0);
    const losses = realizedTrades.filter((x) => x.pnl_usd < 0);

    const avgWinBps = wins.length
      ? wins.reduce((s, x) => s + (Number(x.pnl_bps) || 0), 0) / wins.length
      : 0;

    const avgLossBps = losses.length
      ? losses.reduce((s, x) => s + (Number(x.pnl_bps) || 0), 0) / losses.length
      : 0;

    const winRate = realizedTrades.length ? (wins.length / realizedTrades.length) * 100 : 0;

    const openBase = buys.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const openCostUsd = buys.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const openAvgPrice = openBase > 0 ? openCostUsd / openBase : 0;

    const openPnlUsd = openBase > 0 && lastPrice > 0 ? (lastPrice - openAvgPrice) * openBase : 0;

    const startEquity = num(process.env.CORE_FUND_START_EQUITY_USD, num(process.env.YC_START_EQUITY_USD, 0));
    const equityNow = startEquity + realizedPnLNet + openPnlUsd;

    // Best-effort max drawdown from realized points (net of fees)
    let peakEquity = startEquity;
    let maxDdPct = 0;
    let running = startEquity;

    const realizedByTime = [...realizedTrades].sort((a, b) => (a.time < b.time ? -1 : 1));
    for (const x of realizedByTime) {
      running += Number(x.pnl_usd) || 0;
      if (running > peakEquity) peakEquity = running;
      const dd = peakEquity > 0 ? ((peakEquity - running) / peakEquity) * 100 : 0;
      if (dd > maxDdPct) maxDdPct = dd;
    }

    // apply fees as a single net hit (simple)
    running -= feeTotal;
    if (running > peakEquity) peakEquity = running;
    const ddAfterFees = peakEquity > 0 ? ((peakEquity - running) / peakEquity) * 100 : 0;
    if (ddAfterFees > maxDdPct) maxDdPct = ddAfterFees;

    return json(200, {
      ok: true,
      runId,
      since,
      symbol,
      exchange,

      rows_scanned: rows.length,
      rows_usable: usable.length,
      limit,

      total_trades: realizedTrades.length,
      wins: wins.length,
      losses: losses.length,
      win_rate: round2(winRate),
      avg_win_bps: round2(avgWinBps),
      avg_loss_bps: round2(avgLossBps),

      fees_usd: round2(feeTotal),
      net_realized_pnl_usd_gross: round2(realizedPnLGross),
      net_realized_pnl_usd: round2(realizedPnLNet),

      open_position_base: round4(openBase),
      open_cost_usd: round2(openCostUsd),
      spot_price: lastPrice ? round2(lastPrice) : null,
      open_avg_price: openAvgPrice ? round2(openAvgPrice) : null,
      current_open_pnl_usd: round2(openPnlUsd),

      starting_equity_usd: round2(startEquity),
      running_equity_usd: round2(equityNow),
      max_drawdown_pct: round2(maxDdPct),

      debug: {
        auth_mode: okSecret(req) ? "secret" : "admin_email_allowlist",
        request_email: getRequestEmail(req) || null,
        note:
          "Core Fund PnL uses FIFO matching on corefund_trade_logs. Open PnL uses last seen trade price from logs (best-effort).",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, runId: `corefund_pnl_${shortId()}`, error: String(e?.message || e) });
  }
}

export async function POST(req: Request) {
  return GET(req);
}