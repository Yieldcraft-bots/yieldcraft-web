// src/app/api/pulse-trade/route.ts
// Pulse Trade — Position-aware Coinbase Advanced Trade execution (PER-USER KEYS)
//
// Actions:
//   - status
//   - dry_run_order
//   - place_order
//
// SAFETY GATES (BOTH required for LIVE):
//   1) COINBASE_TRADING_ENABLED=true
//   2) PULSE_TRADE_ARMED=true
//
// AUTH (REQUIRED) for any non-public action:
//   - x-cron-secret OR x-pulse-secret OR Authorization: Bearer <secret>
//   - OR a valid Supabase user session token (Authorization: Bearer <supabase_access_token>)
//   - secret query param allowed for manual diagnostics
//
// PUBLIC (SAFE):
//   - GET ?action=status  (returns read-only gates only; no user data)
//
// DESIGN:
// - Single-position only (BTC-USD)
// - BUY only if no BTC position (above dust threshold)
// - SELL only if BTC position exists (above dust threshold)
// - Read-only position snapshot before execution (cannot trade)
//
// OPTIONAL:
// - PULSE_ORDER_MODE=market|maker   (default: market)
// - MAKER_OFFSET_BPS=1.0            (default: 1.0)
//
// PER-USER KEYING:
// - Uses the requesting user's stored Coinbase keys from Supabase.
// - Provide user_id (UUID) via:
//    - GET /api/pulse-trade?user_id=<uuid>&secret=...   (diagnostic/manual)
//    - POST { user_id: "<uuid>", ... }                 (manager/manual)
// - DOES NOT RETURN PRIVATE KEY ever.

import { NextResponse, type NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getUserCoinbaseKeys } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Side = "BUY" | "SELL";
type Action = "status" | "dry_run_order" | "place_order";
type OrderMode = "market" | "maker";

// jsonwebtoken alg names
type JwtAlg = "ES256" | "EdDSA";

// -------------------- helpers --------------------

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(message: string, status = 400, extra: any = {}) {
  return json(status, { ok: false, error: message, ...extra });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function optEnv(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function normalizePem(pem: string) {
  let p = (pem || "").trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

// If DB stores base64 DER (common: "MHcCAQEE..."), wrap into a PEM that jsonwebtoken accepts.
// This matches EC PRIVATE KEY DER.
function toEcPrivateKeyPemFromBase64Der(b64: string) {
  const clean = (b64 || "").trim().replace(/\s+/g, "");
  const lines = clean.match(/.{1,64}/g) || [];
  return `-----BEGIN EC PRIVATE KEY-----\n${lines.join(
    "\n"
  )}\n-----END EC PRIVATE KEY-----`;
}

function normalizePrivateKeyFromDb(raw: string) {
  const v = (raw || "").trim();
  if (!v) throw new Error("Missing stored private_key");
  if (v.includes("BEGIN")) return normalizePem(v);
  // assume base64 DER for EC key
  return toEcPrivateKeyPemFromBase64Der(v);
}

type AuthOk =
  | { ok: true; kind: "secret" }
  | { ok: true; kind: "user"; userId: string };

type AuthNo = { ok: false; status: number; error: string };

type AuthResult = AuthOk | AuthNo;

// SAFETY AUTH for this route (do NOT allow public trading)
// Accepts either:
//  - server-to-server secret (cron/manager) OR
//  - a valid Supabase user session token (browser)
async function okAuth(req: Request): Promise<AuthResult> {
  // 1) Cron/manager secret (server-to-server)
  const secret = (
    process.env.CRON_SECRET ||
    process.env.PULSE_TRADE_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();

  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("x-pulse-secret") ||
    req.headers.get("authorization");

  if (secret) {
    if (h && (h === secret || h === `Bearer ${secret}`)) {
      return { ok: true, kind: "secret" };
    }
    const url = new URL(req.url);
    const q = url.searchParams.get("secret");
    if (q === secret) return { ok: true, kind: "secret" };
  }

  // 2) Supabase user session (browser → API)
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "missing_auth" };
  }

  const token = auth.slice("bearer ".length).trim();
  if (!token) return { ok: false, status: 401, error: "missing_token" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500, error: "supabase_env_missing" };
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: "invalid_session" };
  }

  return { ok: true, kind: "user", userId: data.user.id };
}

function gates() {
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);
  const liveAllowed = tradingEnabled && armed;
  return { tradingEnabled, armed, liveAllowed };
}

function getOrderMode(): OrderMode {
  const m = (optEnv("PULSE_ORDER_MODE") || "market").toLowerCase();
  return m === "maker" ? "maker" : "market";
}

function mustOneOf<T extends string>(
  value: any,
  allowed: readonly T[],
  fallback: T
): T {
  const v = String(value || "").toUpperCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// Treat “position exists” only if above a dust threshold (prevents false blocks)
function minPositionBaseBtc() {
  const raw = (process.env.PULSE_MIN_POSITION_BASE_BTC || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 0.000001; // default dust threshold
}

function fmtBaseSize(x: number) {
  const v = Math.max(0, x);
  return v.toFixed(8).replace(/\.?0+$/, "");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function pickJwtAlgFromDb(keyAlg: any): JwtAlg {
  const k = String(keyAlg || "").toLowerCase();
  // accept a few spellings
  if (k.includes("ed25519") || k.includes("eddsa") || k === "ed") return "EdDSA";
  // default
  return "ES256";
}

async function requireUserKeys(userId: string) {
  if (!userId || !isUuid(userId)) {
    throw new Error("Invalid user_id (must be UUID).");
  }

  const keys = await getUserCoinbaseKeys(userId);

  if (!keys) throw new Error("No Coinbase keys found for this user.");
  if (!keys.apiKeyName) throw new Error("Stored api_key_name missing.");
  if (!keys.privateKey) throw new Error("Stored private_key missing.");

  const jwtAlg: JwtAlg = pickJwtAlgFromDb(keys.keyAlg);

  return {
    userId,
    apiKeyName: String(keys.apiKeyName),
    privateKeyPem: normalizePrivateKeyFromDb(String(keys.privateKey)),
    keyAlg: keys.keyAlg ? String(keys.keyAlg) : null,
    jwtAlg,
  };
}

// -------------------- Coinbase JWT (CDP) --------------------
// NOTE: host-style uri: "METHOD api.coinbase.com/path"
// IMPORTANT: uri must NOT include querystring.

function buildCdpJwtWithUserKeys(
  method: "GET" | "POST",
  path: string,
  userKeys: { apiKeyName: string; privateKeyPem: string; jwtAlg: JwtAlg }
) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const pathForUri = path.split("?")[0]; // critical
  const uri = `${method} api.coinbase.com${pathForUri}`;

  return jwt.sign(
    { iss: "cdp", sub: userKeys.apiKeyName, nbf: now, exp: now + 60, uri },
    userKeys.privateKeyPem as any,
    {
      algorithm: userKeys.jwtAlg as any,
      header: { kid: userKeys.apiKeyName, nonce } as any,
    }
  );
}

// -------------------- POSITION SNAPSHOT (READ-ONLY) --------------------

async function fetchBtcPosition(userKeys: {
  apiKeyName: string;
  privateKeyPem: string;
  jwtAlg: JwtAlg;
}) {
  const path = "/api/v3/brokerage/accounts";
  try {
    const token = buildCdpJwtWithUserKeys("GET", path, userKeys);

    const res = await fetch(`https://api.coinbase.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const text = await res.text();
    const parsed = safeJsonParse(text);

    if (!res.ok) {
      return {
        ok: false as const,
        has_position: false,
        base_available: 0,
        status: res.status,
        coinbase: parsed ?? text,
      };
    }

    const accounts = (parsed as any)?.accounts || [];
    const btc = accounts.find((a: any) => a?.currency === "BTC");
    const available = Number(btc?.available_balance?.value || 0);

    const minPos = minPositionBaseBtc();
    return {
      ok: true as const,
      has_position: Number.isFinite(available) && available >= minPos,
      base_available: Number.isFinite(available) ? available : 0,
      min_pos: minPos,
    };
  } catch (e: any) {
    return {
      ok: false as const,
      has_position: false,
      base_available: 0,
      error: String(e?.message || e || "position_fetch_failed"),
    };
  }
}

// -------------------- ORDER BOOK (for maker) --------------------

async function fetchBestAskBid(
  product_id: string,
  userKeys: { apiKeyName: string; privateKeyPem: string; jwtAlg: JwtAlg }
) {
  const path = `/api/v3/brokerage/products/${encodeURIComponent(
    product_id
  )}/book?limit=1`;
  try {
    const token = buildCdpJwtWithUserKeys("GET", path, userKeys);
    const res = await fetch(`https://api.coinbase.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const text = await res.text();
    const parsed = safeJsonParse(text);

    if (!res.ok)
      return {
        ok: false as const,
        status: res.status,
        coinbase: parsed ?? text,
      };

    const bids = (parsed as any)?.pricebook?.bids || [];
    const asks = (parsed as any)?.pricebook?.asks || [];
    const bestBid = Number(bids?.[0]?.price || 0);
    const bestAsk = Number(asks?.[0]?.price || 0);

    return { ok: true as const, bestBid, bestAsk };
  } catch (e: any) {
    return {
      ok: false as const,
      error: String(e?.message || e || "book_fetch_failed"),
    };
  }
}

function bpsAdjust(price: number, bps: number, direction: "down" | "up") {
  const mult = 1 + (direction === "up" ? 1 : -1) * (bps / 10000);
  return Math.max(0, price * mult);
}

// Build a unified status payload so GET + POST(status) match
async function buildStatusPayload(userId: string) {
  const { tradingEnabled, armed, liveAllowed } = gates();
  const orderMode = getOrderMode();

  let userKeysMeta: any = null;
  let position: any = null;

  try {
    const userKeys = await requireUserKeys(userId);
    userKeysMeta = {
      ok: true,
      user_id: userId,
      apiKeyNameTail: userKeys.apiKeyName.slice(-6),
      keyAlg: userKeys.keyAlg ?? null,
      jwtAlg: userKeys.jwtAlg,
    };

    position = await fetchBtcPosition(userKeys);
  } catch (e: any) {
    userKeysMeta = {
      ok: false,
      user_id: userId,
      error: String(e?.message || e),
    };
    position = {
      ok: false,
      has_position: false,
      base_available: 0,
      error: "cannot_check_position_without_valid_user_keys",
    };
  }

  return {
    ok: true,
    status: "PULSE_TRADE_READY",
    mode: orderMode,
    gates: {
      COINBASE_TRADING_ENABLED: tradingEnabled,
      PULSE_TRADE_ARMED: armed,
      LIVE_ALLOWED: liveAllowed,
    },
    userKeys: userKeysMeta,
    position,
    positionBase: position?.ok ? Number(position.base_available || 0) : 0,
    hasPosition: position?.ok ? Boolean(position.has_position) : false,
  };
}

// -------------------- GET --------------------

export async function GET(req: NextRequest) {
  const actionRaw = (req.nextUrl.searchParams.get("action") || "status").toLowerCase();
  const action: Action =
    actionRaw === "dry_run_order"
      ? "dry_run_order"
      : actionRaw === "place_order"
        ? "place_order"
        : "status";

  // ✅ PUBLIC, READ-ONLY status (no secrets, no user info)
  // This makes the pills green and allows safe uptime/health checks.
  const auth = await okAuth(req);

  if (action === "status" && !auth.ok) {
    const { tradingEnabled, armed, liveAllowed } = gates();
    return json(200, {
      ok: true,
      status: "PULSE_TRADE_STATUS_PUBLIC",
      gates: {
        BOT_ENABLED: truthy(process.env.BOT_ENABLED),
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
        LIVE_ALLOWED: liveAllowed,
      },
      t: new Date().toISOString(),
    });
  }

  // Everything else requires auth
  if (!auth.ok) return jsonError("unauthorized", auth.status ?? 401, { reason: auth.error });

  // Authenticated GET can return detailed status if user_id is provided
  const userId = req.nextUrl.searchParams.get("user_id") || "";
  if (!userId) {
    const { tradingEnabled, armed, liveAllowed } = gates();
    return json(200, {
      ok: true,
      status: "PULSE_TRADE_STATUS_AUTH_NO_USER",
      gates: {
        BOT_ENABLED: truthy(process.env.BOT_ENABLED),
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
        LIVE_ALLOWED: liveAllowed,
      },
      t: new Date().toISOString(),
    });
  }

  const body = await buildStatusPayload(userId);
  return json(200, body);
}

// -------------------- POST --------------------

export async function POST(req: Request) {
  const auth = await okAuth(req);
  if (!auth.ok) return jsonError("unauthorized", auth.status ?? 401, { reason: auth.error });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const userId = String(body?.user_id || "");
  if (!userId) return jsonError("Missing body field: user_id", 400);
  if (!isUuid(userId)) return jsonError("Invalid user_id (must be UUID).", 400);

  // normalize + validate action
  const actionRaw = String(body?.action || "status").toLowerCase();
  const action: Action =
    actionRaw === "dry_run_order"
      ? "dry_run_order"
      : actionRaw === "place_order"
        ? "place_order"
        : "status";

  const { tradingEnabled, armed, liveAllowed } = gates();
  const orderMode = getOrderMode();

  if (action === "status") {
    const statusBody = await buildStatusPayload(userId);
    return json(200, statusBody);
  }

  // Load user keys ONCE for the rest of the request
  let userKeys: {
    apiKeyName: string;
    privateKeyPem: string;
    jwtAlg: JwtAlg;
    keyAlg?: any;
  };
  try {
    const k = await requireUserKeys(userId);
    userKeys = {
      apiKeyName: k.apiKeyName,
      privateKeyPem: k.privateKeyPem,
      jwtAlg: k.jwtAlg,
      keyAlg: k.keyAlg ?? null,
    };
  } catch (e: any) {
    return jsonError("User Coinbase keys not available.", 400, {
      user_id: userId,
      error: String(e?.message || e),
    });
  }

  const product_id = "BTC-USD";
  const side = mustOneOf<Side>(body?.side, ["BUY", "SELL"] as const, "BUY");

  const quote_size = body?.quote_size != null ? String(body.quote_size) : null;
  const base_size_raw = body?.base_size != null ? String(body.base_size) : null;

  if (side === "BUY") {
    const q = Number(quote_size);
    if (!quote_size || !Number.isFinite(q) || q <= 0) {
      return jsonError('BUY requires quote_size > 0 (e.g., "1.00").', 400, {
        got: { quote_size },
      });
    }
  }

  const position = await fetchBtcPosition(userKeys);

  // If we can't confirm position, do NOT allow LIVE, but still allow DRY RUN
  if (!position.ok && action === "place_order") {
    return jsonError("LIVE blocked: cannot verify BTC position snapshot.", 503, {
      position,
    });
  }

  let base_size: string | null = base_size_raw;
  if (side === "SELL") {
    const available = Number((position as any)?.base_available || 0);
    if (!base_size) base_size = fmtBaseSize(available);
    const b = Number(base_size);
    if (!base_size || !Number.isFinite(b) || b <= 0) {
      return jsonError('SELL requires base_size > 0 (e.g., "0.00002").', 400, {
        got: { base_size },
        position,
      });
    }
  }

  // -------------------- POSITION RULES --------------------
  if (side === "BUY" && position.ok && position.has_position) {
    return jsonError("BUY blocked: BTC position already exists.", 409, { position });
  }
  if (side === "SELL" && position.ok && !position.has_position) {
    return jsonError("SELL blocked: no BTC position to exit.", 409, { position });
  }

  const client_order_id = `yc_${action}_${Date.now()}`;

  // -------------------- Build payload --------------------
  let payload: any;

  if (orderMode === "market") {
    // IMPORTANT:
    // - BUY uses quote_size (USD)
    // - SELL uses base_size (BTC)
    payload = {
      client_order_id,
      product_id,
      side,
      order_configuration:
        side === "BUY"
          ? { market_market_ioc: { quote_size } }
          : { market_market_ioc: { base_size } },
    };
  } else {
    const offsetBps = num(optEnv("MAKER_OFFSET_BPS"), 1.0);

    const book = await fetchBestAskBid(product_id, userKeys);
    if (!book.ok) {
      return jsonError("Maker mode blocked: cannot fetch order book.", 503, { book });
    }

    const bestBid = Number((book as any).bestBid || 0);
    const bestAsk = Number((book as any).bestAsk || 0);

    const refPrice = side === "BUY" ? bestBid : bestAsk;
    if (!refPrice || refPrice <= 0) {
      return jsonError("Maker mode blocked: invalid reference price.", 503, { book });
    }

    const limitPrice =
      side === "BUY"
        ? bpsAdjust(refPrice, offsetBps, "down")
        : bpsAdjust(refPrice, offsetBps, "up");

    if (!limitPrice || limitPrice <= 0) {
      return jsonError("Maker mode blocked: invalid limit price.", 503, {
        refPrice,
        limitPrice,
        offsetBps,
      });
    }

    let makerBaseSize: string;

    if (side === "BUY") {
      const q = Number(quote_size);
      const computed = q / limitPrice;
      if (!Number.isFinite(computed) || computed <= 0) {
        return jsonError("Maker BUY blocked: cannot compute base_size.", 400, {
          quote_size,
          limitPrice,
          computed,
        });
      }
      makerBaseSize = fmtBaseSize(computed);
    } else {
      makerBaseSize = base_size!;
    }

    payload = {
      client_order_id,
      product_id,
      side,
      order_configuration: {
        limit_limit_gtc: {
          base_size: makerBaseSize,
          limit_price: String(limitPrice),
          post_only: true,
        },
      },
      _maker: {
        bestBid,
        bestAsk,
        refPrice,
        limitPrice,
        offsetBps,
      },
    };
  }

  if (action === "dry_run_order") {
    return json(200, {
      ok: true,
      mode: "DRY_RUN",
      orderMode,
      userKeys: {
        user_id: userId,
        apiKeyNameTail: userKeys.apiKeyName.slice(-6),
        keyAlg: (userKeys as any).keyAlg ?? null,
        jwtAlg: userKeys.jwtAlg,
      },
      position,
      gates: { tradingEnabled, armed, liveAllowed },
      payload,
    });
  }

  if (!liveAllowed) {
    return jsonError("LIVE blocked by gates.", 403, {
      gates: {
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
      },
    });
  }

  // -------------------- LIVE place --------------------
  const path = "/api/v3/brokerage/orders";
  let token: string;

  try {
    token = buildCdpJwtWithUserKeys("POST", path, userKeys);
  } catch (e: any) {
    return jsonError("JWT build failed (invalid stored user key).", 500, {
      error: String(e?.message || e),
    });
  }

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);

  return json(res.ok ? 200 : res.status, {
    ok: res.ok,
    mode: "LIVE",
    orderMode,
    userKeys: {
      user_id: userId,
      apiKeyNameTail: userKeys.apiKeyName.slice(-6),
      keyAlg: (userKeys as any).keyAlg ?? null,
      jwtAlg: userKeys.jwtAlg,
    },
    position,
    payload,
    coinbase: parsed ?? text,
  });
}
