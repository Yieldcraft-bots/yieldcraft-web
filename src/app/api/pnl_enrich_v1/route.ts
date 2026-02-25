// src/app/api/pnl_enrich_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------- helpers ----------
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
function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}
function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function shortId() {
  return crypto.randomBytes(6).toString("hex");
}

// ---------- auth (admin-only) ----------
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

// ---------- supabase ----------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- fill extraction (best-effort) ----------
// We try many shapes because your raw payload has varied nesting.
function asNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function digFills(raw: any): any[] {
  const j = raw ?? {};
  const candidates = [
    j?.fills,
    j?.fill,
    j?.order?.fills,
    j?.order?.executions,
    j?.response?.fills,
    j?.response?.order?.fills,
    j?.success_response?.fills,
    j?.success_response?.order?.fills,
    j?.resp?.fills,
    j?.resp?.order?.fills,
    j?.data?.fills,
    j?.result?.fills,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  return [];
}

// Returns VWAP price + base size + quote size computed from fills (if present)
function computeFromFills(fills: any[]) {
  // Coinbase fills often have: price, size (base), commission/fee, etc.
  // We compute:
  // - base = sum(size)
  // - quote = sum(price*size)
  let base = 0;
  let quote = 0;
  let vwap = 0;

  for (const f of fills) {
    const px =
      asNum(f?.price) ??
      asNum(f?.fill_price) ??
      asNum(f?.trade_price) ??
      asNum(f?.execution_price) ??
      asNum(f?.avg_price);

    const sz =
      asNum(f?.size) ??
      asNum(f?.base_size) ??
      asNum(f?.filled_size) ??
      asNum(f?.quantity) ??
      asNum(f?.base_qty);

    if (!px || !sz) continue;

    base += sz;
    quote += px * sz;
  }

  if (base > 0 && quote > 0) vwap = quote / base;

  return {
    price: vwap > 0 ? Number(vwap.toFixed(2)) : null,
    base_size: base > 0 ? Number(base.toFixed(8)) : null,
    quote_size: quote > 0 ? Number(quote.toFixed(2)) : null,
  };
}

async function patchRow(
  client: ReturnType<typeof sb>,
  row: any
): Promise<{ order_id: string; patched: boolean; patch: any }> {
  const order_id = cleanString(row?.order_id);
  if (!order_id) return { order_id: "", patched: false, patch: {} };

  const raw = row?.raw ?? {};
  const fills = digFills(raw);

  const patch: any = {};

  // Only fill what is missing
  const missingPrice = row?.price == null;
  const missingBase = row?.base_size == null;
  const missingQuote = row?.quote_size == null;

  if (fills.length) {
    const computed = computeFromFills(fills);
    if (missingPrice && computed.price != null) patch.price = computed.price;
    if (missingBase && computed.base_size != null) patch.base_size = computed.base_size;
    if (missingQuote && computed.quote_size != null) patch.quote_size = computed.quote_size;
  }

  // If still missing and you logged quote_size=1.00, we can back into base if price exists in raw somewhere
  // (This is a fallback — will not be perfect but avoids all-null.)
  if ((missingBase || missingPrice) && Object.keys(patch).length === 0) {
    const px =
      asNum(raw?.price) ??
      asNum(raw?.order?.price) ??
      asNum(raw?.response?.price) ??
      asNum(raw?.response?.order?.average_filled_price) ??
      asNum(raw?.response?.order?.avg_filled_price) ??
      asNum(raw?.response?.order?.filled_average_price);

    const quote =
      asNum(row?.quote_size) ??
      asNum(raw?.quote_size) ??
      asNum(raw?.request?.order_configuration?.market_market_ioc?.quote_size) ??
      asNum(raw?.request?.order_configuration?.market_ioc?.quote_size);

    if (missingPrice && px && px > 0) patch.price = Number(px.toFixed(2));
    if (missingBase && px && px > 0 && quote && quote > 0) {
      patch.base_size = Number((quote / px).toFixed(8));
    }
  }

  // Nothing to patch
  if (Object.keys(patch).length === 0) {
    return { order_id, patched: false, patch: {} };
  }

  const { error } = await client
    .from("trade_logs")
    .update(patch)
    .eq("order_id", order_id);

  if (error) throw new Error(`supabase_update_failed: ${error.message || String(error)}`);

  return { order_id, patched: true, patch };
}

export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const runId = `enrich_${shortId()}`;

  const order_id = cleanString(url.searchParams.get("order_id"));
  const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit"), 25)));

  try {
    const client = sb();

    let q = client
      .from("trade_logs")
      .select("*")
      .not("order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    // If a specific order_id is provided, only enrich that.
    if (order_id) {
      q = client
        .from("trade_logs")
        .select("*")
        .eq("order_id", order_id)
        .limit(50);
    } else {
      // Only rows that are missing key fields
      // NOTE: Supabase OR syntax can be finicky; this is the safest simple approach:
      // pull recent rows then patch what’s missing in code.
    }

    const { data, error } = await q;
    if (error) return json(500, { ok: false, runId, error: error.message || error });

    const rows = Array.isArray(data) ? data : [];
    const toProcess = order_id
      ? rows
      : rows.filter((r: any) => r?.price == null || r?.base_size == null || r?.quote_size == null);

    let updated = 0;
    const details: any[] = [];

    for (const r of toProcess) {
      const oid = cleanString(r?.order_id);
      if (!oid) continue;

      try {
        const res = await patchRow(client, r);
        if (res.patched) updated += 1;
        details.push({ order_id: res.order_id, ok: true, patch: res.patch });
      } catch (e: any) {
        details.push({ order_id: oid, ok: false, error: String(e?.message || e) });
      }
    }

    return json(200, {
      ok: true,
      runId,
      requested_order_id: order_id || null,
      scanned: rows.length,
      processed: toProcess.length,
      updated,
      details,
      note:
        "This enrich route fills price/base/quote only if the data exists in raw payloads. If raw has no fills/avg price, you must log fills at execution time or query Coinbase order details server-side.",
    });
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}