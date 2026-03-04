// src/app/api/admin/institutional-snapshot/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function okAdminAuth(req: Request) {
  const secret = (
    process.env.ADMIN_SECRET ||
    process.env.CRON_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();

  if (!secret) return false;

  const h =
    req.headers.get("x-admin-secret") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization");

  if (h && (h === secret || h === `Bearer ${secret}`)) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);

  // optional: allow selecting a specific CoreFund user_id for personal view
  const coreUserId =
    (url.searchParams.get("core_user_id") || process.env.CORE_FUND_USER_ID || "")
      .trim() || null;

  const limitTrades = Math.max(1, Math.min(200, num(url.searchParams.get("limit_trades"), 50)));

  const client = sb();

  // 1) Institutional Snapshot (view you already created)
  const inst = await client
    .from("institutional_snapshot_v1")
    .select("*")
    .limit(1)
    .maybeSingle();

  // 2) CoreFund snapshot:
  // Try a few common sources in order:
  // - user_account_snapshot (if you built it)
  // - pnl_snapshots (if exists)
  // - fallback: compute from equity_state for core user
  let coreSnapshot: any = null;
  let coreSnapshotSource: string | null = null;

  if (coreUserId) {
    // Try user_account_snapshot first
    const s1 = await client
      .from("user_account_snapshot")
      .select("*")
      .eq("user_id", coreUserId)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!s1.error && s1.data) {
      coreSnapshot = s1.data;
      coreSnapshotSource = "user_account_snapshot";
    } else {
      // Try pnl_snapshots (if your project uses this naming)
      const s2 = await client
        .from("pnl_snapshots")
        .select("*")
        .eq("user_id", coreUserId)
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!s2.error && s2.data) {
        coreSnapshot = s2.data;
        coreSnapshotSource = "pnl_snapshots";
      } else {
        // Fallback: equity_state (peak/last equity)
        const s3 = await client
          .from("equity_state")
          .select("user_id, peak_equity_usd, last_equity_usd, updated_at")
          .eq("user_id", coreUserId)
          .maybeSingle();

        if (!s3.error && s3.data) {
          coreSnapshot = {
            user_id: s3.data.user_id,
            peak_equity_usd: s3.data.peak_equity_usd,
            last_equity_usd: s3.data.last_equity_usd,
            updated_at: s3.data.updated_at,
          };
          coreSnapshotSource = "equity_state";
        }
      }
    }
  }

  // 3) Recent CoreFund trades (optional but super useful for daily review)
  // If you have corefund_trade_logs table, use it; otherwise fall back to trade_logs filtered by core user.
  let coreTrades: any[] = [];
  let coreTradesSource: string | null = null;

  if (coreUserId) {
    const t1 = await client
      .from("corefund_trade_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitTrades);

    if (!t1.error && Array.isArray(t1.data) && t1.data.length) {
      coreTrades = t1.data;
      coreTradesSource = "corefund_trade_logs";
    } else {
      const t2 = await client
        .from("trade_logs")
        .select("*")
        .eq("user_id", coreUserId)
        .order("created_at", { ascending: false })
        .limit(limitTrades);

      if (!t2.error && Array.isArray(t2.data)) {
        coreTrades = t2.data;
        coreTradesSource = "trade_logs (filtered by user_id)";
      }
    }
  }

  // response
  return json(200, {
    ok: true,
    as_of: new Date().toISOString(),
    institutional: {
      ok: !inst.error,
      error: inst.error ? (inst.error as any).message || inst.error : null,
      data: inst.data ?? null,
    },
    corefund: {
      core_user_id: coreUserId,
      snapshot_source: coreSnapshotSource,
      snapshot: coreSnapshot,
      trades_source: coreTradesSource,
      trades: coreTrades,
      limit_trades: limitTrades,
    },
    note:
      "Use ?secret=... (or x-admin-secret header). Optional: ?core_user_id=<uuid>&limit_trades=50",
  });
}