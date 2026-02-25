// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/** =========================
 *  Helpers
 *  ========================= */
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
function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
function normalizePem(pemLike: string) {
  let s = (pemLike || "").trim();
  if (!s) return s;
  // strip surrounding quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  // convert escaped newlines
  s = s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  return s.trim();
}

/** =========================
 *  Admin auth
 *  ========================= */
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

/** =========================
 *  Supabase
 *  ========================= */
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** =========================
 *  Coinbase JWT (CDP)
 *  ========================= *
 * We build the same style your engine uses:
 * - header: { alg, kid, nonce }
 * - payload: { iss:"cdp", sub:<COINBASE_API_KEY_NAME>, nbf, exp, uri:"<METHOD> api.coinbase.com<PATH>?<QS>" }
 *
 * Env expected:
 * - COINBASE_API_KEY_NAME   (resource name: organizations/.../apiKeys/...)
 * - COINBASE_API_KEY_ID     (KID / key id shown by Coinbase; sometimes last4)
 * - COINBASE_PRIVATE_KEY    (pem)
 * - COINBASE_KEY_ALG        ("ES256" or "ed25519"/"EdDSA")
 */
function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwtCdp(method: string, pathWithQuery: string) {
  const apiKeyName = cleanString(process.env.COINBASE_API_KEY_NAME);
  const kid = cleanString(process.env.COINBASE_API_KEY_ID) || apiKeyName; // fallback
  const algRaw = cleanString(process.env.COINBASE_KEY_ALG || "ES256");
  const keyAlg = algRaw.toLowerCase().includes("ed") ? "EdDSA" : "ES256";

  const privateKeyPem = normalizePem(requireEnv("COINBASE_PRIVATE_KEY"));

  const nonce = crypto.randomBytes(16).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60; // 60s

  const header = {
    alg: keyAlg,
    typ: "JWT",
    kid,
    nonce,
  };

  // Coinbase expects this exact format used by CDP keys:
  const uri = `${method.toUpperCase()} api.coinbase.com${pathWithQuery}`;

  const payload: any = {
    iss: "cdp",
    sub: apiKeyName || kid,
    nbf: now,
    exp,
    uri,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  if (keyAlg === "EdDSA") {
    // Node supports ed25519 via crypto.sign when key is correct PKCS8
    const sig = crypto.sign(null, Buffer.from(unsigned), privateKeyPem);
    return `${unsigned}.${base64url(sig)}`;
  } else {
    // ES256
    const sig = crypto.sign("sha256", Buffer.from(unsigned), {
      key: privateKeyPem,
      dsaEncoding: "ieee-p1363",
    });
    return `${unsigned}.${base64url(sig)}`;
  }
}

/** =========================
 *  Coinbase calls
 *  ========================= */
async function cbFetch(method: "GET" | "POST", pathWithQuery: string) {
  const token = signJwtCdp(method, pathWithQuery);
  const url = `https://api.coinbase.com${pathWithQuery}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  const j = safeJsonParse(text);
  return { status: res.status, ok: res.ok, text, json: j };
}

type CoinbaseFill = {
  trade_id?: string;
  order_id?: string;
  product_id?: string;
  side?: "BUY" | "SELL";
  price?: string;
  size?: string;
  commission?: string; // or fees depending
  fee?: string;
  created_time?: string;
  trade_time?: string;
};

function extractOrderId(row: any): string | null {
  const direct = cleanString(row?.order_id);
  if (direct) return direct;

  // raw.response.success_response.order_id
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

/** =========================
 *  Normalize fills (from Coinbase)
 *  ========================= */
type NormalizedFill = {
  ts: string;
  side: "BUY" | "SELL";
  symbol: string; // product_id
  price: number;      // avg fill price
  baseQty: number;    // filled base size
  usdNotional: number;// baseQty * price
  feeUsd: number;     // total fees if returned; else 0
  orderId: string;
};

function sumNum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

function normalizeCoinbaseFills(orderId: string, productId: string, side: "BUY" | "SELL", fills: CoinbaseFill[]) {
  // Sum sizes and compute VWAP
  const parsed = fills
    .map((f) => {
      const px = Number(f.price);
      const sz = Number(f.size);
      const fee = Number((f as any).commission ?? (f as any).fee ?? 0);
      const ts = toIsoMaybe((f as any).trade_time || (f as any).created_time || (f as any).trade_time) || nowIso();
      return {
        px: Number.isFinite(px) ? px : 0,
        sz: Number.isFinite(sz) ? sz : 0,
        fee: Number.isFinite(fee) ? fee : 0,
        ts,
      };
    })
    .filter((x) => x.px > 0 && x.sz > 0);

  if (parsed.length === 0) return null;

  const totalQty = sumNum(parsed.map((x) => x.sz));
  const notional = sumNum(parsed.map((x) => x.px * x.sz));
  const vwap = notional / totalQty;
  const feeUsd = sumNum(parsed.map((x) => x.fee));

  const lastTs = parsed[parsed.length - 1]?.ts || nowIso();

  return {
    ts: lastTs,
    side,
    symbol: productId,
    price: Number(vwap.toFixed(2)),
    baseQty: Number(totalQty.toFixed(8)),
    usdNotional: Number(notional.toFixed(2)),
    feeUsd: Number(feeUsd.toFixed(6)),
    orderId,
  } satisfies NormalizedFill;
}

/** =========================
 *  FIFO match + metrics
 *  ========================= */
type ClosedTrade = {
  openTs: string;
  closeTs: string;
  symbol: string;
  buyPx: number;
  sellPx: number;
  qty: number;
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

    // SELL
    let sellQty = f.baseQty;

    while (sellQty > 0 && openLots.length > 0) {
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

      const buyPx = lot.px || (lotCostPortion > 0 ? lotCostPortion / takeQty : 0);
      const sellPx = f.price || (proceedsPortion > 0 ? proceedsPortion / takeQty : 0);

      const pnlBps = buyPx > 0 && sellPx > 0 ? ((sellPx - buyPx) / buyPx) * 10_000 : null;

      closed.push({
        openTs: lot.ts,
        closeTs: f.ts,
        symbol: f.symbol,
        buyPx: Number(buyPx.toFixed(2)),
        sellPx: Number(sellPx.toFixed(2)),
        qty: Number(takeQty.toFixed(8)),
        pnlUsd: Number(pnlUsd.toFixed(4)),
        pnlBps: pnlBps == null ? null : Number(pnlBps.toFixed(2)),
        feesUsd: Number(((f.feeUsd || 0) + lotFeesPortion).toFixed(6)),
      });

      lot.qty -= takeQty;
      lot.costUsd -= lotCostPortion;
      lot.feesUsd -= lotFeesPortion;

      sellQty -= takeQty;

      if (lot.qty <= 1e-12) openLots.shift();
      if (sellQty <= 1e-12) break;
    }
  }

  const realizedPnlUsd = closed.reduce((s, t) => s + t.pnlUsd, 0);

  const wins = closed.filter((t) => t.pnlUsd > 0);
  const losses = closed.filter((t) => t.pnlUsd < 0);

  const winRate = closed.length > 0 ? wins.length / closed.length : 0;

  const avgWinBps =
    wins.length > 0
      ? wins
          .map((t) => t.pnlBps)
          .filter((x): x is number => typeof x === "number")
          .reduce((a, b) => a + b, 0) / wins.length
      : 0;

  const avgLossBps =
    losses.length > 0
      ? losses
          .map((t) => t.pnlBps)
          .filter((x): x is number => typeof x === "number")
          .reduce((a, b) => a + b, 0) / losses.length
      : 0;

  return {
    closed,
    openLots,
    realizedPnlUsd: Number(realizedPnlUsd.toFixed(2)),
    feesPaidUsd: Number(feesPaid.toFixed(6)),
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win_rate_pct: Number((winRate * 100).toFixed(2)),
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
    peak_equity: Number(peak.toFixed(2)),
    max_drawdown_pct: Number(maxDdPct.toFixed(3)),
  };
}

/** =========================
 *  Spot price (public)
 *  ========================= */
async function fetchSpotPrice(productId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/api/v3/brokerage/products/${encodeURIComponent(productId)}`,
      { method: "GET", cache: "no-store" }
    );
    const text = await res.text();
    const j = safeJsonParse(text) as any;

    const p =
      Number(j?.price) ||
      Number(j?.product?.price) ||
      Number(j?.data?.price) ||
      0;

    if (!Number.isFinite(p) || p <= 0) return null;
    return p;
  } catch {
    return null;
  }
}

function computeOpenPnl(openLots: OpenLot[], spot: number | null) {
  const totalQty = openLots.reduce((s, l) => s + (l.qty || 0), 0);
  const totalCost = openLots.reduce((s, l) => s + (l.costUsd || 0), 0);

  if (!spot || !Number.isFinite(spot) || spot <= 0) {
    return {
      open_position_base: Number(totalQty.toFixed(8)),
      open_cost_usd: Number(totalCost.toFixed(2)),
      spot_price: null as number | null,
      current_open_pnl_usd: null as number | null,
    };
  }

  const mkt = totalQty * spot;
  const openPnl = mkt - totalCost;

  return {
    open_position_base: Number(totalQty.toFixed(8)),
    open_cost_usd: Number(totalCost.toFixed(2)),
    spot_price: Number(spot.toFixed(2)),
    current_open_pnl_usd: Number(openPnl.toFixed(2)),
  };
}

/** =========================
 *  Main handler
 *  ========================= */
export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const user_id = cleanString(url.searchParams.get("user_id")) || null;

  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso =
    toIsoMaybe(sinceParam) ||
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const limit = Math.min(1000, Math.max(50, num(url.searchParams.get("limit"), 250))); // cap coinbase calls

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

    const rows = Array.isArray(data) ? (data as any[]) : [];

    // Pull order_ids from rows
    const orders = rows
      .map((r) => {
        const orderId = extractOrderId(r);
        if (!orderId) return null;
        const side = extractSide(r);
        if (!side) return null;
        const productId = extractProductId(r);
        return { orderId, side, productId, row: r };
      })
      .filter(Boolean) as { orderId: string; side: "BUY" | "SELL"; productId: string; row: any }[];

    // Deduplicate by orderId (keep first)
    const seen = new Set<string>();
    const uniqOrders = orders.filter((o) => {
      if (seen.has(o.orderId)) return false;
      seen.add(o.orderId);
      return true;
    });

    // Fetch Coinbase fills for each order
    const normalized: NormalizedFill[] = [];
    let coinbase_ok = 0;
    let coinbase_fail = 0;
    let lastCbStatus: number | null = null;
    let lastCbErr: any = null;

    for (const o of uniqOrders) {
      // 1) Try fills endpoint
      const fillsPath = `/api/v3/brokerage/orders/historical/fills?order_id=${encodeURIComponent(o.orderId)}`;
      let resp = await cbFetch("GET", fillsPath);
      lastCbStatus = resp.status;

      if (resp.ok) {
        const arr =
          resp.json?.fills ||
          resp.json?.data?.fills ||
          resp.json?.result?.fills ||
          resp.json?.orders ||
          null;

        const fills = Array.isArray(arr) ? (arr as any[]) : [];
        const norm = normalizeCoinbaseFills(o.orderId, o.productId, o.side, fills);
        if (norm) {
          normalized.push(norm);
          coinbase_ok += 1;
          continue;
        }
      }

      // 2) Fallback: order detail endpoint (some accounts return fills differently)
      const orderPath = `/api/v3/brokerage/orders/historical/${encodeURIComponent(o.orderId)}`;
      resp = await cbFetch("GET", orderPath);
      lastCbStatus = resp.status;

      if (resp.ok) {
        const ord =
          resp.json?.order ||
          resp.json?.data?.order ||
          resp.json?.result?.order ||
          resp.json?.data ||
          resp.json ||
          null;

        // Try extracting filled size + avg price if present
        const avgPx = Number(ord?.average_filled_price || ord?.average_fill_price || ord?.filled_average_price);
        const filledSz = Number(ord?.filled_size || ord?.filled_value?.size || ord?.filled_base_size || ord?.filled_size_in_quote);
        const fee = Number(ord?.total_fees || ord?.fee || 0);
        const ts = toIsoMaybe(ord?.completion_time || ord?.done_at || ord?.created_time || ord?.created_at) || nowIso();

        if (Number.isFinite(avgPx) && avgPx > 0 && Number.isFinite(filledSz) && filledSz > 0) {
          const notional = avgPx * filledSz;
          normalized.push({
            ts,
            side: o.side,
            symbol: o.productId,
            price: Number(avgPx.toFixed(2)),
            baseQty: Number(filledSz.toFixed(8)),
            usdNotional: Number(notional.toFixed(2)),
            feeUsd: Number.isFinite(fee) ? Number(fee.toFixed(6)) : 0,
            orderId: o.orderId,
          });
          coinbase_ok += 1;
          continue;
        }
      }

      // If we got here, Coinbase call failed (auth/endpoint mismatch/etc.)
      coinbase_fail += 1;
      lastCbErr = {
        order_id: o.orderId,
        fills_status: lastCbStatus,
        fills_body: resp.text?.slice(0, 500) || null,
      };

      // If auth is broken, stop early to avoid hammering
      if (lastCbStatus === 401 || lastCbStatus === 403) break;
    }

    // Compute PnL
    const full = computeFromFills(normalized);
    const equity = computeEquityAndMdd(full.closed, 0);

    const symbolForSpot = normalized.find((x) => x.symbol)?.symbol || "BTC-USD";
    const spot = await fetchSpotPrice(symbolForSpot);
    const open = computeOpenPnl(full.openLots, spot);

    // last 24h slice (based on normalized fill timestamps)
    const last24Iso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const fills24 = normalized.filter((f) => Date.parse(f.ts) >= Date.parse(last24Iso));
    const last24 = computeFromFills(fills24);

    const payload = {
      ok: true,
      runId,
      user_id,
      since: sinceIso,

      // db stats
      rows_scanned: rows.length,
      order_ids_found: uniqOrders.length,

      // coinbase stats
      coinbase_fills_used: normalized.length,
      coinbase_ok,
      coinbase_fail,
      coinbase_last_status: lastCbStatus,
      coinbase_error: lastCbErr,

      // scoreboard
      fills_used: normalized.length,
      total_trades: full.totalTrades,
      wins: full.wins,
      losses: full.losses,
      win_rate: full.win_rate_pct,
      avg_win_bps: full.avg_win_bps,
      avg_loss_bps: full.avg_loss_bps,
      net_realized_pnl_usd: full.realizedPnlUsd,
      fees_paid_usd: full.feesPaidUsd,

      // open + equity + DD
      current_open_pnl_usd: open.current_open_pnl_usd,
      open_position_base: open.open_position_base,
      open_cost_usd: open.open_cost_usd,
      running_equity: equity.running_equity,
      max_drawdown_pct: equity.max_drawdown_pct,

      // windows
      last_24h: {
        since: last24Iso,
        total_trades: last24.totalTrades,
        wins: last24.wins,
        losses: last24.losses,
        win_rate: last24.win_rate_pct,
        net_realized_pnl_usd: last24.realizedPnlUsd,
        fees_paid_usd: last24.feesPaidUsd,
      },

      debug: {
        symbol_used_for_spot: symbolForSpot,
        spot_price: open.spot_price,
        example_first_order_id: uniqOrders[0]?.orderId || null,
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}