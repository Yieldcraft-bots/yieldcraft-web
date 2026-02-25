// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------- helpers ----------
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
function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function shortId() {
  return crypto.randomBytes(6).toString("hex");
}

// ---------- auth (admin-only) ----------
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

// ---------- extractors from your schema ----------
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
  // your table has symbol; raw has request.product_id
  const sym = cleanString(row?.symbol);
  if (sym) return sym;
  const raw = row?.raw;
  const rp =
    raw?.request?.product_id ||
    raw?.response?.success_response?.product_id ||
    raw?.success_response?.product_id ||
    "";
  return cleanString(rp) || "BTC-USD";
}

function extractTs(row: any): string {
  return (
    toIsoMaybe(row?.created_at) ||
    toIsoMaybe(row?.t) ||
    new Date().toISOString()
  );
}

function extractQuoteSize(row: any): number | null {
  const q = Number(row?.quote_size);
  return Number.isFinite(q) && q > 0 ? q : null;
}

// ---------- Coinbase auth + fetch ----------
function normalizePem(pem: string) {
  let s = pem.trim();
  s = s.replace(/^"+|"+$/g, "");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\r\n/g, "\n");
  return s;
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// CDP JWT for Coinbase Brokerage API (ES256)
function buildCoinbaseJwtES256(opts: {
  apiKeyName: string;
  privateKeyPem: string;
  method: "GET" | "POST";
  path: string; // e.g. /api/v3/brokerage/orders/historical/<id>
}) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const uri = `${opts.method} api.coinbase.com${opts.path}`;

  const header = {
    alg: "ES256",
    typ: "JWT",
    kid: opts.apiKeyName,
    nonce,
  };

  const payload = {
    iss: "cdp",
    nbf: now,
    exp: now + 60,
    sub: opts.apiKeyName,
    uri,
  };

  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;

  const key = normalizePem(opts.privateKeyPem);

  // sign returns DER; convert to JOSE (r||s)
  const derSig = crypto.sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "der",
  });

  // DER -> JOSE
  function derToJose(sig: Buffer, size = 32) {
    // minimal DER parser for ECDSA signatures
    let offset = 0;
    if (sig[offset++] !== 0x30) throw new Error("bad_der");
    const seqLen = sig[offset++];
    offset += seqLen >= 128 ? (seqLen & 0x7f) : 0;
    if (sig[offset++] !== 0x02) throw new Error("bad_der_r");
    const rLen = sig[offset++];
    let r = sig.slice(offset, offset + rLen);
    offset += rLen;
    if (sig[offset++] !== 0x02) throw new Error("bad_der_s");
    const sLen = sig[offset++];
    let s = sig.slice(offset, offset + sLen);

    // pad/trim
    if (r.length > size) r = r.slice(r.length - size);
    if (s.length > size) s = s.slice(s.length - size);
    if (r.length < size) r = Buffer.concat([Buffer.alloc(size - r.length, 0), r]);
    if (s.length < size) s = Buffer.concat([Buffer.alloc(size - s.length, 0), s]);

    return Buffer.concat([r, s]);
  }

  const joseSig = derToJose(derSig);
  const encSig = base64url(joseSig);

  return `${signingInput}.${encSig}`;
}

async function coinbaseGet(path: string) {
  const apiKeyName = requireEnv("COINBASE_API_KEY_NAME");
  const privateKeyPem = requireEnv("COINBASE_PRIVATE_KEY");

  const jwt = buildCoinbaseJwtES256({
    apiKeyName,
    privateKeyPem,
    method: "GET",
    path,
  });

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: res.status, ok: res.ok, data };
}

// fetch order details (historical)
async function fetchOrder(orderId: string) {
  // Coinbase brokerage historical order endpoint
  return coinbaseGet(`/api/v3/brokerage/orders/historical/${encodeURIComponent(orderId)}`);
}

function toNum(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// ---------- PnL core (FIFO, realized only + open mark) ----------
type Fill = {
  ts: string;
  side: "BUY" | "SELL";
  qty: number;      // base BTC
  price: number;    // USD per BTC
  feeUsd: number;   // USD
};

type OpenLot = { ts: string; qty: number; costUsd: number; feeUsd: number };

function fifoPnL(fills: Fill[]) {
  const sorted = [...fills].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const open: OpenLot[] = [];
  let realized = 0;
  let fees = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;

  for (const f of sorted) {
    fees += f.feeUsd || 0;

    if (f.side === "BUY") {
      open.push({
        ts: f.ts,
        qty: f.qty,
        costUsd: f.qty * f.price,
        feeUsd: f.feeUsd || 0,
      });
      continue;
    }

    // SELL
    let sellQty = f.qty;
    const sellPrice = f.price;

    while (sellQty > 0 && open.length > 0) {
      const lot = open[0];
      const take = Math.min(lot.qty, sellQty);

      const costPortion = lot.costUsd * (take / lot.qty);
      const proceeds = take * sellPrice;

      const pnl = proceeds - costPortion;
      realized += pnl;

      trades += 1;
      if (pnl > 0) wins += 1;
      if (pnl < 0) losses += 1;

      // shrink lot
      lot.qty -= take;
      lot.costUsd -= costPortion;

      sellQty -= take;

      if (lot.qty <= 1e-12) open.shift();
    }
  }

  const openQty = open.reduce((s, l) => s + l.qty, 0);
  const openCost = open.reduce((s, l) => s + l.costUsd, 0);

  return {
    realizedPnlUsd: Number(realized.toFixed(2)),
    feesPaidUsd: Number(fees.toFixed(2)),
    totalTrades: trades,
    wins,
    losses,
    win_rate: trades > 0 ? Number(((wins / trades) * 100).toFixed(2)) : 0,
    openQty: Number(openQty.toFixed(8)),
    openCostUsd: Number(openCost.toFixed(2)),
  };
}

async function fetchSpot(productId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/api/v3/brokerage/products/${encodeURIComponent(productId)}`,
      { method: "GET", cache: "no-store" }
    );
    const j = await res.json().catch(() => null);
    const p = toNum(j?.price || j?.product?.price || j?.data?.price);
    return p > 0 ? p : null;
  } catch {
    return null;
  }
}

// ---------- handler ----------
export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const user_id = cleanString(url.searchParams.get("user_id")) || null;

  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso =
    toIsoMaybe(sinceParam) ||
    new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString();

  const limit = Math.min(5000, Math.max(50, num(url.searchParams.get("limit"), 1000)));
  const runId = `pnl_${shortId()}`;

  try {
    const client = sb();

    let q = client
      .from("trade_logs")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);

    const { data, error } = await q;
    if (error) return json(500, { ok: false, runId, error: error.message || error });

    const rows = Array.isArray(data) ? data : [];

    // Build unique orders from rows (BUY/SELL only)
    const orders = rows
      .map((r: any) => {
        const orderId = extractOrderId(r);
        const side = extractSide(r);
        if (!orderId || !side) return null;
        return {
          orderId,
          side,
          productId: extractProductId(r),
          ts: extractTs(r),
          quoteSize: extractQuoteSize(r), // often 1.00 for BUYs
        };
      })
      .filter(Boolean) as Array<{ orderId: string; side: "BUY" | "SELL"; productId: string; ts: string; quoteSize: number | null }>;

    const uniqueOrderIds = Array.from(new Set(orders.map((o) => o.orderId)));

    // Pull fills/details from Coinbase
    let coinbase_ok = 0;
    let coinbase_fail = 0;
    let coinbase_last_status: number | null = null;
    let coinbase_error: string | null = null;

    const fills: Fill[] = [];

    for (const oid of uniqueOrderIds) {
      const r = await fetchOrder(oid);
      coinbase_last_status = r.status;

      if (!r.ok) {
        coinbase_fail += 1;
        coinbase_error = JSON.stringify(r.data)?.slice(0, 300) || "coinbase_error";
        continue;
      }

      coinbase_ok += 1;

      const order = r.data?.order || r.data?.data?.order || r.data;

      // Coinbase shapes vary; try common fields
      const filledSize =
        toNum(order?.filled_size || order?.filled_quantity || order?.filled_value?.value || order?.filled_value);
      const avgFilledPrice =
        toNum(order?.average_filled_price || order?.avg_filled_price || order?.average_filled_price?.value);

      const side = cleanString(order?.side || "").toUpperCase() as "BUY" | "SELL";
      const createdTime = order?.created_time || order?.created_at || null;
      const ts = toIsoMaybe(createdTime) || new Date().toISOString();

      // fees (best effort)
      const feeUsd =
        toNum(order?.total_fees?.value) ||
        toNum(order?.total_fees) ||
        toNum(order?.fees?.value) ||
        toNum(order?.fees) ||
        0;

      // If Coinbase doesn't give filled size/avg price reliably, we cannot compute that order
      if (!(filledSize > 0) || !(avgFilledPrice > 0) || !(side === "BUY" || side === "SELL")) {
        continue;
      }

      fills.push({
        ts,
        side,
        qty: filledSize,
        price: avgFilledPrice,
        feeUsd,
      });
    }

    const statsAll = fifoPnL(fills);

    const productId = orders[0]?.productId || "BTC-USD";
    const spot = await fetchSpot(productId);

    const openValue = spot ? statsAll.openQty * spot : null;
    const openPnl = spot ? openValue - statsAll.openCostUsd : null;

    const payload = {
      ok: true,
      runId,
      user_id,
      since: sinceIso,
      rows_scanned: rows.length,
      order_ids_found: uniqueOrderIds.length,
      source: "db_rows+coinbase_orders",

      coinbase_fills_used: fills.length,
      coinbase_ok,
      coinbase_fail,
      coinbase_last_status,
      coinbase_error,

      fills_used: fills.length,
      total_trades: statsAll.totalTrades,
      wins: statsAll.wins,
      losses: statsAll.losses,
      win_rate: statsAll.win_rate,

      net_realized_pnl_usd: statsAll.realizedPnlUsd,
      fees_paid_usd: statsAll.feesPaidUsd,

      current_open_pnl_usd: openPnl !== null ? Number(openPnl.toFixed(2)) : null,
      open_position_base: statsAll.openQty,
      open_cost_usd: statsAll.openCostUsd,

      running_equity: Number(statsAll.realizedPnlUsd.toFixed(2)),
      max_drawdown_pct: 0, // we can add equity curve/mdd after we confirm fills are flowing

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
        supabase_host: new URL(requireEnv("SUPABASE_URL")).host,
        product_id_used_for_spot: productId,
        spot_price: spot,
        example_first_order_id: uniqueOrderIds[0] || null,
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}