// src/app/api/pnl-snapshot/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * /api/pnl-snapshot
 * Admin-only (by email allowlist OR secret override).
 *
 * ✅ Minimum viable:
 * - Pulls from: trade_logs (Supabase)
 * - Computes:
 *   total_trades, wins, losses, win_rate,
 *   avg_win_bps, avg_loss_bps,
 *   net_realized_pnl_usd, fees_paid_usd,
 *   current_open_pnl_usd (null for now),
 *   running_equity, max_drawdown_pct,
 *   since timestamp, last_24h window summary
 *
 * Notes:
 * - This is robust to schema drift by “best-effort” field mapping.
 * - You can call it:
 *   - Admin browser: GET /api/pnl-snapshot  (Authorization: Bearer <supabase access token>)
 *   - Cron/internal: GET /api/pnl-snapshot?secret=YOUR_CRON_SECRET
 */

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

function parseNum(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function nowIso() {
  return new Date().toISOString();
}

function pickRealizedPnlUsd(row: any): number {
  const candidates = [
    row.realized_pnl_usd,
    row.realizedPnlUsd,
    row.pnl_usd,
    row.pnlUsd,
    row.net_pnl_usd,
    row.netPnlUsd,
  ];
  for (const c of candidates) {
    const n = parseNum(c);
    if (typeof n === "number") return n;
  }
  return 0;
}

function pickFeesUsd(row: any): number {
  const candidates = [row.fees_usd, row.fee_usd, row.feesUsd, row.feeUsd, row.commission_usd];
  for (const c of candidates) {
    const n = parseNum(c);
    if (typeof n === "number") return n;
  }
  return 0;
}

function pickPnlBps(row: any): number | null {
  const candidates = [row.pnl_bps, row.pnlBps, row.realized_bps, row.realizedBps];
  for (const c of candidates) {
    const n = parseNum(c);
    if (typeof n === "number") return n;
  }
  // If bps not logged, we can't reconstruct reliably without entry/exit prices
  return null;
}

function isWithinLast24h(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function isAdminEmail(email: string | null | undefined): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;

  // ✅ Hard allowlist (safe default)
  const hard = ["dk@dwklein.com"];
  if (hard.includes(e)) return true;

  // Optional env allowlist: ADMIN_EMAILS="a@x.com,b@y.com"
  const envList = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return envList.includes(e);
}

function computeMaxDrawdownPct(equityCurve: number[]): number {
  // Drawdown = (equity - peak) / peak
  // Return as positive percent: 0..100
  let peak = 0;
  let maxDd = 0; // negative
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq;
    if (peak > 0) {
      const dd = (eq - peak) / peak; // negative or 0
      if (dd < maxDd) maxDd = dd;
    }
  }
  return Math.abs(maxDd) * 100;
}

export async function GET(req: Request) {
  const runId = `pnl_${Math.random().toString(16).slice(2, 10)}${Math.random()
    .toString(16)
    .slice(2, 6)}`;

  try {
    const url = new URL(req.url);

    // Optional filters
    const onlyUserId = (url.searchParams.get("user_id") || "").trim() || null;
    const sinceParam = (url.searchParams.get("since") || "").trim() || null; // ISO time
    const limitParam = parseInt((url.searchParams.get("limit") || "1000").trim(), 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 5000) : 1000;

    // Admin guard:
    // - Either secret override (for cron/internal)
    // - Or Authorization Bearer token and admin email allowlist
    const secret = (url.searchParams.get("secret") || "").trim();
    const cronSecret = (process.env.CRON_SECRET || "").trim();

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    let authedUserId: string | null = null;
    let authedEmail: string | null = null;
    let authMode: "secret" | "bearer" | "none" = "none";

    if (cronSecret && secret && secret === cronSecret) {
      authMode = "secret";
    } else {
      // Bearer token path
      const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      const token = m?.[1]?.trim() || "";

      if (!token) {
        return json(401, {
          ok: false,
          runId,
          error: "missing_authorization",
          hint: "Provide Authorization: Bearer <supabase_access_token> (admin-only) OR ?secret=CRON_SECRET.",
        });
      }

      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) {
        return json(401, {
          ok: false,
          runId,
          error: "invalid_token",
          details: String(error?.message || error || "unknown"),
        });
      }

      authedUserId = data.user.id;
      authedEmail = (data.user.email || "").trim().toLowerCase() || null;
      authMode = "bearer";

      if (!isAdminEmail(authedEmail)) {
        return json(403, {
          ok: false,
          runId,
          error: "forbidden",
          details: "Admin-only endpoint.",
        });
      }
    }

    // Query trade logs
    // We keep select("*") to be resilient to schema changes.
    let q = sb.from("trade_logs").select("*").order("created_at", { ascending: true }).limit(limit);

    // If caller specified user_id filter, apply it
    if (onlyUserId) q = q.eq("user_id", onlyUserId);

    // If caller specified since filter, apply it
    if (sinceParam) q = q.gte("created_at", sinceParam);

    const { data: rows, error: qErr } = await q;

    if (qErr) {
      return json(500, {
        ok: false,
        runId,
        error: "db_query_failed",
        details: String(qErr.message || qErr),
      });
    }

    const logs = Array.isArray(rows) ? rows : [];
    const total_trades = logs.length;

    let wins = 0;
    let losses = 0;

    let net_realized_pnl_usd = 0;
    let fees_paid_usd = 0;

    const winBps: number[] = [];
    const lossBps: number[] = [];

    const equityCurve: number[] = [];
    let running_equity = 0;

    // last_24h window stats
    let last24_total_trades = 0;
    let last24_wins = 0;
    let last24_losses = 0;
    let last24_realized = 0;
    let last24_fees = 0;

    // Determine "since"
    const since =
      logs[0]?.created_at ||
      sinceParam ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const r of logs) {
      const pnlUsd = pickRealizedPnlUsd(r);
      const feeUsd = pickFeesUsd(r);
      const bps = pickPnlBps(r);
      const createdAt = r?.created_at ?? null;

      net_realized_pnl_usd += pnlUsd;
      fees_paid_usd += feeUsd;

      running_equity += pnlUsd - feeUsd;
      equityCurve.push(running_equity);

      if (pnlUsd > 0) {
        wins += 1;
        if (typeof bps === "number") winBps.push(bps);
      } else if (pnlUsd < 0) {
        losses += 1;
        if (typeof bps === "number") lossBps.push(bps);
      }

      if (isWithinLast24h(createdAt)) {
        last24_total_trades += 1;
        last24_realized += pnlUsd;
        last24_fees += feeUsd;
        if (pnlUsd > 0) last24_wins += 1;
        else if (pnlUsd < 0) last24_losses += 1;
      }
    }

    const win_rate = total_trades > 0 ? wins / total_trades : 0;

    const avg_win_bps =
      winBps.length > 0 ? winBps.reduce((a, b) => a + b, 0) / winBps.length : 0;

    const avg_loss_bps =
      lossBps.length > 0 ? lossBps.reduce((a, b) => a + b, 0) / lossBps.length : 0;

    const max_drawdown_pct = computeMaxDrawdownPct(equityCurve);

    // Open PnL: not available from logs alone (needs live position mark)
    const current_open_pnl_usd: number | null = null;

    return json(200, {
      ok: true,
      runId,
      auth: {
        mode: authMode,
        admin_email: authMode === "bearer" ? authedEmail : null,
        admin_user_id: authMode === "bearer" ? authedUserId : null,
      },

      // Filters applied
      user_id: onlyUserId || null,
      since,
      limit,

      // Core metrics
      total_trades,
      wins,
      losses,
      win_rate,

      avg_win_bps,
      avg_loss_bps,

      net_realized_pnl_usd: Number(net_realized_pnl_usd.toFixed(8)),
      fees_paid_usd: Number(fees_paid_usd.toFixed(8)),
      current_open_pnl_usd,

      running_equity: Number(running_equity.toFixed(8)),
      max_drawdown_pct: Number(max_drawdown_pct.toFixed(4)),

      // Last 24h snapshot
      last_24h: {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        total_trades: last24_total_trades,
        wins: last24_wins,
        losses: last24_losses,
        win_rate: last24_total_trades > 0 ? last24_wins / last24_total_trades : 0,
        net_realized_pnl_usd: Number(last24_realized.toFixed(8)),
        fees_paid_usd: Number(last24_fees.toFixed(8)),
      },

      // Debug (safe to remove later)
      debug: {
        rows_scanned: total_trades,
        fields_used: {
          pnl_usd: ["realized_pnl_usd", "pnl_usd", "net_pnl_usd", "realizedPnlUsd", "pnlUsd", "netPnlUsd"],
          fees_usd: ["fees_usd", "fee_usd", "feesUsd", "feeUsd", "commission_usd"],
          pnl_bps: ["pnl_bps", "pnlBps", "realized_bps", "realizedBps"],
        },
        generated_at: nowIso(),
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      runId: `pnl_${Math.random().toString(16).slice(2, 10)}`,
      error: String(e?.message || e),
    });
  }
}