// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}
function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}
function toIsoMaybe(x: any): string | null {
  const s = cleanString(x);
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}
function nowIso() {
  return new Date().toISOString();
}
function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function shortId() {
  return crypto.randomBytes(6).toString("hex");
}

// Accepts: ?secret= , x-admin-secret , x-cron-secret , authorization: Bearer <secret>
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
    req.headers.get("authorization") ||
    "";

  if (h === secret || h === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function extractOrderId(row: any): string | null {
  const direct = cleanString(row?.order_id);
  if (direct) return direct;
  const raw = row?.raw;
  const oid =
    raw?.response?.success_response?.order_id ||
    raw?.success_response?.order_id ||
    raw?.order_id ||
    raw?.response?.order_id ||
    null;
  return cleanString(oid) || null;
}

function extractSide(row: any): "BUY" | "SELL" | null {
  const s = cleanString(row?.side).toUpperCase();
  if (s === "BUY" || s === "SELL") return s;
  const raw = row?.raw;
  const rs =
    raw?.request?.side ||
    raw?.response?.success_response?.side ||
    raw?.success_response?.side ||
    raw?.response?.side ||
    "";
  const up = cleanString(rs).toUpperCase();
  return up === "BUY" || up === "SELL" ? up : null;
}

function extractProductId(row: any): string {
  const p = cleanString(row?.product_id) || cleanString(row?.symbol);
  if (p) return p;
  const raw = row?.raw;
  const rp =
    raw?.request?.product_id ||
    raw?.response?.success_response?.product_id ||
    raw?.success_response?.product_id ||
    "";
  return cleanString(rp) || "BTC-USD";
}

export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const user_id = cleanString(url.searchParams.get("user_id")) || null;

  // If user doesn't pass since, default 90 days so we ALWAYS see rows
  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso =
    toIsoMaybe(sinceParam) ||
    new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  const limit = Math.min(5000, Math.max(50, num(url.searchParams.get("limit"), 1000)));
  const runId = `pnl_${shortId()}`;

  try {
    const client = sb();

    // Probe 1: total rows in last 365 days (cheap sample)
    const since365 = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    const probe = await client
      .from("trade_logs")
      .select("id,created_at,side,order_id,product_id,symbol,quote_size,base_size,price,raw", { count: "exact" })
      .gte("created_at", since365)
      .order("created_at", { ascending: false })
      .limit(5);

    // Main query
    let q = client
      .from("trade_logs")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);

    const { data, error } = await q;
    if (error) {
      return json(500, {
        ok: false,
        runId,
        error: error.message || error,
        db_probe: {
          supabase_host: new URL(requireEnv("SUPABASE_URL")).host,
          probe_error: probe.error?.message || probe.error || null,
          probe_count: probe.count ?? null,
          probe_rows: probe.data ?? null,
        },
      });
    }

    const rows = Array.isArray(data) ? data : [];

    const orders = rows
      .map((r: any) => {
        const orderId = extractOrderId(r);
        const side = extractSide(r);
        if (!orderId || !side) return null;
        return { orderId, side, productId: extractProductId(r) };
      })
      .filter(Boolean) as { orderId: string; side: "BUY" | "SELL"; productId: string }[];

    const payload = {
      ok: true,
      runId,
      user_id,
      since: sinceIso,
      rows_scanned: rows.length,
      order_ids_found: orders.length,

      // TEMP: prove what DB/table we are actually seeing
      db_probe: {
        supabase_host: new URL(requireEnv("SUPABASE_URL")).host,
        probe_count_last_365d: probe.count ?? null,
        probe_error: probe.error?.message || probe.error || null,
        probe_latest_rows: probe.data ?? null,
      },

      // Leave these in place so UI doesn't break
      coinbase_fills_used: 0,
      coinbase_ok: 0,
      coinbase_fail: 0,
      coinbase_last_status: null,
      coinbase_error: null,

      fills_used: 0,
      total_trades: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      avg_win_bps: 0,
      avg_loss_bps: 0,
      net_realized_pnl_usd: 0,
      fees_paid_usd: 0,
      current_open_pnl_usd: null,
      open_position_base: 0,
      open_cost_usd: 0,
      running_equity: 0,
      max_drawdown_pct: 0,
      last_24h: {
        since: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        total_trades: 0,
        wins: 0,
        losses: 0,
        win_rate: 0,
        net_realized_pnl_usd: 0,
        fees_paid_usd: 0,
      },
      debug: {
        example_first_order_id: orders[0]?.orderId || null,
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}