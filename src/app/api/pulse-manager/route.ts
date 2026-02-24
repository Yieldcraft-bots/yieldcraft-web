// src/app/api/pulse-manager/route.ts
import { NextResponse } from "next/server";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const PRODUCT_ID = "BTC-USD";
const BOT_NAME = "pulse";

// If set, we ONLY run for this user_id (core fund safety gate)
const ONLY_USER_ID = (process.env.PULSE_ONLY_USER_ID || "").trim() || null;

// ---------- helpers ----------
function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}
function truthyDefault(v: string | undefined, def: boolean) {
  const s = (v || "").trim();
  if (!s) return def;
  return truthy(s);
}
function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}
function optEnv(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}
function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}
function normalizePem(pem: string) {
  let p = (pem || "").trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
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
function msSince(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}
async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}
function shortKeyName(s: string) {
  if (!s) return "";
  const last = s.slice(-6);
  return `…${last}`;
}
function minPositionBaseBtc() {
  const raw = (process.env.PULSE_MIN_POSITION_BASE_BTC || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 0.000001;
}
function fmtBaseSize(x: number) {
  const v = Math.max(0, x);
  return v.toFixed(8).replace(/\.?0+$/, "");
}
function fmtQuoteSizeUsd(x: number) {
  const v = Math.max(0.01, x);
  return v.toFixed(2);
}
function fmtPriceUsd(x: number) {
  const v = Math.max(0, x);
  return v.toFixed(2);
}
function uuid() {
  // Node 18+ typically supports crypto.randomUUID; guard anyway
  const anyCrypto = crypto as any;
  return typeof anyCrypto.randomUUID === "function"
    ? anyCrypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

// ---------- logging ----------
function log(runId: string, event: string, data?: any) {
  const payload = { t: nowIso(), runId, event, ...(data ? { data } : {}) };
  console.log("[pulse-manager]", JSON.stringify(payload));
}

// ---------- supabase ----------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Inserts into trade_logs with best-effort schema compatibility:
 * - Always uses created_at (not "t")
 * - If Supabase says "column X does not exist", we delete X and retry.
 */
async function writeTradeLog(row: Record<string, any>) {
  const client = sb();

  // Force table-friendly timestamp column name
  const payload: Record<string, any> = {
    created_at: row.created_at || nowIso(),
    ...row,
  };
  delete payload.t; // never send "t" (common cause of failures)

  // retry loop: strip unknown columns (up to 8 times)
  let attempt = 0;
  let lastErr: any = null;

  while (attempt < 8) {
    attempt++;
    const { error } = await client.from("trade_logs").insert([payload]);

    if (!error) {
      console.log(
        "[pulse-manager]",
        JSON.stringify({ t: nowIso(), event: "DB_WRITE_OK" })
      );
      return;
    }

    lastErr = error;
    const msg = String((error as any)?.message || error);

    console.log(
      "[pulse-manager]",
      JSON.stringify({
        t: nowIso(),
        event: "DB_WRITE_ERR",
        attempt,
        data: msg,
      })
    );

    // Example: column "equity_gov" of relation "trade_logs" does not exist
    const m = msg.match(
      /column\s+"([^"]+)"\s+of\s+relation\s+"trade_logs"\s+does\s+not\s+exist/i
    );
    if (m && m[1]) {
      const badCol = m[1];
      delete payload[badCol];
      continue; // retry after stripping column
    }

    // Some Supabase errors come formatted slightly differently:
    const m2 = msg.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (m2 && m2[1]) {
      const badCol = m2[1];
      delete payload[badCol];
      continue;
    }

    // Not a column-mismatch error -> stop retrying
    break;
  }

  // final exception trace (non-fatal)
  console.log(
    "[pulse-manager]",
    JSON.stringify({
      t: nowIso(),
      event: "DB_WRITE_GAVE_UP",
      data: String((lastErr as any)?.message || lastErr),
    })
  );
}

// ---------- auth ----------
function okAuth(req: Request) {
  const secret = (
    process.env.CRON_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();
  if (!secret) return false;

  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("x-pulse-secret") ||
    req.headers.get("authorization");

  if (h && (h === secret || h === `Bearer ${secret}`)) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

// ---------- Multi-user key source ----------
type KeyRow = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
};

function looksValidKeyRow(r: any): r is KeyRow {
  return !!(
    cleanString(r?.user_id) &&
    cleanString(r?.api_key_name).startsWith("organizations/") &&
    cleanString(r?.private_key).length > 0
  );
}

async function loadAllCoinbaseKeys(): Promise<
  { ok: true; rows: KeyRow[] } | { ok: false; error: any }
> {
  try {
    const client = sb();
    const { data, error } = await client
      .from("coinbase_keys")
      .select("user_id, api_key_name, private_key, key_alg");
    if (error) return { ok: false, error: error.message || error };
    const rows = Array.isArray(data) ? ((data as any) as KeyRow[]) : [];
    return { ok: true, rows: rows.filter(looksValidKeyRow) };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ---------- entitlements ----------
type Entitlements = { pulse: boolean; max_trade_size: number | null };

async function fetchEntitlements(user_id: string): Promise<Entitlements> {
  const defaultPulse = truthyDefault(process.env.PULSE_ENTITLED_DEFAULT, false);
  const defaultMax = num(process.env.PULSE_MAX_TRADE_SIZE_DEFAULT, 10);

  try {
    const client = sb();

    let data: any = null;
    let error: any = null;

    const r1 = await client
      .from("user_entitlements")
      .select("pulse, max_trade_size")
      .eq("user_id", user_id)
      .maybeSingle();

    data = r1.data;
    error = r1.error;

    if (error) {
      const r2 = await client
        .from("entitlements")
        .select("pulse, max_trade_size")
        .eq("user_id", user_id)
        .maybeSingle();
      data = r2.data;
      error = r2.error;
    }

    if (error || !data)
      return { pulse: defaultPulse, max_trade_size: defaultMax };

    const pulse =
      typeof (data as any).pulse === "boolean"
        ? (data as any).pulse
        : !!(data as any).pulse;

    const m = Number((data as any).max_trade_size);
    const max_trade_size = Number.isFinite(m) && m > 0 ? m : defaultMax;

    return { pulse, max_trade_size };
  } catch {
    return { pulse: defaultPulse, max_trade_size: defaultMax };
  }
}

// ---------- Coinbase CDP JWT ----------
type Ctx = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
};

function algFor(ctx: Ctx): "ES256" | "EdDSA" {
  const raw = (ctx.key_alg || "").toLowerCase();
  if (raw.includes("ed") || raw.includes("eddsa") || raw.includes("ed25519"))
    return "EdDSA";
  return "ES256";
}

function buildCdpJwt(ctx: Ctx, method: "GET" | "POST", path: string) {
  const apiKeyName = cleanString(ctx.api_key_name);
  const privateKeyPem = normalizePem(ctx.private_key);

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const pathForUri = path.split("?")[0];
  const uri = `${method} api.coinbase.com${pathForUri}`;

  const payload = { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri };

  const options: SignOptions = {
    algorithm: (algFor(ctx) === "EdDSA" ? "EdDSA" : "ES256") as any,
    header: { kid: apiKeyName, nonce } as any,
  };

  return jwt.sign(payload as any, privateKeyPem as any, options as any);
}

async function cbGet(ctx: Ctx, path: string) {
  const token = buildCdpJwt(ctx, "GET", path);
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

async function cbPost(ctx: Ctx, path: string, payload: any) {
  const token = buildCdpJwt(ctx, "POST", path);
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

// ---------- raw wrapper helper ----------
function mkRawWrapper(params: {
  kind: string;
  action: string;
  gates?: any;
  request?: any;
  payload?: any;
  response_status?: number | null;
  response?: any;
}) {
  return {
    kind: params.kind,
    action: params.action,
    ...(params.gates !== undefined ? { gates: params.gates } : {}),
    ...(params.request !== undefined ? { request: params.request } : {}),
    ...(params.payload !== undefined ? { payload: params.payload } : {}),
    ...(params.response_status !== undefined
      ? { response_status: params.response_status }
      : {}),
    ...(params.response !== undefined ? { response: params.response } : {}),
  };
}

// ---------- Recon gate (ENTRY ONLY enforcement; status always visible) ----------
type ReconSignal = {
  side?: string;
  confidence?: number;
  regime?: string;
  state?: string;
  marketRegime?: string;
  score?: number;
  conf?: number;
  [k: string]: any;
};

type ReconDecision = {
  enabled: boolean;
  mode: string;
  minConf: number;
  chopBlock: boolean;
  urlSet: boolean;
  ok: boolean;
  source: "disabled" | "url" | "error";
  regime: string | null;
  side: "BUY" | "SELL" | null;
  confidence: number | null;
  entryAllowed: boolean;
  reason: string;
};

function parseBool(v: any, def = false) {
  if (v === undefined || v === null) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}
function looksChoppy(regime: string) {
  const r = (regime || "").toLowerCase();
  return (
    r.includes("chop") ||
    r.includes("rotation") ||
    r.includes("range") ||
    r.includes("compression") ||
    r.includes("sideways")
  );
}

async function fetchReconDecision(): Promise<ReconDecision> {
  const enabled = parseBool(process.env.RECON_ENABLED, false);
  const mode = (process.env.RECON_MODE || "OFF").trim();
  const chopBlock = parseBool(process.env.RECON_CHOP_BLOCK, false);
  const minConf = num(process.env.RECON_MIN_CONF, 0.65);
  const url = (process.env.RECON_SIGNAL_URL || "").trim();
  const timeoutMs = num(process.env.RECON_TIMEOUT_MS, 2500);

  if (!enabled || mode !== "GATE_ENTRIES_ONLY") {
    return {
      enabled,
      mode,
      minConf,
      chopBlock,
      urlSet: !!url,
      ok: true,
      source: "disabled",
      regime: null,
      side: null,
      confidence: null,
      entryAllowed: true,
      reason: "recon_disabled_or_mode_off",
    };
  }

  if (!url) {
    return {
      enabled,
      mode,
      minConf,
      chopBlock,
      urlSet: false,
      ok: false,
      source: "error",
      regime: null,
      side: null,
      confidence: null,
      entryAllowed: true, // FAIL OPEN
      reason: "missing_RECON_SIGNAL_URL",
    };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });

    const text = await res.text();
    const j = safeJsonParse(text) as ReconSignal | null;

    if (!res.ok || !j || typeof j !== "object") {
      return {
        enabled,
        mode,
        minConf,
        chopBlock,
        urlSet: true,
        ok: false,
        source: "error",
        regime: null,
        side: null,
        confidence: null,
        entryAllowed: true, // FAIL OPEN
        reason: `recon_bad_response_status_${res.status}`,
      };
    }

    const regimeRaw = String(j.regime ?? j.state ?? j.marketRegime ?? "")
      .trim()
      .toLowerCase();

    const sideRaw = String(j.side || "").trim().toUpperCase();
    const side: "BUY" | "SELL" | null =
      sideRaw === "BUY" ? "BUY" : sideRaw === "SELL" ? "SELL" : null;

    const confRaw = j.confidence ?? j.conf ?? j.score;
    const confidence = Number.isFinite(Number(confRaw)) ? Number(confRaw) : null;

    const confident = confidence !== null && confidence >= minConf;
    const isChop = regimeRaw ? looksChoppy(regimeRaw) : false;

    const blocksOnSell = confident && side === "SELL";
    const blocksOnChop = confident && chopBlock && isChop;

    const entryAllowed = !(blocksOnSell || blocksOnChop);

    const why = entryAllowed
      ? "recon_allows_entries"
      : blocksOnSell
      ? `recon_blocks_entries_side_sell_conf_${confidence?.toFixed(2)}`
      : `recon_blocks_entries_chop_${regimeRaw}_conf_${confidence?.toFixed(2)}`;

    return {
      enabled,
      mode,
      minConf,
      chopBlock,
      urlSet: true,
      ok: true,
      source: "url",
      regime: regimeRaw || null,
      side,
      confidence,
      entryAllowed,
      reason: why,
    };
  } catch (e: any) {
    return {
      enabled,
      mode,
      minConf,
      chopBlock,
      urlSet: true,
      ok: false,
      source: "error",
      regime: null,
      side: null,
      confidence: null,
      entryAllowed: true, // FAIL OPEN
      reason: `recon_fetch_error_${String(e?.name || "unknown")}`,
    };
  } finally {
    clearTimeout(t);
  }
}

// ---------- price helpers ----------
async function fetchSpotPrice(
  ctx: Ctx
): Promise<{ ok: true; price: number } | { ok: false; error: any }> {
  const r = await cbGet(
    ctx,
    `/api/v3/brokerage/products/${encodeURIComponent(PRODUCT_ID)}`
  );
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const p =
    Number((r.json as any)?.price) ||
    Number((r.json as any)?.product?.price) ||
    Number((r.json as any)?.data?.price) ||
    0;

  if (!Number.isFinite(p) || p <= 0)
    return { ok: false, error: { bad_price: r.json } };
  return { ok: true, price: p };
}

// ---------- position ----------
async function fetchBtcPosition(ctx: Ctx) {
  const r = await cbGet(ctx, "/api/v3/brokerage/accounts");
  if (!r.ok) {
    return {
      ok: false as const,
      has_position: false,
      base_available: 0,
      status: r.status,
      coinbase: r.json ?? r.text,
    };
  }

  const accounts = (r.json as any)?.accounts || [];
  const btc = accounts.find((a: any) => a?.currency === "BTC");
  const available = Number(btc?.available_balance?.value || 0);

  const minPos = minPositionBaseBtc();
  return {
    ok: true as const,
    has_position: Number.isFinite(available) && available >= minPos,
    base_available: Number.isFinite(available) ? available : 0,
    min_pos: minPos,
  };
}

// ---------- equity governor ----------
type EquityGov = {
  enabled: boolean;
  ok: boolean;
  source: "disabled" | "db" | "error";
  equityUsd: number | null;
  peakEquityUsd: number | null;
  ddPct: number | null;
  multiplier: number;
  defense: boolean;
  reason: string;
};

async function fetchUsdAndBtcBalances(ctx: Ctx): Promise<
  | { ok: true; usd: number; btc: number }
  | { ok: false; error: any }
> {
  const r = await cbGet(ctx, "/api/v3/brokerage/accounts");
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const accounts = (r.json as any)?.accounts || [];
  const usdAcct = accounts.find((a: any) => a?.currency === "USD");
  const btcAcct = accounts.find((a: any) => a?.currency === "BTC");

  const usd = Number(usdAcct?.available_balance?.value || 0);
  const btc = Number(btcAcct?.available_balance?.value || 0);

  return {
    ok: true,
    usd: Number.isFinite(usd) ? usd : 0,
    btc: Number.isFinite(btc) ? btc : 0,
  };
}

function computeMultiplierFromDdPct(ddPct: number) {
  if (ddPct < 2) return 1.0;
  if (ddPct < 3) return 0.8;
  if (ddPct < 4) return 0.65;
  if (ddPct < 5) return 0.4;
  return 1.0; // defense mode gating handles the rest
}

async function getOrInitEquityState(user_id: string) {
  const client = sb();
  const r = await client
    .from("equity_state")
    .select("user_id, peak_equity_usd, last_equity_usd")
    .eq("user_id", user_id)
    .maybeSingle();

  if (r.error && !r.data) return { ok: false as const, error: r.error };
  if (!r.data) {
    const ins = await client.from("equity_state").insert([
      { user_id, peak_equity_usd: 0, last_equity_usd: 0 },
    ]);
    if (ins.error) return { ok: false as const, error: ins.error };
    return { ok: true as const, peak: 0, last: 0 };
  }

  return {
    ok: true as const,
    peak: Number((r.data as any).peak_equity_usd || 0),
    last: Number((r.data as any).last_equity_usd || 0),
  };
}

async function upsertEquityState(user_id: string, peak: number, last: number) {
  const client = sb();
  const u = await client
    .from("equity_state")
    .upsert(
      {
        user_id,
        peak_equity_usd: peak,
        last_equity_usd: last,
        updated_at: nowIso(),
      },
      { onConflict: "user_id" }
    );
  return { ok: !u.error, error: u.error };
}

async function computeEquityGovernor(
  ctx: Ctx,
  spotPrice: number
): Promise<EquityGov> {
  const enabled = truthyDefault(process.env.EQUITY_GOV_ENABLED, true);

  if (!enabled) {
    return {
      enabled,
      ok: true,
      source: "disabled",
      equityUsd: null,
      peakEquityUsd: null,
      ddPct: null,
      multiplier: 1.0,
      defense: false,
      reason: "equity_gov_disabled",
    };
  }

  try {
    const bal = await fetchUsdAndBtcBalances(ctx);
    if (!bal.ok) {
      return {
        enabled,
        ok: false,
        source: "error",
        equityUsd: null,
        peakEquityUsd: null,
        ddPct: null,
        multiplier: 1.0, // FAIL OPEN
        defense: false,
        reason: "equity_balance_fetch_failed",
      };
    }

    const equityUsd = bal.usd + bal.btc * spotPrice;

    const state = await getOrInitEquityState(ctx.user_id);
    if (!state.ok) {
      return {
        enabled,
        ok: false,
        source: "error",
        equityUsd: Number(equityUsd.toFixed(2)),
        peakEquityUsd: null,
        ddPct: null,
        multiplier: 1.0, // FAIL OPEN
        defense: false,
        reason: "equity_state_read_failed_or_table_missing",
      };
    }

    const prevPeak = Number.isFinite(state.peak) ? state.peak : 0;
    const peakEquityUsd = Math.max(prevPeak, equityUsd);

    await upsertEquityState(ctx.user_id, peakEquityUsd, equityUsd);

    const ddPct =
      peakEquityUsd > 0
        ? ((peakEquityUsd - equityUsd) / peakEquityUsd) * 100
        : 0;

    const defense = ddPct >= 5;
    const multiplier = computeMultiplierFromDdPct(ddPct);

    return {
      enabled,
      ok: true,
      source: "db",
      equityUsd: Number(equityUsd.toFixed(2)),
      peakEquityUsd: Number(peakEquityUsd.toFixed(2)),
      ddPct: Number(ddPct.toFixed(3)),
      multiplier,
      defense,
      reason: defense
        ? `defense_mode_dd_${ddPct.toFixed(2)}pct`
        : `throttle_dd_${ddPct.toFixed(2)}pct_mult_${multiplier}`,
    };
  } catch (e: any) {
    return {
      enabled,
      ok: false,
      source: "error",
      equityUsd: null,
      peakEquityUsd: null,
      ddPct: null,
      multiplier: 1.0, // FAIL OPEN
      defense: false,
      reason: `equity_gov_exception_${String(e?.message || e)}`,
    };
  }
}

// ---------- last BUY fill ----------
async function fetchLastBuyFill(
  ctx: Ctx
): Promise<
  | { ok: true; entryPrice: number; entryTime: string; entryQty: number }
  | { ok: false; error: any }
> {
  const path = `/api/v3/brokerage/orders/historical/fills?product_ids=${encodeURIComponent(
    PRODUCT_ID
  )}&limit=100&order_side=BUY&sort_by=TRADE_TIME`;

  const r = await cbGet(ctx, path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const fills = (r.json as any)?.fills || (r.json as any)?.fill || [];
  if (!Array.isArray(fills) || fills.length === 0)
    return { ok: false, error: "no_fills_found" };

  const buy =
    fills.find((f: any) => String(f?.side || "").toUpperCase() === "BUY") ||
    fills[0];

  const px = Number(buy?.price || buy?.fill_price || 0);
  const qty = Number(buy?.size || buy?.filled_size || buy?.base_size || 0);
  const t = String(buy?.trade_time || buy?.created_time || buy?.time || "");

  if (!Number.isFinite(px) || px <= 0)
    return { ok: false, error: { bad_price: buy } };
  return { ok: true, entryPrice: px, entryTime: t || nowIso(), entryQty: qty };
}

// ---------- last fill (ANY side) ----------
async function fetchLastFillAny(
  ctx: Ctx
): Promise<
  | { ok: true; side: "BUY" | "SELL"; price: number; time: string; qty: number }
  | { ok: false; error: any }
> {
  const path = `/api/v3/brokerage/orders/historical/fills?product_ids=${encodeURIComponent(
    PRODUCT_ID
  )}&limit=1&sort_by=TRADE_TIME`;

  const r = await cbGet(ctx, path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const fills = (r.json as any)?.fills || (r.json as any)?.fill || [];
  if (!Array.isArray(fills) || fills.length === 0)
    return { ok: false, error: "no_fills_found" };

  const f = fills[0];
  const sideRaw = String(f?.side || "").toUpperCase();
  const side: "BUY" | "SELL" = sideRaw === "SELL" ? "SELL" : "BUY";

  const px = Number(f?.price || f?.fill_price || 0);
  const qty = Number(f?.size || f?.filled_size || f?.base_size || 0);
  const t = String(f?.trade_time || f?.created_time || f?.time || "");

  if (!Number.isFinite(px) || px <= 0)
    return { ok: false, error: { bad_price: f } };

  return { ok: true, side, price: px, time: t || nowIso(), qty };
}

// ---------- peak window + volatility ----------
async function fetchPeakWindowWithVol(
  ctx: Ctx
): Promise<
  | {
      ok: true;
      peak: number;
      last: number;
      startTs: string;
      endTs: string;
      volBps: number;
    }
  | { ok: false; error: any }
> {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 3600 * 1000);

  const startTs = String(Math.floor(start.getTime() / 1000));
  const endTs = String(Math.floor(end.getTime() / 1000));

  const gran = optEnv("PULSE_CANDLE_GRANULARITY") || "ONE_MINUTE";
  const path = `/api/v3/brokerage/products/${encodeURIComponent(
    PRODUCT_ID
  )}/candles?start=${encodeURIComponent(startTs)}&end=${encodeURIComponent(
    endTs
  )}&granularity=${encodeURIComponent(gran)}`;

  const r = await cbGet(ctx, path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const candles = (r.json as any)?.candles || [];
  if (!Array.isArray(candles) || candles.length === 0)
    return { ok: false, error: "no_candles" };

  let peak = 0;
  let last = 0;

  let sumRangeBps = 0;
  let n = 0;

  for (const c of candles) {
    const high = Number((c as any)?.high ?? (c as any)?.h ?? 0);
    const low = Number((c as any)?.low ?? (c as any)?.l ?? 0);
    const close = Number((c as any)?.close ?? (c as any)?.c ?? 0);

    if (Number.isFinite(high) && high > peak) peak = high;
    if (Number.isFinite(close) && close > 0) last = close;

    if (
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      high > 0 &&
      low > 0 &&
      high >= low
    ) {
      const mid = (high + low) / 2;
      if (mid > 0) {
        const rangeBps = ((high - low) / mid) * 10_000;
        sumRangeBps += rangeBps;
        n++;
      }
    }
  }

  if (!peak || peak <= 0) return { ok: false, error: { bad_peak: candles[0] } };
  if (!last || last <= 0) last = peak;

  const avgRangeBps = n > 0 ? sumRangeBps / n : 0;
  const volBps = Number(avgRangeBps.toFixed(2));

  return { ok: true, peak, last, startTs, endTs, volBps };
}

// ---------- maker helpers ----------
function makerOffsetBps(): number {
  return num(process.env.MAKER_OFFSET_BPS, 1.0);
}
function makerTimeoutMs(): number {
  return num(process.env.MAKER_TIMEOUT_MS, 15000);
}
function makerAllowIocFallback(): boolean {
  return truthyDefault(process.env.MAKER_ALLOW_IOC_FALLBACK, true);
}

async function fetchOrderStatus(ctx: Ctx, orderId: string) {
  const r = await cbGet(
    ctx,
    `/api/v3/brokerage/orders/historical/${encodeURIComponent(orderId)}`
  );
  if (!r.ok)
    return { ok: false as const, status: r.status, raw: r.json ?? r.text };

  const o = (r.json as any)?.order ?? (r.json as any);
  const status = String(o?.status || o?.order?.status || "").toUpperCase();

  const filledBase =
    Number(o?.filled_size ?? o?.filled_quantity ?? o?.filled_base_size ?? 0) ||
    0;

  const filledQuote =
    Number(
      o?.filled_value ?? o?.executed_value ?? o?.filled_quote_value ?? 0
    ) || 0;

  const avgPrice =
    Number(
      o?.average_filled_price ??
        o?.avg_price ??
        o?.filled_average_price ??
        0
    ) || 0;

  const done = [
    "FILLED",
    "DONE",
    "CANCELLED",
    "CANCELED",
    "REJECTED",
    "EXPIRED",
  ].includes(status);

  return {
    ok: true as const,
    status,
    done,
    filledBase,
    filledQuote,
    avgPrice,
    raw: r.json,
  };
}

async function placeLimitPostOnly(
  ctx: Ctx,
  side: "BUY" | "SELL",
  baseSize: string,
  limitPrice: string
) {
  const path = "/api/v3/brokerage/orders";
  const payload = {
    client_order_id: `yc_mgr_${ctx.user_id}_${side.toLowerCase()}_maker_${Date.now()}`,
    product_id: PRODUCT_ID,
    side,
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        post_only: true,
      },
    },
  };
  return cbPost(ctx, path, payload);
}

async function placeMarketIoc(
  ctx: Ctx,
  side: "BUY" | "SELL",
  quoteUsd?: string,
  baseSize?: string
) {
  const path = "/api/v3/brokerage/orders";
  const payload =
    side === "BUY"
      ? {
          client_order_id: `yc_mgr_${ctx.user_id}_buy_ioc_${Date.now()}`,
          product_id: PRODUCT_ID,
          side: "BUY",
          order_configuration: { market_market_ioc: { quote_size: quoteUsd } },
        }
      : {
          client_order_id: `yc_mgr_${ctx.user_id}_sell_ioc_${Date.now()}`,
          product_id: PRODUCT_ID,
          side: "SELL",
          order_configuration: { market_market_ioc: { base_size: baseSize } },
        };
  return cbPost(ctx, path, payload);
}

function extractOrderId(respJson: any): string | null {
  const j = respJson || {};
  return (
    j?.order_id ||
    j?.success_response?.order_id ||
    j?.order?.order_id ||
    j?.order?.id ||
    j?.id ||
    null
  );
}

async function makerFirstBuy(ctx: Ctx, quoteUsd: string, refPrice: number) {
  const offset = makerOffsetBps();
  const limitPx = refPrice * (1 - offset / 10_000);
  const base = Number(quoteUsd) / limitPx;
  const baseSize = fmtBaseSize(base);
  const limitPrice = fmtPriceUsd(limitPx);
  const maker = await placeLimitPostOnly(ctx, "BUY", baseSize, limitPrice);
  return { maker, baseSize, limitPrice, refPrice };
}

async function makerFirstSell(ctx: Ctx, baseSize: string, refPrice: number) {
  const offset = makerOffsetBps();
  const limitPx = refPrice * (1 + offset / 10_000);
  const limitPrice = fmtPriceUsd(limitPx);
  const maker = await placeLimitPostOnly(ctx, "SELL", baseSize, limitPrice);
  return { maker, limitPrice, refPrice };
}

// ---------- core runner per-user ----------
async function runManagerForUser(runId: string, ctx: Ctx) {
  const botEnabled = truthy(process.env.BOT_ENABLED);
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);

  const entriesEnabled = truthy(process.env.PULSE_ENTRIES_ENABLED);
  const entriesDryRun = truthy(process.env.PULSE_ENTRIES_DRY_RUN);

  const exitsEnabled = truthy(process.env.PULSE_EXITS_ENABLED);
  const exitsDryRun = truthy(process.env.PULSE_EXITS_DRY_RUN);

  const cooldownMs = num(process.env.COOLDOWN_MS, 60_000);

  const profitTargetBps = num(
    process.env.YC_PROFIT_TARGET_BPS ?? process.env.PROFIT_TARGET_BPS,
    120
  );
  const trailArmBps = num(
    process.env.YC_TRAIL_ARM_BPS ?? process.env.TRAIL_ARM_BPS,
    150
  );
  const trailOffsetBpsBase = num(
    process.env.YC_TRAIL_OFFSET_BPS ?? process.env.TRAIL_OFFSET_BPS,
    50
  );

  // Anti-churn trailing guards
  const trailMinHoldMin = num(process.env.TRAIL_MIN_HOLD_MIN, 15);
  const trailMinHoldMs = trailMinHoldMin > 0 ? trailMinHoldMin * 60_000 : 0;

  // Volatility floor (bps)
  const trailVolFloorBps = num(process.env.TRAIL_VOL_FLOOR_BPS, 100);

  // Hard stop (default ON)
  const hardStopEnabled = truthyDefault(process.env.PULSE_HARD_STOP_ENABLED, true);
  const hardStopLossBps = num(
    process.env.PULSE_HARD_STOP_LOSS_BPS,
    num(process.env.YC_DEFAULT_HARD_STOP_BPS, 120)
  );

  const timeStopEnabled = truthyDefault(process.env.PULSE_TIME_STOP_ENABLED, false);
  const maxHoldMinutes = num(
    process.env.PULSE_MAX_HOLD_MINUTES,
    num(process.env.YC_DEFAULT_TIME_STOP_MIN, 0)
  );
  const maxHoldMs = maxHoldMinutes > 0 ? maxHoldMinutes * 60_000 : 0;

  // caps
  const hardMaxUsd = num(process.env.YC_HARD_MAX_TRADE_USD, 10);
  const envEntryUsd = num(process.env.PULSE_ENTRY_QUOTE_USD, 2.0);

  // Maker split: entries maker-first, exits IOC by default
  const makerEntries = truthyDefault(process.env.MAKER_ENTRIES, true);
  const makerExits = truthyDefault(process.env.MAKER_EXITS, false);

  const mTimeout = makerTimeoutMs();
  const mAllowIoc = makerAllowIocFallback();

  const ent = await fetchEntitlements(ctx.user_id);
  const pulseEntitled = !!ent.pulse;
  const entMaxUsd = Number.isFinite(Number(ent.max_trade_size))
    ? Number(ent.max_trade_size)
    : hardMaxUsd;

  const position = await fetchBtcPosition(ctx);

  const gates = {
    BOT_ENABLED: botEnabled,
    COINBASE_TRADING_ENABLED: tradingEnabled,
    PULSE_TRADE_ARMED: armed,
    PULSE_ENTRIES_ENABLED: entriesEnabled,
    PULSE_ENTRIES_DRY_RUN: entriesDryRun,
    PULSE_EXITS_ENABLED: exitsEnabled,
    PULSE_EXITS_DRY_RUN: exitsDryRun,
    PULSE_ENTITLED: pulseEntitled,
    LIVE_ALLOWED: botEnabled && tradingEnabled && armed,
  };

  // Recon status: ALWAYS fetch once so we can show it even while holding.
  const reconStatus = await fetchReconDecision();

  // Spot price (used for maker ref and for equity governor)
  const spot = await fetchSpotPrice(ctx);
  let refPrice = spot.ok ? spot.price : 0;
  if (!Number.isFinite(refPrice) || refPrice <= 0) refPrice = 0;

  // Equity governor (entry sizing throttle + defense flag). FAIL OPEN.
  const gov: EquityGov =
    refPrice > 0
      ? await computeEquityGovernor(ctx, refPrice)
      : {
          enabled: truthyDefault(process.env.EQUITY_GOV_ENABLED, true),
          ok: false,
          source: "error",
          equityUsd: null,
          peakEquityUsd: null,
          ddPct: null,
          multiplier: 1.0,
          defense: false,
          reason: "missing_ref_price_for_equity",
        };

  // Entry USD: bounded by caps, then scaled by gov.multiplier, then bounded again
  const baseEntryUsd = Math.max(0.01, Math.min(envEntryUsd, entMaxUsd, hardMaxUsd));
  const scaledEntryUsd = Math.max(0.01, baseEntryUsd * (Number(gov.multiplier) || 1.0));
  const finalEntryUsd = Math.max(0.01, Math.min(scaledEntryUsd, entMaxUsd, hardMaxUsd));
  const entryQuoteUsd = fmtQuoteSizeUsd(finalEntryUsd);

  const defenseConf = num(process.env.DEFENSE_CONF, 0.8);

  log(runId, "START", {
    user_id: ctx.user_id,
    key: shortKeyName(ctx.api_key_name),
    alg: algFor(ctx),
    gates,
    entryQuoteUsd,
    caps: { hardMaxUsd, entMaxUsd, envEntryUsd, baseEntryUsd, scaledEntryUsd, finalEntryUsd },
    equityGov: gov,
    maker: {
      makerEntries,
      makerExits,
      makerOffsetBps: makerOffsetBps(),
      makerTimeoutMs: mTimeout,
      makerAllowIocFallback: mAllowIoc,
    },
    trail: { trailMinHoldMin, trailVolFloorBps, trailOffsetBpsBase, trailArmBps, profitTargetBps },
    hardStop: { hardStopEnabled, hardStopLossBps },
    reconStatus,
  });

  if (!gates.PULSE_ENTITLED)
    return { ok: true, mode: "NOOP_NOT_ENTITLED", gates, position, reconStatus, equityGov: gov };

  if (!gates.LIVE_ALLOWED)
    return { ok: true, mode: "NOOP_GATES", gates, position, reconStatus, equityGov: gov };

  if (!(position as any)?.ok) {
    return { ok: false, mode: "BLOCKED", gates, error: "cannot_read_position", position, reconStatus, equityGov: gov };
  }

  // cooldown + re-entry guard (post-exit anti-churn)
  const lastBuy = await fetchLastBuyFill(ctx);
  const lastFill = await fetchLastFillAny(ctx);

  const lastFillIso = lastFill.ok ? lastFill.time : lastBuy.ok ? lastBuy.entryTime : null;
  const sinceMs = msSince(lastFillIso);

  const cooldownOk = sinceMs >= cooldownMs;

  // block re-entry after a SELL for N minutes
  const reentryCooldownMs = num(process.env.REENTRY_COOLDOWN_MS, 10 * 60_000);
  const reentryBlocked = lastFill.ok && lastFill.side === "SELL" && sinceMs < reentryCooldownMs;

  const cooldown = {
    lastFillIso,
    sinceMs: Number.isFinite(sinceMs) ? sinceMs : null,
    cooldownMs,
    cooldownOk,
    lastFillSide: lastFill.ok ? lastFill.side : null,
    reentryCooldownMs,
    reentryBlocked,
  };

  // ---------------- ENTRY ----------------
  if (!(position as any).has_position) {
    if (!entriesEnabled)
      return { ok: true, mode: "NO_POSITION_ENTRIES_DISABLED", gates, position, cooldown, reconStatus, equityGov: gov };

    if (!cooldownOk)
      return { ok: true, mode: "NO_POSITION_COOLDOWN", gates, position, cooldown, reconStatus, equityGov: gov };

    if (reentryBlocked)
      return { ok: true, mode: "NO_POSITION_REENTRY_COOLDOWN", gates, position, cooldown, reconStatus, equityGov: gov };

    // Equity defense mode: only allow entry if Recon confidence >= DEFENSE_CONF AND recon allows entry
    if (gov.defense) {
      const conf = Number(reconStatus.confidence ?? 0);
      const okDefense = Number.isFinite(conf) && conf >= defenseConf && reconStatus.entryAllowed;
      if (!okDefense) {
        log(runId, "DEFENSE_BLOCK_ENTRY", { ddPct: gov.ddPct, reqConf: defenseConf, reconStatus });
        return { ok: true, mode: "NO_POSITION_DEFENSE_BLOCK", gates, position, cooldown, reconStatus, equityGov: gov };
      }
    }

    // Recon gate (ENTRY ONLY) — already fail-open when errors occur
    if (!reconStatus.entryAllowed) {
      log(runId, "RECON_BLOCK_ENTRY", {
        reason: reconStatus.reason,
        regime: reconStatus.regime,
        conf: reconStatus.confidence,
        side: reconStatus.side,
      });
      return { ok: true, mode: "NO_POSITION_RECON_BLOCK", gates, position, cooldown, reconStatus, equityGov: gov };
    }

    if (entriesDryRun) {
      return { ok: true, mode: "DRY_RUN_BUY", gates, position, cooldown, reconStatus, equityGov: gov, would_buy_quote_usd: entryQuoteUsd };
    }

    // If maker entries disabled or no ref price: BUY IOC
    if (!makerEntries || !refPrice) {
      const path = "/api/v3/brokerage/orders";
      const reqPayload = {
        client_order_id: `yc_mgr_${ctx.user_id}_buy_ioc_${Date.now()}`,
        product_id: PRODUCT_ID,
        side: "BUY",
        order_configuration: { market_market_ioc: { quote_size: entryQuoteUsd } },
      };

      // Use cbPost directly so we can persist request/response in raw
      const buy = await cbPost(ctx, path, reqPayload);
      const orderId = extractOrderId(buy.json);

      let fill: any = null;
      if (orderId) {
        // short poll to let Coinbase finalize
        for (let i = 0; i < 3; i++) {
          const st = await fetchOrderStatus(ctx, orderId);
          if (st.ok) {
            fill = st;
            if (st.done || (st.filledBase ?? 0) > 0) break;
          }
          await sleep(600);
        }
      }

      await writeTradeLog({
        created_at: nowIso(),
        bot: BOT_NAME,
        symbol: PRODUCT_ID,
        side: "BUY",
        order_id: orderId,

        // fill fields (prefer actual fill; fallback to intent)
        base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : null,
        quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : Number(entryQuoteUsd),
        price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : refPrice || null,

        user_id: ctx.user_id,
        run_id: runId,
        mode: "ENTRY_BUY_IOC",
        reason: "entry",
        decision: null,
        recon_status: reconStatus,
        equity_gov: gov,

        ok: buy.ok,
        status: buy.status,
        raw: mkRawWrapper({
          kind: "coinbase_order",
          action: "ENTRY_BUY_IOC",
          gates,
          request: { path, method: "POST" },
          payload: reqPayload,
          response_status: buy.status,
          response: {
            submit: buy.json ?? buy.text,
            order_id: orderId,
            final: fill?.raw ?? null,
            final_status: fill?.status ?? null,
          },
        }),
      });

      return { ok: buy.ok, mode: "ENTRY_BUY_IOC", gates, position, cooldown, reconStatus, equityGov: gov, buy };
    }

    // Maker-first buy
    const attempt = await makerFirstBuy(ctx, entryQuoteUsd, refPrice);
    const makerOk = attempt.maker.ok;
    const makerJson = attempt.maker.json ?? null;
    const makerOrderId = extractOrderId(makerJson);

    if (!makerOk || !makerOrderId) {
      if (!mAllowIoc) {
        return { ok: false, mode: "ENTRY_BUY_MAKER_FAILED", gates, position, cooldown, reconStatus, equityGov: gov, error: "maker_order_failed" };
      }

      const path = "/api/v3/brokerage/orders";
      const reqPayload = {
        client_order_id: `yc_mgr_${ctx.user_id}_buy_ioc_${Date.now()}`,
        product_id: PRODUCT_ID,
        side: "BUY",
        order_configuration: { market_market_ioc: { quote_size: entryQuoteUsd } },
      };
      const buy = await cbPost(ctx, path, reqPayload);
      const orderId = extractOrderId(buy.json);

      let fill: any = null;
      if (orderId) {
        for (let i = 0; i < 3; i++) {
          const st = await fetchOrderStatus(ctx, orderId);
          if (st.ok) {
            fill = st;
            if (st.done || (st.filledBase ?? 0) > 0) break;
          }
          await sleep(600);
        }
      }

      await writeTradeLog({
        created_at: nowIso(),
        bot: BOT_NAME,
        symbol: PRODUCT_ID,
        side: "BUY",
        order_id: orderId,

        base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : null,
        quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : Number(entryQuoteUsd),
        price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : refPrice || null,

        user_id: ctx.user_id,
        run_id: runId,
        mode: "ENTRY_BUY_IOC_FALLBACK",
        reason: "maker_failed_fallback_ioc",
        decision: { makerAttempt: { baseSize: attempt.baseSize, limitPrice: attempt.limitPrice, maker_submit: makerJson } },
        recon_status: reconStatus,
        equity_gov: gov,

        ok: buy.ok,
        status: buy.status,
        raw: mkRawWrapper({
          kind: "coinbase_order",
          action: "ENTRY_BUY_IOC_FALLBACK",
          gates,
          request: { path, method: "POST" },
          payload: reqPayload,
          response_status: buy.status,
          response: {
            maker_submit: makerJson,
            maker_ok: makerOk,
            submit: buy.json ?? buy.text,
            order_id: orderId,
            final: fill?.raw ?? null,
            final_status: fill?.status ?? null,
          },
        }),
      });

      return { ok: buy.ok, mode: "ENTRY_BUY_IOC_FALLBACK", gates, position, cooldown, reconStatus, equityGov: gov, buy };
    }

    // poll maker order
    const deadline = Date.now() + mTimeout;
    let lastStatus: any = null;

    while (Date.now() < deadline) {
      const st = await fetchOrderStatus(ctx, makerOrderId);
      lastStatus = st;
      if (st.ok) {
        if ((st.filledBase ?? 0) > 0 || st.done) break;
      } else break;
      await sleep(1200);
    }

    const filledBase = lastStatus?.ok ? Number(lastStatus.filledBase || 0) : 0;
    const filledQuote = lastStatus?.ok ? Number(lastStatus.filledQuote || 0) : 0;
    const avgPrice = lastStatus?.ok ? Number(lastStatus.avgPrice || 0) : 0;
    const done = lastStatus?.ok ? !!lastStatus.done : false;

    if (filledBase > 0 || done) {
      await writeTradeLog({
        created_at: nowIso(),
        bot: BOT_NAME,
        symbol: PRODUCT_ID,
        side: "BUY",
        order_id: makerOrderId,

        base_size: filledBase > 0 ? filledBase : null,
        quote_size: filledQuote > 0 ? filledQuote : Number(entryQuoteUsd),
        price: avgPrice > 0 ? avgPrice : (attempt.limitPrice ? Number(attempt.limitPrice) : refPrice || null),

        user_id: ctx.user_id,
        run_id: runId,
        mode: "ENTRY_BUY_MAKER",
        reason: "maker_filled_or_done",
        decision: { maker_order_id: makerOrderId, status: lastStatus, makerAttempt: { baseSize: attempt.baseSize, limitPrice: attempt.limitPrice } },
        recon_status: reconStatus,
        equity_gov: gov,

        ok: true,
        status: 200,
        raw: mkRawWrapper({
          kind: "coinbase_order",
          action: "ENTRY_BUY_MAKER",
          gates,
          request: { path: "/api/v3/brokerage/orders", method: "POST" },
          payload: {
            product_id: PRODUCT_ID,
            side: "BUY",
            order_configuration: {
              limit_limit_gtc: { base_size: attempt.baseSize, limit_price: attempt.limitPrice, post_only: true },
            },
          },
          response_status: attempt.maker.status,
          response: {
            maker_submit: attempt.maker.json ?? attempt.maker.text,
            order_id: makerOrderId,
            final: lastStatus?.raw ?? null,
            final_status: lastStatus?.status ?? null,
          },
        }),
      });

      return { ok: true, mode: "ENTRY_BUY_MAKER", gates, position, cooldown, reconStatus, equityGov: gov, maker_order_id: makerOrderId };
    }

    if (!mAllowIoc) {
      return { ok: true, mode: "ENTRY_BUY_MAKER_TIMEOUT", gates, position, cooldown, reconStatus, equityGov: gov, maker_order_id: makerOrderId };
    }

    const path = "/api/v3/brokerage/orders";
    const reqPayload = {
      client_order_id: `yc_mgr_${ctx.user_id}_buy_ioc_${Date.now()}`,
      product_id: PRODUCT_ID,
      side: "BUY",
      order_configuration: { market_market_ioc: { quote_size: entryQuoteUsd } },
    };
    const buy = await cbPost(ctx, path, reqPayload);
    const orderId = extractOrderId(buy.json);

    let fill: any = null;
    if (orderId) {
      for (let i = 0; i < 3; i++) {
        const st = await fetchOrderStatus(ctx, orderId);
        if (st.ok) {
          fill = st;
          if (st.done || (st.filledBase ?? 0) > 0) break;
        }
        await sleep(600);
      }
    }

    await writeTradeLog({
      created_at: nowIso(),
      bot: BOT_NAME,
      symbol: PRODUCT_ID,
      side: "BUY",
      order_id: orderId,

      base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : null,
      quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : Number(entryQuoteUsd),
      price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : refPrice || null,

      user_id: ctx.user_id,
      run_id: runId,
      mode: "ENTRY_BUY_IOC_AFTER_TIMEOUT",
      reason: "maker_timeout_fallback_ioc",
      decision: { maker_order_id: makerOrderId, status: lastStatus },
      recon_status: reconStatus,
      equity_gov: gov,

      ok: buy.ok,
      status: buy.status,
      raw: mkRawWrapper({
        kind: "coinbase_order",
        action: "ENTRY_BUY_IOC_AFTER_TIMEOUT",
        gates,
        request: { path, method: "POST" },
        payload: reqPayload,
        response_status: buy.status,
        response: {
          maker_order_id: makerOrderId,
          maker_final: lastStatus?.raw ?? null,
          submit: buy.json ?? buy.text,
          order_id: orderId,
          final: fill?.raw ?? null,
          final_status: fill?.status ?? null,
        },
      }),
    });

    return { ok: buy.ok, mode: "ENTRY_BUY_IOC_AFTER_TIMEOUT", gates, position, cooldown, reconStatus, equityGov: gov, buy };
  }

  // ---------------- EXIT ----------------
  if (!exitsEnabled) {
    log(runId, "EXIT_DECISION", { reason: "exits_disabled", pnlBps: null });
    return { ok: true, mode: "HOLD_EXITS_DISABLED", gates, position, cooldown, reconStatus, equityGov: gov };
  }

  if (!lastBuy.ok) {
    log(runId, "EXIT_DECISION", { reason: "blocked_cannot_read_entry", pnlBps: null });
    return { ok: false, mode: "BLOCKED", gates, position, cooldown, reconStatus, equityGov: gov, error: "cannot_read_entry", lastBuy };
  }

  const peak = await fetchPeakWindowWithVol(ctx);
  if (!peak.ok) {
    log(runId, "EXIT_DECISION", { reason: "blocked_cannot_read_peak", pnlBps: null });
    return { ok: false, mode: "BLOCKED", gates, position, cooldown, reconStatus, equityGov: gov, error: "cannot_read_peak", peak };
  }

  const entryPrice = lastBuy.entryPrice;
  const current = peak.last;
  const peakPrice = peak.peak;

  const pnlBpsRaw = ((current - entryPrice) / entryPrice) * 10_000;
  const pnlBps = Number(pnlBpsRaw.toFixed(2));

  const drawdownFromPeakBpsRaw = ((peakPrice - current) / peakPrice) * 10_000;
  const drawdownFromPeakBps = Number(drawdownFromPeakBpsRaw.toFixed(2));

  const heldMs = msSince(lastBuy.entryTime);

  const shouldTakeProfit = pnlBps >= profitTargetBps;
  const trailArmed = pnlBps >= trailArmBps;

  const halfVol = Number.isFinite(peak.volBps) ? peak.volBps * 0.5 : 0;
  const effectiveTrailOffsetBps = Math.max(trailOffsetBpsBase, trailVolFloorBps, halfVol);

  const minHoldOk = trailMinHoldMs > 0 ? heldMs >= trailMinHoldMs : true;
  const shouldTrailStop = trailArmed && minHoldOk && drawdownFromPeakBps >= effectiveTrailOffsetBps;

  const shouldHardStop =
    hardStopEnabled && hardStopLossBps > 0 && pnlBps <= -Math.abs(hardStopLossBps);

  const shouldTimeStop =
    timeStopEnabled &&
    maxHoldMs > 0 &&
    Number.isFinite(heldMs) &&
    heldMs >= maxHoldMs &&
    pnlBps < 0;

  const anyExit = shouldHardStop || shouldTimeStop || shouldTakeProfit || shouldTrailStop;

  const reason =
    shouldHardStop ? "hard_stop" :
    shouldTimeStop ? "time_stop" :
    shouldTakeProfit ? "take_profit" :
    shouldTrailStop ? "trail_stop" :
    "hold";

  const decision = {
    entryPrice,
    entryTime: lastBuy.entryTime,
    entryQty: Number.isFinite(lastBuy.entryQty) ? lastBuy.entryQty : null,
    heldMs: Number.isFinite(heldMs) ? heldMs : null,
    candleWindow: { startTs: peak.startTs, endTs: peak.endTs },
    current,
    peakPrice,
    pnlBps,
    trailingActive: trailArmed,
    drawdownFromPeakBps,
    profitTargetBps,
    trailArmBps,
    trailOffsetBpsBase,
    trailVolFloorBps,
    measuredVolBps: peak.volBps,
    effectiveTrailOffsetBps: Number(effectiveTrailOffsetBps.toFixed(2)),
    minHoldOk,
    trailMinHoldMin,
    shouldTakeProfit,
    shouldTrailStop,
    hardStopEnabled,
    hardStopLossBps,
    shouldHardStop,
    timeStopEnabled,
    maxHoldMinutes,
    shouldTimeStop,
  };

  log(runId, "EXIT_DECISION", {
    reason,
    pnlBps,
    trailingActive: trailArmed,
    drawdownFromPeakBps,
    positionSize: (position as any).base_available,
    effectiveTrailOffsetBps: decision.effectiveTrailOffsetBps,
    minHoldOk,
  });

  if (!anyExit) return { ok: true, mode: "HOLD", gates, position, cooldown, reconStatus, equityGov: gov, decision };

  const baseSize = fmtBaseSize((position as any).base_available);

  if (exitsDryRun) {
    return { ok: true, mode: "DRY_RUN_SELL", gates, position, cooldown, reconStatus, equityGov: gov, decision, would_sell_base_size: baseSize };
  }

  // Exits default IOC for reliability
  if (!makerExits) {
    const path = "/api/v3/brokerage/orders";
    const reqPayload = {
      client_order_id: `yc_mgr_${ctx.user_id}_sell_ioc_${Date.now()}`,
      product_id: PRODUCT_ID,
      side: "SELL",
      order_configuration: { market_market_ioc: { base_size: baseSize } },
    };

    const sell = await cbPost(ctx, path, reqPayload);
    const orderId = extractOrderId(sell.json);

    let fill: any = null;
    if (orderId) {
      for (let i = 0; i < 3; i++) {
        const st = await fetchOrderStatus(ctx, orderId);
        if (st.ok) {
          fill = st;
          if (st.done || (st.filledBase ?? 0) > 0) break;
        }
        await sleep(600);
      }
    }

    await writeTradeLog({
      created_at: nowIso(),
      bot: BOT_NAME,
      symbol: PRODUCT_ID,
      side: "SELL",
      order_id: orderId,

      base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : Number(baseSize),
      quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : null,
      price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : current || null,

      user_id: ctx.user_id,
      run_id: runId,
      mode: "EXIT_SELL_IOC",
      reason,
      decision,
      recon_status: reconStatus,
      equity_gov: gov,

      ok: sell.ok,
      status: sell.status,
      raw: mkRawWrapper({
        kind: "coinbase_order",
        action: "EXIT_SELL_IOC",
        gates,
        request: { path, method: "POST" },
        payload: reqPayload,
        response_status: sell.status,
        response: {
          submit: sell.json ?? sell.text,
          order_id: orderId,
          final: fill?.raw ?? null,
          final_status: fill?.status ?? null,
        },
      }),
    });

    return { ok: sell.ok, mode: "EXIT_SELL_IOC", gates, position, cooldown, reconStatus, equityGov: gov, decision, sell, reason };
  }

  // Maker exit path if explicitly enabled
  const exitRef = current;
  if (!Number.isFinite(exitRef) || exitRef <= 0) {
    if (!makerAllowIocFallback()) {
      return { ok: false, mode: "BLOCKED", gates, position, cooldown, reconStatus, equityGov: gov, decision, error: "no_ref_price_for_exit" };
    }

    const path = "/api/v3/brokerage/orders";
    const reqPayload = {
      client_order_id: `yc_mgr_${ctx.user_id}_sell_ioc_${Date.now()}`,
      product_id: PRODUCT_ID,
      side: "SELL",
      order_configuration: { market_market_ioc: { base_size: baseSize } },
    };

    const sell = await cbPost(ctx, path, reqPayload);
    const orderId = extractOrderId(sell.json);

    let fill: any = null;
    if (orderId) {
      for (let i = 0; i < 3; i++) {
        const st = await fetchOrderStatus(ctx, orderId);
        if (st.ok) {
          fill = st;
          if (st.done || (st.filledBase ?? 0) > 0) break;
        }
        await sleep(600);
      }
    }

    await writeTradeLog({
      created_at: nowIso(),
      bot: BOT_NAME,
      symbol: PRODUCT_ID,
      side: "SELL",
      order_id: orderId,

      base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : Number(baseSize),
      quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : null,
      price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : null,

      user_id: ctx.user_id,
      run_id: runId,
      mode: "EXIT_SELL_IOC_FALLBACK_NO_REF",
      reason,
      decision,
      recon_status: reconStatus,
      equity_gov: gov,

      ok: sell.ok,
      status: sell.status,
      raw: mkRawWrapper({
        kind: "coinbase_order",
        action: "EXIT_SELL_IOC_FALLBACK_NO_REF",
        gates,
        request: { path, method: "POST" },
        payload: reqPayload,
        response_status: sell.status,
        response: {
          submit: sell.json ?? sell.text,
          order_id: orderId,
          final: fill?.raw ?? null,
          final_status: fill?.status ?? null,
        },
      }),
    });

    return { ok: sell.ok, mode: "EXIT_SELL_IOC_FALLBACK_NO_REF", gates, position, cooldown, reconStatus, equityGov: gov, decision, sell, reason };
  }

  const attempt = await makerFirstSell(ctx, baseSize, exitRef);
  const makerOk = attempt.maker.ok;
  const makerJson = attempt.maker.json ?? null;
  const makerOrderId = extractOrderId(makerJson);

  if (!makerOk || !makerOrderId) {
    if (!makerAllowIocFallback()) {
      return { ok: false, mode: "EXIT_SELL_MAKER_FAILED", gates, position, cooldown, reconStatus, equityGov: gov, decision, reason, error: "maker_exit_failed" };
    }

    const path = "/api/v3/brokerage/orders";
    const reqPayload = {
      client_order_id: `yc_mgr_${ctx.user_id}_sell_ioc_${Date.now()}`,
      product_id: PRODUCT_ID,
      side: "SELL",
      order_configuration: { market_market_ioc: { base_size: baseSize } },
    };

    const sell = await cbPost(ctx, path, reqPayload);
    const orderId = extractOrderId(sell.json);

    let fill: any = null;
    if (orderId) {
      for (let i = 0; i < 3; i++) {
        const st = await fetchOrderStatus(ctx, orderId);
        if (st.ok) {
          fill = st;
          if (st.done || (st.filledBase ?? 0) > 0) break;
        }
        await sleep(600);
      }
    }

    await writeTradeLog({
      created_at: nowIso(),
      bot: BOT_NAME,
      symbol: PRODUCT_ID,
      side: "SELL",
      order_id: orderId,

      base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : Number(baseSize),
      quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : null,
      price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : exitRef || null,

      user_id: ctx.user_id,
      run_id: runId,
      mode: "EXIT_SELL_IOC_FALLBACK",
      reason,
      decision: { ...decision, makerAttempt: { limitPrice: attempt.limitPrice, maker_order_id: makerOrderId, maker_submit: makerJson } },
      recon_status: reconStatus,
      equity_gov: gov,

      ok: sell.ok,
      status: sell.status,
      raw: mkRawWrapper({
        kind: "coinbase_order",
        action: "EXIT_SELL_IOC_FALLBACK",
        gates,
        request: { path, method: "POST" },
        payload: reqPayload,
        response_status: sell.status,
        response: {
          maker_submit: makerJson,
          maker_ok: makerOk,
          submit: sell.json ?? sell.text,
          order_id: orderId,
          final: fill?.raw ?? null,
          final_status: fill?.status ?? null,
        },
      }),
    });

    return { ok: sell.ok, mode: "EXIT_SELL_IOC_FALLBACK", gates, position, cooldown, reconStatus, equityGov: gov, decision, sell, reason };
  }

  const deadline = Date.now() + makerTimeoutMs();
  let lastStatus: any = null;

  while (Date.now() < deadline) {
    const st = await fetchOrderStatus(ctx, makerOrderId);
    lastStatus = st;
    if (st.ok) {
      if ((st.filledBase ?? 0) > 0 || st.done) break;
    } else break;
    await sleep(1200);
  }

  const filledBase = lastStatus?.ok ? Number(lastStatus.filledBase || 0) : 0;
  const filledQuote = lastStatus?.ok ? Number(lastStatus.filledQuote || 0) : 0;
  const avgPrice = lastStatus?.ok ? Number(lastStatus.avgPrice || 0) : 0;
  const done = lastStatus?.ok ? !!lastStatus.done : false;

  if (filledBase > 0 || done) {
    await writeTradeLog({
      created_at: nowIso(),
      bot: BOT_NAME,
      symbol: PRODUCT_ID,
      side: "SELL",
      order_id: makerOrderId,

      base_size: filledBase > 0 ? filledBase : Number(baseSize),
      quote_size: filledQuote > 0 ? filledQuote : null,
      price: avgPrice > 0 ? avgPrice : (attempt.limitPrice ? Number(attempt.limitPrice) : exitRef || null),

      user_id: ctx.user_id,
      run_id: runId,
      mode: "EXIT_SELL_MAKER",
      reason,
      decision: { ...decision, maker_order_id: makerOrderId, status: lastStatus },
      recon_status: reconStatus,
      equity_gov: gov,

      ok: true,
      status: 200,
      raw: mkRawWrapper({
        kind: "coinbase_order",
        action: "EXIT_SELL_MAKER",
        gates,
        request: { path: "/api/v3/brokerage/orders", method: "POST" },
        payload: {
          product_id: PRODUCT_ID,
          side: "SELL",
          order_configuration: {
            limit_limit_gtc: { base_size: baseSize, limit_price: attempt.limitPrice, post_only: true },
          },
        },
        response_status: attempt.maker.status,
        response: {
          maker_submit: attempt.maker.json ?? attempt.maker.text,
          order_id: makerOrderId,
          final: lastStatus?.raw ?? null,
          final_status: lastStatus?.status ?? null,
        },
      }),
    });

    return { ok: true, mode: "EXIT_SELL_MAKER", gates, position, cooldown, reconStatus, equityGov: gov, decision, reason, maker_order_id: makerOrderId };
  }

  if (!makerAllowIocFallback())
    return { ok: true, mode: "EXIT_SELL_MAKER_TIMEOUT", gates, position, cooldown, reconStatus, equityGov: gov, decision, reason, maker_order_id: makerOrderId };

  const path = "/api/v3/brokerage/orders";
  const reqPayload = {
    client_order_id: `yc_mgr_${ctx.user_id}_sell_ioc_${Date.now()}`,
    product_id: PRODUCT_ID,
    side: "SELL",
    order_configuration: { market_market_ioc: { base_size: baseSize } },
  };

  const sell = await cbPost(ctx, path, reqPayload);
  const orderId = extractOrderId(sell.json);

  let fill: any = null;
  if (orderId) {
    for (let i = 0; i < 3; i++) {
      const st = await fetchOrderStatus(ctx, orderId);
      if (st.ok) {
        fill = st;
        if (st.done || (st.filledBase ?? 0) > 0) break;
      }
      await sleep(600);
    }
  }

  await writeTradeLog({
    created_at: nowIso(),
    bot: BOT_NAME,
    symbol: PRODUCT_ID,
    side: "SELL",
    order_id: orderId,

    base_size: fill?.ok && fill.filledBase > 0 ? Number(fill.filledBase) : Number(baseSize),
    quote_size: fill?.ok && fill.filledQuote > 0 ? Number(fill.filledQuote) : null,
    price: fill?.ok && fill.avgPrice > 0 ? Number(fill.avgPrice) : exitRef || null,

    user_id: ctx.user_id,
    run_id: runId,
    mode: "EXIT_SELL_IOC_AFTER_TIMEOUT",
    reason,
    decision: { ...decision, maker_order_id: makerOrderId, status: lastStatus },
    recon_status: reconStatus,
    equity_gov: gov,

    ok: sell.ok,
    status: sell.status,
    raw: mkRawWrapper({
      kind: "coinbase_order",
      action: "EXIT_SELL_IOC_AFTER_TIMEOUT",
      gates,
      request: { path, method: "POST" },
      payload: reqPayload,
      response_status: sell.status,
      response: {
        maker_order_id: makerOrderId,
        maker_final: lastStatus?.raw ?? null,
        submit: sell.json ?? sell.text,
        order_id: orderId,
        final: fill?.raw ?? null,
        final_status: fill?.status ?? null,
      },
    }),
  });

  return { ok: sell.ok, mode: "EXIT_SELL_IOC_AFTER_TIMEOUT", gates, position, cooldown, reconStatus, equityGov: gov, decision, sell, reason };
}

// ---------- orchestrator ----------
async function runForAllUsers(masterRunId: string) {
  const loaded = await loadAllCoinbaseKeys();
  if (!loaded.ok) return { ok: false, error: "cannot_load_users", details: loaded.error };

  let rows = loaded.rows;

  if (ONLY_USER_ID) {
    rows = rows.filter((r) => r.user_id === ONLY_USER_ID);
  }

  if (rows.length === 0) {
    return {
      ok: true,
      usersProcessed: 0,
      okCount: 0,
      failCount: 0,
      results: [],
      note: ONLY_USER_ID
        ? `PULSE_ONLY_USER_ID set but no matching coinbase_keys row found for user_id=${ONLY_USER_ID}`
        : "no coinbase_keys rows found",
      onlyUserId: ONLY_USER_ID,
    };
  }

  const results: any[] = [];
  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const runId = `${masterRunId}:${i + 1}`;
    const ctx: Ctx = {
      user_id: r.user_id,
      api_key_name: r.api_key_name,
      private_key: r.private_key,
      key_alg: r.key_alg ?? null,
    };

    try {
      const out = await runManagerForUser(runId, ctx);
      if ((out as any)?.ok) okCount++;
      else failCount++;

      results.push({
        runId,
        user_id: ctx.user_id,
        key: shortKeyName(ctx.api_key_name),
        alg: algFor(ctx),
        ok: !!(out as any)?.ok,
        mode: (out as any)?.mode,
        gates: (out as any)?.gates,
        position: (out as any)?.position,
        cooldown: (out as any)?.cooldown,
        decision: (out as any)?.decision,
        equityGov: (out as any)?.equityGov,
        reconStatus: (out as any)?.reconStatus,
        reason: (out as any)?.reason,
        error: (out as any)?.error,
      });
    } catch (e: any) {
      failCount++;
      results.push({
        runId,
        user_id: ctx.user_id,
        key: shortKeyName(ctx.api_key_name),
        alg: algFor(ctx),
        ok: false,
        mode: "EXCEPTION",
        error: e?.message || String(e),
      });
    }
  }

  return {
    ok: failCount === 0,
    usersProcessed: rows.length,
    okCount,
    failCount,
    onlyUserId: ONLY_USER_ID,
    results,
  };
}

// ---------- handlers ----------
export async function GET(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const action = String(url.searchParams.get("action") || "run").toLowerCase();

  const masterRunId = uuid();

  log(masterRunId, "REQUEST", { method: "GET", url: req.url, action, onlyUserId: ONLY_USER_ID });

  const result = await runForAllUsers(masterRunId);

  log(masterRunId, "END", { ok: (result as any).ok, usersProcessed: (result as any)?.usersProcessed, onlyUserId: ONLY_USER_ID });

  return json((result as any).ok ? 200 : 500, { runId: masterRunId, action, ...result });
}

export async function POST(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const masterRunId = uuid();

  log(masterRunId, "REQUEST", { method: "POST", url: req.url, onlyUserId: ONLY_USER_ID });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const action = String(body?.action || "run").toLowerCase();

  const result = await runForAllUsers(masterRunId);

  log(masterRunId, "END", { ok: (result as any).ok, usersProcessed: (result as any)?.usersProcessed, onlyUserId: ONLY_USER_ID });

  return json((result as any).ok ? 200 : 500, { runId: masterRunId, action, ...result });
}