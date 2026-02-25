// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------------- helpers ----------------
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
function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function nowIso() {
  return new Date().toISOString();
}
function toIsoMaybe(x: any): string | null {
  const s = cleanString(x);
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}
function shortId() {
  return crypto.randomBytes(6).toString("hex");
}

// ---------------- auth (admin-only) ----------------
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

// ---------------- supabase ----------------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------- Coinbase CDP JWT (Advanced Trade) ----------------
function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePem(pem: string) {
  let s = (pem || "").trim();
  if (!s) return s;
  // strip wrapping quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  // turn literal \n into real newlines
  s = s.replace(/\\n/g, "\n");
  // normalize CRLF
  s = s.replace(/\r\n/g, "\n");
  return s.trim();
}

function signJwtCdp(params: {
  method: "GET" | "POST";
  pathWithQuery: string; // includes leading /api/...
  keyName: string; // organizations/.../apiKeys/...
  privateKeyPem: string;
  alg: "ES256" | "EdDSA";
}) {
  const { method, pathWithQuery, keyName } = params;
  const alg = params.alg;
  const privateKeyPem = normalizePem(params.privateKeyPem);

  const header: any = {
    alg: alg === "EdDSA" ? "EdDSA" : "ES256",
    typ: "JWT",
    kid: keyName,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const now = Math.floor(Date.now() / 1000);
  // Coinbase examples commonly use: "<METHOD> api.coinbase.com<PATH>"
  const uri = `${method} api.coinbase.com${pathWithQuery}`;

  const payload: any = {
    iss: "cdp",
    sub: keyName,
    nbf: now,
    exp: now + 60, // short-lived
    uri,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  let sig: Buffer;
  if (alg === "EdDSA") {
    // Ed25519
    sig = crypto.sign(null, Buffer.from(unsigned), privateKeyPem);
  } else {
    // ES256
    sig = crypto.sign("sha256", Buffer.from(unsigned), {
      key: privateKeyPem,
      dsaEncoding: "ieee-p1363",
    });
  }

  return `${unsigned}.${base64url(sig)}`;
}

async function coinbaseAuthedGet(path: string, qs: Record<string, string | number | undefined>) {
  const keyName = requireEnv("COINBASE_API_KEY_NAME");
  const privateKey = requireEnv("COINBASE_PRIVATE_KEY");
  const algRaw = (process.env.COINBASE_KEY_ALG || "ES256").toLowerCase();
  const alg: "ES256" | "EdDSA" = algRaw.includes("edd") ? "EdDSA" : "ES256";

  const url = new URL(`https://api.coinbase.com${path}`);
  Object.entries(qs).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    url.searchParams.append(k, String(v));
  });

  // IMPORTANT: uri must include query string if present
  const pathWithQuery = `${path}${url.search ? url.search : ""}`;
  const token = signJwtCdp({
    method: "GET",
    pathWithQuery,
    keyName,
    privateKeyPem: privateKey,
    alg,
  });

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text();
  const j = safeJsonParse(text);
  return { ok: res.ok, status: res.status, text, json: j };
}

// ---------------- types ----------------
type TradeRow = {
  created_at?: string;
  t?: string;
  user_id?: string;
  bot?: string;
  symbol?: string;
  product_id?: string;
  side?: string;
  order_id?: string;
  price?: number | string | null;
  base_size?: number | string | null;
  quote_size?: number | string | null;
  raw?: any; // jsonb
};

type NormalizedFill = {
  ts: string;
  side: "BUY" | "SELL";
  symbol: string;     // product_id
  price: number;      // USD
  baseQty: number;    // BTC amount
  usdNotional: number;// USD
  feeUsd: number;     // USD
  orderId?: string;
};

// ---------------- parsing from DB row ----------------
function pickTs(r: TradeRow): string {
  return toIsoMaybe(r.created_at) || toIsoMaybe((r as any).t) || nowIso();
}
function pickSymbol(r: TradeRow): string {
  return cleanString(r.symbol) || cleanString(r.product_id) || "BTC-USD";
}
function pickSide(r: TradeRow): "BUY" | "SELL" | null {
  const s = cleanString(r.side).toUpperCase();
  return s === "BUY" || s === "SELL" ? (s as any) : null;
}
function pickOrderId(r: TradeRow): string | null {
  const a = cleanString((r as any).order_id);
  const b = cleanString((r as any).raw?.success_response?.order_id);
  const c = cleanString((r as any).raw?.order_id);
  return a || b || c || null;
}

// Best-effort fee from stored raw (not reliable, fills will override)
function extractFeeUsdFromRaw(raw: any): number {
  try {
    const j = raw ?? {};
    const candidates = [
      j?.fee,
      j?.fees,
      j?.total_fees,
      j?.order?.total_fees,
      j?.order?.fees,
      j?.success_response?.order?.total_fees,
      j?.success_response?.order?.fees,
      j?.resp?.order?.total_fees,
      j?.resp?.order?.fees,
    ];
    for (const c of candidates) {
      if (c == null) continue;
      if (typeof c === "number" && Number.isFinite(c)) return c;
      if (typeof c === "string") {
        const n = Number(c);
        if (Number.isFinite(n)) return n;
      }
      if (typeof c === "object") {
        const v = Number((c as any)?.value);
        if (Number.isFinite(v)) return v;
      }
    }
  } catch {}
  return 0;
}

// Convert DB row into a “fill” only if it truly has enough info
function normalizeFromRow(r: TradeRow): NormalizedFill | null {
  const side = pickSide(r);
  if (!side) return null;

  const symbol = pickSymbol(r);
  const ts = pickTs(r);

  const px = Number((r as any).price);
  const base = Number((r as any).base_size);
  const quote = Number((r as any).quote_size);

  const hasPx = Number.isFinite(px) && px > 0;
  const hasBase = Number.isFinite(base) && base > 0;
  const hasQuote = Number.isFinite(quote) && quote > 0;

  // If we can’t compute BOTH baseQty and usdNotional, we should NOT use this row for PnL.
  // (This is the bug that was giving open_cost_usd with open_position_base = 0)
  let baseQty = 0;
  let usdNotional = 0;

  if (hasBase && hasPx) {
    baseQty = base;
    usdNotional = base * px;
  } else if (hasQuote && hasPx) {
    usdNotional = quote;
    baseQty = quote / px;
  } else if (hasBase && hasQuote) {
    baseQty = base;
    usdNotional = quote;
  } else {
    return null;
  }

  const feeUsd = extractFeeUsdFromRaw((r as any).raw);

  return {
    ts,
    side,
    symbol,
    price: hasPx ? px : usdNotional / baseQty,
    baseQty,
    usdNotional,
    feeUsd,
    orderId: pickOrderId(r) || undefined,
  };
}

// ---------------- Coinbase fills -> normalized ----------------
function normalizeFromCoinbaseFill(
  f: any,
  sideHint: "BUY" | "SELL" | null,
  symbolHint: string | null
): NormalizedFill | null {
  // Coinbase List Fills returns: price, size, commission, trade_time, product_id, order_id ...
  const price = Number(f?.price);
  const size = Number(f?.size);
  const commission = Number(f?.commission);

  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(size) || size <= 0) return null;

  const symbol = cleanString(f?.product_id) || symbolHint || "BTC-USD";
  const ts = toIsoMaybe(f?.trade_time) || toIsoMaybe(f?.sequence_timestamp) || nowIso();

  const sideRaw = cleanString(f?.side).toUpperCase();
  const side: "BUY" | "SELL" | null =
    sideRaw === "BUY" || sideRaw === "SELL" ? (sideRaw as any) : sideHint;

  if (!side) return null;

  const usdNotional = price * size;
  const feeUsd = Number.isFinite(commission) && commission > 0 ? commission : 0;

  return {
    ts,
    side,
    symbol,
    price,
    baseQty: size,
    usdNotional,
    feeUsd,
    orderId: cleanString(f?.order_id) || undefined,
  };
}

// ---------------- FIFO match + metrics ----------------
type ClosedTrade = {
  openTs: string;
  closeTs: string;
  symbol: string;
  qty: number;
  buyPx: number;
  sellPx: number;
  pnlUsd: number;
  pnlBps: number | null;
  feesUsd: number;
};
type OpenLot = {
  ts: string;
  symbol: string;
  qty: number;
  costUsd: number;
  px: number;
  feesUsd: number;
};

function computeFromFills(fills: NormalizedFill[]) {
  const sorted = [...fills].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  const openLots: OpenLot[] = [];
  const closed: ClosedTrade[] = [];
  let feesPaid = 0;

  for (const f of sorted) {
    feesPaid += f.feeUsd || 0;

    if (f.side === "BUY") {
      openLots.push({
        ts: f.ts,
        symbol: f.symbol,
        qty: f.baseQty,
        costUsd: f.usdNotional,
        px: f.price,
        feesUsd: f.feeUsd || 0,
      });
      continue;
    }

    // SELL -> match FIFO
    let sellQty = f.baseQty;

    while (sellQty > 1e-12 && openLots.length > 0) {
      const lot = openLots[0];
      if (lot.symbol !== f.symbol) {
        openLots.shift();
        continue;
      }

      const takeQty = Math.min(lot.qty, sellQty);

      const lotCostPortion = lot.costUsd * (takeQty / lot.qty);
      const lotFeesPortion = lot.feesUsd * (takeQty / lot.qty);

      const proceedsPortion = f.usdNotional * (takeQty / f.baseQty);
      const pnlUsd = proceedsPortion - lotCostPortion;

      const buyPx = lotCostPortion / takeQty;
      const sellPx = proceedsPortion / takeQty;
      const pnlBps =
        buyPx > 0 && sellPx > 0 ? ((sellPx - buyPx) / buyPx) * 10_000 : null;

      closed.push({
        openTs: lot.ts,
        closeTs: f.ts,
        symbol: f.symbol,
        qty: takeQty,
        buyPx,
        sellPx,
        pnlUsd: Number(pnlUsd.toFixed(2)),
        pnlBps: pnlBps === null ? null : Number(pnlBps.toFixed(2)),
        feesUsd: Number(((f.feeUsd || 0) + lotFeesPortion).toFixed(4)),
      });

      // reduce lot
      lot.qty -= takeQty;
      lot.costUsd -= lotCostPortion;
      lot.feesUsd -= lotFeesPortion;

      sellQty -= takeQty;

      if (lot.qty <= 1e-12) openLots.shift();
    }
  }

  const realizedPnlUsd = closed.reduce((s, t) => s + t.pnlUsd, 0);
  const wins = closed.filter((t) => t.pnlUsd > 0);
  const losses = closed.filter((t) => t.pnlUsd < 0);
  const winRate = closed.length ? wins.length / closed.length : 0;

  const avgWinBps =
    wins.length ? wins.map((t) => t.pnlBps).filter((x): x is number => typeof x === "number")
      .reduce((a, b) => a + b, 0) / wins.length : 0;

  const avgLossBps =
    losses.length ? losses.map((t) => t.pnlBps).filter((x): x is number => typeof x === "number")
      .reduce((a, b) => a + b, 0) / losses.length : 0;

  return {
    closed,
    openLots,
    realizedPnlUsd: Number(realizedPnlUsd.toFixed(2)),
    feesPaidUsd: Number(feesPaid.toFixed(2)),
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Number((winRate * 100).toFixed(2)),
    avg_win_bps: Number(avgWinBps.toFixed(2)),
    avg_loss_bps: Number(avgLossBps.toFixed(2)),
  };
}

function computeEquityAndMdd(closed: ClosedTrade[], startEquity = 0) {
  const s = [...closed].sort((a, b) => Date.parse(a.closeTs) - Date.parse(b.closeTs));
  let equity = startEquity;
  let peak = startEquity;
  let maxDdPct = 0;

  for (const t of s) {
    equity += t.pnlUsd;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }

  return {
    running_equity: Number(equity.toFixed(2)),
    max_drawdown_pct: Number(maxDdPct.toFixed(3)),
  };
}

// Public product endpoint (no auth)
async function fetchSpotPrice(productId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/api/v3/brokerage/products/${encodeURIComponent(productId)}`,
      { method: "GET", cache: "no-store" }
    );
    const text = await res.text();
    const j = safeJsonParse(text) as any;
    const p = Number(j?.price) || Number(j?.product?.price) || Number(j?.data?.price) || 0;
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

function computeOpenPnl(openLots: OpenLot[], spotPrice: number | null) {
  const totalQty = openLots.reduce((s, l) => s + l.qty, 0);
  const totalCost = openLots.reduce((s, l) => s + l.costUsd, 0);

  if (!spotPrice || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    return {
      open_position_base: Number(totalQty.toFixed(8)),
      open_cost_usd: Number(totalCost.toFixed(2)),
      current_open_pnl_usd: null as number | null,
      spot_price: null as number | null,
    };
  }

  const mktValue = totalQty * spotPrice;
  const openPnl = mktValue - totalCost;

  return {
    open_position_base: Number(totalQty.toFixed(8)),
    open_cost_usd: Number(totalCost.toFixed(2)),
    current_open_pnl_usd: Number(openPnl.toFixed(2)),
    spot_price: Number(spotPrice.toFixed(2)),
  };
}

// ---------------- handler ----------------
export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const user_id = cleanString(url.searchParams.get("user_id")) || null;

  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso =
    toIsoMaybe(sinceParam) ||
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const limit = Math.min(10_000, Math.max(100, num(url.searchParams.get("limit"), 5000)));
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
    if (error) return json(500, { ok: false, runId, error: error.message || String(error) });

    const rows = Array.isArray(data) ? (data as any as TradeRow[]) : [];

    // Build order_id -> side/symbol hints
    const orderHints = new Map<string, { side: "BUY" | "SELL"; symbol: string }>();
    for (const r of rows) {
      const oid = pickOrderId(r);
      const side = pickSide(r);
      if (!oid || !side) continue;
      orderHints.set(oid, { side, symbol: pickSymbol(r) });
    }

    const orderIds = Array.from(orderHints.keys());

    // 1) Try to compute from rows that truly contain fills (rare)
    const rowFills = rows.map(normalizeFromRow).filter((x): x is NormalizedFill => !!x);

    // 2) Pull Coinbase fills for all order_ids (the real source of truth)
    let cbFills: NormalizedFill[] = [];
    let cb_status: number | null = null;
    let cb_error: string | null = null;

    if (orderIds.length > 0) {
      // Batch order_ids into chunks (avoid huge URLs)
      const CHUNK = 40;
      for (let i = 0; i < orderIds.length; i += CHUNK) {
        const chunk = orderIds.slice(i, i + CHUNK);

        // Coinbase expects repeated order_ids params: order_ids=a&order_ids=b...
        const qs: Record<string, string | number> = { limit: 1000 };
        // We'll append manually by building a query object with unique keys
        // (coinbaseAuthedGet uses URLSearchParams; we simulate repeats by unique keys)
        // We'll do it by calling coinbaseAuthedGet with no order_ids, then re-request with urlSearchParams inlined:
        const path = "/api/v3/brokerage/orders/historical/fills";

        // Build query string with repeats ourselves
        const u = new URL(`https://api.coinbase.com${path}`);
        u.searchParams.set("limit", "1000");
        for (const id of chunk) u.searchParams.append("order_ids", id);

        const pathWithQuery = `${path}${u.search}`;

        const keyName = requireEnv("COINBASE_API_KEY_NAME");
        const privateKey = requireEnv("COINBASE_PRIVATE_KEY");
        const algRaw = (process.env.COINBASE_KEY_ALG || "ES256").toLowerCase();
        const alg: "ES256" | "EdDSA" = algRaw.includes("edd") ? "EdDSA" : "ES256";

        const token = signJwtCdp({
          method: "GET",
          pathWithQuery,
          keyName,
          privateKeyPem: privateKey,
          alg,
        });

        const res = await fetch(u.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        cb_status = res.status;
        const text = await res.text();
        const j = safeJsonParse(text);

        if (!res.ok) {
          cb_error = `coinbase_fills_failed status=${res.status} body=${text.slice(0, 300)}`;
          break;
        }

        const fillsArr = Array.isArray(j?.fills) ? j.fills : [];
        for (const f of fillsArr) {
          const oid = cleanString(f?.order_id);
          const hint = oid ? orderHints.get(oid) : undefined;
          const nf = normalizeFromCoinbaseFill(f, hint?.side || null, hint?.symbol || null);
          if (nf) cbFills.push(nf);
        }
      }
    }

    // Prefer Coinbase fills when available; otherwise fall back to rowFills
    const fillsAll = cbFills.length > 0 ? cbFills : rowFills;

    const full = computeFromFills(fillsAll);
    const equity = computeEquityAndMdd(full.closed, 0);

    const last24Iso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const fills24 = fillsAll.filter((f) => Date.parse(f.ts) >= Date.parse(last24Iso));
    const last24 = computeFromFills(fills24);

    const symbol =
      fillsAll.find((f) => f.symbol && f.symbol !== "UNKNOWN")?.symbol || "BTC-USD";

    const spot = await fetchSpotPrice(symbol);
    const open = computeOpenPnl(full.openLots, spot);

    return json(200, {
      ok: true,
      runId,
      user_id,
      since: sinceIso,

      rows_scanned: rows.length,
      order_ids_found: orderIds.length,

      // Diagnostics: prove where numbers came from
      source: cbFills.length > 0 ? "coinbase_fills" : "db_rows",
      coinbase_fills_used: cbFills.length,
      coinbase_last_status: cb_status,
      coinbase_error: cb_error,

      fills_used: fillsAll.length,

      total_trades: full.totalTrades,
      wins: full.wins,
      losses: full.losses,
      win_rate: full.win_rate,
      avg_win_bps: full.avg_win_bps,
      avg_loss_bps: full.avg_loss_bps,
      net_realized_pnl_usd: full.realizedPnlUsd,
      fees_paid_usd: full.feesPaidUsd,

      current_open_pnl_usd: open.current_open_pnl_usd,
      open_position_base: open.open_position_base,
      open_cost_usd: open.open_cost_usd,

      running_equity: equity.running_equity,
      max_drawdown_pct: equity.max_drawdown_pct,

      last_24h: {
        since: last24Iso,
        total_trades: last24.totalTrades,
        wins: last24.wins,
        losses: last24.losses,
        win_rate: last24.win_rate,
        net_realized_pnl_usd: last24.realizedPnlUsd,
        fees_paid_usd: last24.feesPaidUsd,
      },

      debug: {
        symbol_used_for_spot: symbol,
        spot_price: open.spot_price,
        limit,
        example_first_order_id: orderIds[0] || null,
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}