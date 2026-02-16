// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Admin-only Performance Snapshot
 * - Reads public.trade_logs via SUPABASE_SERVICE_ROLE_KEY
 * - Computes trades/wins/losses/win_rate/avg bps/net pnl/fees/equity curve/max DD
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

function pickNumber(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function safeObj(v: any) {
  return v && typeof v === "object" ? v : {};
}

function computeMaxDrawdownPct(equityCurve: number[]) {
  // equityCurve is cumulative equity (starting at 0)
  let peak = -Infinity;
  let maxDd = 0; // as fraction (0.12 = 12%)
  for (const e of equityCurve) {
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak : peak === 0 ? 0 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd * 100;
}

function computeStatsFromRows(rows: any[]) {
  // Field candidates (row-level OR inside row.raw)
  const PNL_USD_KEYS = ["realized_pnl_usd", "pnl_usd", "net_pnl_usd", "realizedPnlUsd", "realizedPnLUsd"];
  const FEES_USD_KEYS = ["fees_paid_usd", "fees_usd", "fee_usd", "feesUsd", "feeUsd", "commission_usd"];
  const PNL_BPS_KEYS = ["avg_bps", "pnl_bps", "pnlBps", "realized_bps", "realizedBps", "realized_bps_total"];

  // For derived bps if missing
  const QUOTE_KEYS = ["quote_size", "quote_usd", "quoteUsd", "quote"];
  const PRICE_KEYS = ["price", "price_usd", "fill_price", "fillPrice"];
  const BASE_KEYS = ["base_size", "base", "baseSize", "size"];

  // We treat "fills_used" as rows that look like actual orders
  // Best-effort: keep rows where raw.kind is "live_order" or where order_id exists
  const normalized = rows.map((r) => {
    const raw = safeObj(r?.raw);
    const merged = { ...safeObj(r), ...raw };

    // pnl/fees can be on row OR raw
    const pnlUsd = pickNumber(merged, PNL_USD_KEYS);
    const feesUsd = pickNumber(merged, FEES_USD_KEYS) ?? 0;

    let pnlBps = pickNumber(merged, PNL_BPS_KEYS);

    // Derive bps if missing and we have quote size + pnlUsd
    if ((pnlBps === null || pnlBps === undefined) && typeof pnlUsd === "number") {
      const quote = pickNumber(merged, QUOTE_KEYS);
      if (typeof quote === "number" && quote > 0) {
        pnlBps = (pnlUsd / quote) * 10_000;
      } else {
        // fallback: if we can estimate notional from base*price
        const base = pickNumber(merged, BASE_KEYS);
        const price = pickNumber(merged, PRICE_KEYS);
        if (typeof base === "number" && base > 0 && typeof price === "number" && price > 0) {
          const notional = base * price;
          if (notional > 0) pnlBps = (pnlUsd / notional) * 10_000;
        }
      }
    }

    const createdAt = r?.created_at ?? raw?.created_at ?? null;

    const looksLikeFill =
      raw?.kind === "live_order" ||
      typeof r?.order_id === "string" ||
      typeof raw?.order_id === "string" ||
      typeof r?.side === "string";

    return {
      created_at: createdAt,
      pnl_usd: typeof pnlUsd === "number" ? pnlUsd : null,
      fees_usd: typeof feesUsd === "number" ? feesUsd : 0,
      pnl_bps: typeof pnlBps === "number" && Number.isFinite(pnlBps) ? pnlBps : null,
      looksLikeFill,
      row: r,
    };
  });

  const fills = normalized.filter((x) => x.looksLikeFill);

  let total_trades = 0;
  let wins = 0;
  let losses = 0;

  let sumWinBps = 0;
  let cntWinBps = 0;

  let sumLossBps = 0;
  let cntLossBps = 0;

  let realizedPnlUsd = 0;
  let feesPaidUsd = 0;

  // Equity curve from realized pnl - fees (starting at 0)
  const equityCurve: number[] = [];
  let equity = 0;

  for (const f of fills) {
    total_trades += 1;

    const pnl = f.pnl_usd;
    const fees = f.fees_usd ?? 0;

    feesPaidUsd += fees;

    if (typeof pnl === "number" && Number.isFinite(pnl)) {
      realizedPnlUsd += pnl;

      if (pnl > 0) wins += 1;
      else if (pnl < 0) losses += 1;
    }

    // avg bps tracking (best effort)
    if (typeof f.pnl_bps === "number" && Number.isFinite(f.pnl_bps)) {
      if ((pnl ?? 0) > 0) {
        sumWinBps += f.pnl_bps;
        cntWinBps += 1;
      } else if ((pnl ?? 0) < 0) {
        sumLossBps += f.pnl_bps;
        cntLossBps += 1;
      }
    }

    equity += (typeof pnl === "number" ? pnl : 0) - (typeof fees === "number" ? fees : 0);
    equityCurve.push(equity);
  }

  const netRealized = realizedPnlUsd - feesPaidUsd;
  const winRate = total_trades > 0 ? wins / total_trades : 0;

  const avgWinBps = cntWinBps > 0 ? sumWinBps / cntWinBps : 0;
  const avgLossBps = cntLossBps > 0 ? sumLossBps / cntLossBps : 0;

  const maxDrawdownPct = equityCurve.length ? computeMaxDrawdownPct(equityCurve) : 0;

  return {
    rows_scanned: rows.length,
    fills_used: fills.length,
    total_trades,
    wins,
    losses,
    win_rate: Number(winRate.toFixed(4)),
    avg_win_bps: Number(avgWinBps.toFixed(2)),
    avg_loss_bps: Number(avgLossBps.toFixed(2)),
    realized_pnl_usd: Number(realizedPnlUsd.toFixed(8)),
    fees_paid_usd: Number(feesPaidUsd.toFixed(8)),
    net_realized_pnl_usd: Number(netRealized.toFixed(8)),
    running_equity: Number(equity.toFixed(8)),
    max_drawdown_pct: Number(maxDrawdownPct.toFixed(3)),
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

    // Pull rows since timestamp
    // Order ASC so equity curve makes sense.
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

    const statsAll = computeStatsFromRows(rows);

    // last 24h window
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows24h = rows.filter((r: any) => {
      const t = new Date(r?.created_at || 0).getTime();
      return Number.isFinite(t) && t >= new Date(since24h).getTime();
    });
    const stats24h = computeStatsFromRows(rows24h);

    // MVP: open pnl unknown (we don’t call Coinbase here)
    const payload = {
      ok: true,
      runId,
      user_id: null,
      since,
      rows_scanned: statsAll.rows_scanned,
      fills_used: statsAll.fills_used,
      total_trades: statsAll.total_trades,
      wins: statsAll.wins,
      losses: statsAll.losses,
      win_rate: statsAll.win_rate,
      avg_win_bps: statsAll.avg_win_bps,
      avg_loss_bps: statsAll.avg_loss_bps,
      net_realized_pnl_usd: statsAll.net_realized_pnl_usd,
      fees_paid_usd: statsAll.fees_paid_usd,
      current_open_pnl_usd: null,
      open_position_base: 0,
      running_equity: statsAll.running_equity,
      max_drawdown_pct: statsAll.max_drawdown_pct,
      last_24h: {
        since: since24h,
        total_trades: stats24h.total_trades,
        wins: stats24h.wins,
        losses: stats24h.losses,
        win_rate: stats24h.win_rate,
        net_realized_pnl_usd: stats24h.net_realized_pnl_usd,
        fees_paid_usd: stats24h.fees_paid_usd,
      },
      debug: {
        limit,
        generated_at: nowIso(),
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