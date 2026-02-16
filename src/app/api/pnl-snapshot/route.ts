// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --- helpers ---
function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function requireEnv(name: string) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

function toNumber(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseSince(param: string | null, fallbackDays = 90): string {
  if (param) {
    const d = new Date(param);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(Date.now() - fallbackDays * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function pickFirstNumber(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k];
    const n = toNumber(v);
    if (n !== null) return n;
  }
  return null;
}

function extractPnlUsd(row: any): number {
  // Prefer explicit columns if you have them (or added them later)
  const direct =
    pickFirstNumber(row, ["net_realized_pnl_usd", "realized_pnl_usd", "pnl_usd", "net_pnl_usd"]) ??
    null;
  if (direct !== null) return direct;

  // Fallback: parse from jsonb raw
  const raw = row?.raw || {};
  const rawPnl =
    pickFirstNumber(raw, ["net_realized_pnl_usd", "realized_pnl_usd", "pnl_usd", "net_pnl_usd"]) ??
    pickFirstNumber(raw, ["realizedPnlUsd", "pnlUsd", "netPnlUsd"]) ??
    null;

  return rawPnl ?? 0;
}

function extractFeeUsd(row: any): number {
  const direct = pickFirstNumber(row, ["fees_paid_usd", "fee_usd", "fees_usd"]) ?? null;
  if (direct !== null) return direct;

  const raw = row?.raw || {};
  const rawFee =
    pickFirstNumber(raw, ["fees_paid_usd", "fee_usd", "fees_usd"]) ??
    pickFirstNumber(raw, ["feesPaidUsd", "feeUsd", "feesUsd"]) ??
    null;

  return rawFee ?? 0;
}

function computeStats(rows: any[]) {
  let total_trades = 0;
  let wins = 0;
  let losses = 0;

  let sum_win_bps = 0;
  let sum_loss_bps = 0;
  let win_count = 0;
  let loss_count = 0;

  let net_realized_pnl_usd = 0;
  let fees_paid_usd = 0;

  // Running equity & max drawdown from realized pnl (simple + reliable)
  let equity = 0;
  let peak = 0;
  let max_dd_pct = 0;

  for (const r of rows) {
    // treat rows that represent an executed trade (you can tighten this later)
    total_trades += 1;

    const pnlUsd = extractPnlUsd(r);
    const feeUsd = extractFeeUsd(r);

    net_realized_pnl_usd += pnlUsd;
    fees_paid_usd += feeUsd;

    if (pnlUsd > 0) wins += 1;
    else if (pnlUsd < 0) losses += 1;

    // If you store pnl bps anywhere, we’ll use it; otherwise keep 0.
    const pnlBps =
      pickFirstNumber(r, ["pnl_bps", "pnlBps", "realized_bps", "realizedBps"]) ??
      pickFirstNumber(r?.raw, ["pnl_bps", "pnlBps", "realized_bps", "realizedBps"]) ??
      null;

    if (pnlBps !== null) {
      if (pnlBps > 0) {
        sum_win_bps += pnlBps;
        win_count += 1;
      } else if (pnlBps < 0) {
        sum_loss_bps += pnlBps;
        loss_count += 1;
      }
    }

    equity += pnlUsd;
    if (equity > peak) peak = equity;

    // drawdown % based on peak equity (avoid div by 0)
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd * 100 > max_dd_pct) max_dd_pct = dd * 100;
  }

  const win_rate = total_trades > 0 ? wins / total_trades : 0;

  const avg_win_bps = win_count > 0 ? sum_win_bps / win_count : 0;
  const avg_loss_bps = loss_count > 0 ? sum_loss_bps / loss_count : 0;

  return {
    total_trades,
    wins,
    losses,
    win_rate,
    avg_win_bps,
    avg_loss_bps,
    net_realized_pnl_usd,
    fees_paid_usd,
    running_equity: equity,
    max_drawdown_pct: max_dd_pct,
  };
}

function sbAdmin() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const runId = `pnl_${Math.random().toString(16).slice(2, 10)}`;

  try {
    const u = new URL(req.url);

    // ✅ secret gate (admin-only)
    const secret = (u.searchParams.get("secret") || "").trim();
    const expected = (process.env.CRON_SECRET || "").trim(); // your existing pattern
    if (!expected) return json(500, { ok: false, runId, error: "missing_env:CRON_SECRET" });
    if (!secret || secret !== expected) return json(401, { ok: false, runId, error: "unauthorized" });

    // optional filters
    const user_id = (u.searchParams.get("user_id") || "").trim() || null;
    const since = parseSince(u.searchParams.get("since"), 90);

    const limitParam = u.searchParams.get("limit");
    const limit = Math.max(1, Math.min(1000, Number(limitParam || 250) || 250));

    const client = sbAdmin();

    // Pull rows (you can tighten fields later; keep it flexible now)
    let q = client
      .from("trade_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);

    const { data, error } = await q;

    if (error) {
      return json(500, {
        ok: false,
        runId,
        error: "db_read_failed",
        details: error.message || String(error),
      });
    }

    const rows = Array.isArray(data) ? data : [];
    const stats = computeStats(rows);

    // last 24h window
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows24h = rows.filter((r) => {
      const t = new Date(r?.created_at || 0).getTime();
      return Number.isFinite(t) && t >= new Date(since24h).getTime();
    });
    const stats24h = computeStats(rows24h);

    // current_open_pnl_usd: placeholder (you can compute later from Coinbase position)
    const payload = {
      ok: true,
      runId,
      user_id,
      since,
      rows_scanned: rows.length,
      fills_used: rows.length, // keep simple for now
      total_trades: stats.total_trades,
      wins: stats.wins,
      losses: stats.losses,
      win_rate: stats.win_rate,
      avg_win_bps: stats.avg_win_bps,
      avg_loss_bps: stats.avg_loss_bps,
      net_realized_pnl_usd: stats.net_realized_pnl_usd,
      fees_paid_usd: stats.fees_paid_usd,
      current_open_pnl_usd: null,
      open_position_base: 0,
      running_equity: stats.running_equity,
      max_drawdown_pct: stats.max_drawdown_pct,
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
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}