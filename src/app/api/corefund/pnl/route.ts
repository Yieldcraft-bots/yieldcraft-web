// src/app/api/corefund/pnl/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function safeEq(a: string, b: string) {
  const A = Buffer.from(a || "", "utf8");
  const B = Buffer.from(b || "", "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function parseISO(v: string | null, fallback: string) {
  const s = (v || "").trim();
  const d = s ? new Date(s) : new Date(fallback);
  if (!Number.isFinite(d.getTime())) return new Date(fallback);
  return d;
}

function clampInt(n: any, def: number, min: number, max: number) {
  const x = Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(x)) return def;
  return Math.max(min, Math.min(max, x));
}

type Lot = { qty: number; px: number; fee: number };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Auth: ?secret= OR header x-cron-secret OR Authorization Bearer <secret>
    const secretQ = url.searchParams.get("secret") || "";
    const secretH = req.headers.get("x-cron-secret") || "";
    const bearer = getBearer(req) || "";

    const expected =
      process.env.YC_CRON_SECRET ||
      process.env.CRON_SECRET ||
      "";

    if (!expected) {
      return json(500, { ok: false, error: "missing_server_secret" });
    }

    const authed =
      (secretQ && safeEq(secretQ, expected)) ||
      (secretH && safeEq(secretH, expected)) ||
      (bearer && safeEq(bearer, expected));

    if (!authed) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    const since = parseISO(
      url.searchParams.get("since"),
      "2025-12-01T00:00:00.000Z"
    ).toISOString();

    const symbol = (url.searchParams.get("symbol") || "BTC-USD").trim();
    const exchange = (url.searchParams.get("exchange") || "coinbase").trim();

    const limit = clampInt(url.searchParams.get("limit"), 10000, 1, 100000);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(500, { ok: false, error: "missing_supabase_env" });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Pull corefund logs (server-only)
    const { data: rows, error } = await sb
      .from("corefund_trade_logs")
      .select("created_at, side, price, base_size, fee_usd")
      .eq("symbol", symbol)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return json(500, { ok: false, error: "db_read_failed", details: error.message });
    }

    const scanned = rows?.length ?? 0;

    // Normalize usable trades
    const usable = (rows || [])
      .map((r: any) => ({
        t: String(r.created_at || ""),
        side: String(r.side || "").toUpperCase(),
        px: Number(r.price),
        qty: Number(r.base_size),
        fee: Number(r.fee_usd ?? 0),
      }))
      .filter(
        (r) =>
          (r.side === "BUY" || r.side === "SELL") &&
          Number.isFinite(r.px) &&
          Number.isFinite(r.qty) &&
          r.qty > 0
      );

    const runId = `corefund_pnl_${crypto.randomBytes(6).toString("hex")}`;

    // FIFO matching
    const buys: Lot[] = [];
    let realizedGross = 0;
    let fees = 0;
    let wins = 0;
    let losses = 0;
    let sumWinBps = 0;
    let sumLossBps = 0;

    for (const r of usable) {
      fees += Number.isFinite(r.fee) ? r.fee : 0;

      if (r.side === "BUY") {
        buys.push({ qty: r.qty, px: r.px, fee: Number.isFinite(r.fee) ? r.fee : 0 });
        continue;
      }

      // SELL: match against buys FIFO
      let sellQty = r.qty;
      while (sellQty > 0 && buys.length > 0) {
        const lot = buys[0];
        const m = Math.min(sellQty, lot.qty);

        const pnl = (r.px - lot.px) * m; // gross pnl for matched amount
        realizedGross += pnl;

        const bps = ((r.px - lot.px) / lot.px) * 10000;
        if (bps >= 0) {
          wins += 1;
          sumWinBps += bps;
        } else {
          losses += 1;
          sumLossBps += bps;
        }

        lot.qty -= m;
        sellQty -= m;

        if (lot.qty <= 1e-12) buys.shift();
      }
      // If sellQty remains and no buys, ignore (short not supported)
    }

    // Open position remaining
    const openPos = buys.reduce((a, b) => a + b.qty, 0);
    const openCost = buys.reduce((a, b) => a + b.qty * b.px, 0);
    const openAvg = openPos > 0 ? openCost / openPos : null;

    // Best-effort spot price: last usable trade price
    const lastPx = usable.length ? usable[usable.length - 1].px : null;
    const openPnl = openPos > 0 && Number.isFinite(lastPx as any) && openAvg
      ? (Number(lastPx) - openAvg) * openPos
      : 0;

    const realizedNet = realizedGross - fees;

    // Equity / DD (best-effort): realized equity only
    const startingEq = 0;
    const runningEq = startingEq + realizedNet;
    const maxDD = 0;

    return json(200, {
      ok: true,
      runId,
      since,
      symbol,
      exchange,
      rows_scanned: scanned,
      rows_usable: usable.length,
      limit,
      total_trades: usable.length,
      wins,
      losses,
      win_rate: usable.length ? Number(((wins / Math.max(1, wins + losses)) * 100).toFixed(2)) : 0,
      avg_win_bps: wins ? Number((sumWinBps / wins).toFixed(2)) : 0,
      avg_loss_bps: losses ? Number((sumLossBps / losses).toFixed(2)) : 0,
      fees_usd: Number(fees.toFixed(4)),
      net_realized_pnl_usd_gross: Number(realizedGross.toFixed(4)),
      net_realized_pnl_usd: Number(realizedNet.toFixed(4)),
      open_position_base: Number(openPos.toFixed(8)),
      open_cost_usd: Number(openCost.toFixed(4)),
      spot_price: lastPx,
      open_avg_price: openAvg,
      current_open_pnl_usd: Number(openPnl.toFixed(4)),
      starting_equity_usd: startingEq,
      running_equity_usd: Number(runningEq.toFixed(4)),
      max_drawdown_pct: maxDD,
      debug: {
        note:
          "Core Fund PnL uses FIFO matching on corefund_trade_logs. Open PnL uses last seen trade price from logs (best-effort).",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "unknown_error" });
  }
}