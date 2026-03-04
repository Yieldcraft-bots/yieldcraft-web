// src/app/api/admin/institutional-snapshot/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

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

/**
 * Server-side Supabase admin client (service role) – used for reads.
 */
function sbAdmin() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Supabase "user" client – used ONLY to validate the requesting user via JWT.
 * Uses anon key so we can call auth.getUser(token).
 */
function sbUser() {
  const url = requireEnv("SUPABASE_URL");
  const anon =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!anon) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)");
  return createClient(url, anon, { auth: { persistSession: false } });
}

/**
 * Old secret-based auth (kept for cron/internal calls).
 */
function okSecretAuth(req: Request) {
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

/**
 * NEW: Browser-safe admin auth
 * - Accepts Supabase session JWT via Authorization: Bearer <token>
 * - Valid if token belongs to ADMIN_USER_ID
 */
async function okSupabaseAdmin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;

  try {
    const supa = sbUser();
    const { data, error } = await supa.auth.getUser(token);
    if (error) return false;
    const userId = data?.user?.id || "";
    return userId === ADMIN_USER_ID;
  } catch {
    return false;
  }
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  // ✅ Allow either:
  // 1) secret header/query (cron/internal)
  // 2) logged-in supabase user == ADMIN_USER_ID (browser admin dashboard)
  const isAuthed = okSecretAuth(req) || (await okSupabaseAdmin(req));
  if (!isAuthed) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);

  const coreUserId =
    (url.searchParams.get("core_user_id") || process.env.CORE_FUND_USER_ID || "").trim() || null;

  const limitTrades = Math.max(1, Math.min(200, num(url.searchParams.get("limit_trades"), 50)));

  const client = sbAdmin();

  // 1) Institutional Snapshot
  const inst = await client
    .from("institutional_snapshot_v1")
    .select("*")
    .limit(1)
    .maybeSingle();

  // 2) CoreFund snapshot
  let coreSnapshot: any = null;
  let coreSnapshotSource: string | null = null;

  if (coreUserId) {
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

  // 3) Recent CoreFund trades
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
      "Auth: either secret header/query OR Supabase logged-in ADMIN_USER_ID via Authorization Bearer token.",
  });
}