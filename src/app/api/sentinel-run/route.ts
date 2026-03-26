import { NextResponse } from "next/server";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// -------------------- helpers --------------------
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

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function cleanString(v: any) {
  return typeof v === "string" ? v.trim() : "";
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

function fmtQuoteSizeUsd(x: number) {
  const v = Math.max(0.01, x);
  return v.toFixed(2);
}

function fmtBaseSize(x: number) {
  const v = Math.max(0, x);
  return v.toFixed(8).replace(/\.?0+$/, "");
}

function minPositionBaseBtc() {
  const raw = (process.env.PULSE_MIN_POSITION_BASE_BTC || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 0.000001;
}

// -------------------- auth --------------------
function okAuth(req: Request) {
  const secret = (
    process.env.SENTINEL_SECRET ||
    process.env.CRON_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();

  if (!secret) return false;

  const h =
    req.headers.get("x-sentinel-secret") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization");

  if (h && (h === secret || h === `Bearer ${secret}`)) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

// -------------------- supabase --------------------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function writeTradeLog(row: Record<string, any>) {
  const client = sb();

  const payload: Record<string, any> = {
    created_at: row.created_at || nowIso(),
    ...row,
  };
  delete payload.t;

  let attempt = 0;
  let lastErr: any = null;

  while (attempt < 8) {
    attempt++;
    const { error } = await client.from("trade_logs").insert([payload]);
    if (!error) return;

    lastErr = error;
    const msg = String((error as any)?.message || error);

    const m = msg.match(
      /column\s+"([^"]+)"\s+of\s+relation\s+"trade_logs"\s+does\s+not\s+exist/i
    );
    if (m && m[1]) {
      delete payload[m[1]];
      continue;
    }

    const m2 = msg.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (m2 && m2[1]) {
      delete payload[m2[1]];
      continue;
    }

    break;
  }

  console.log(
    "[sentinel-run]",
    JSON.stringify({
      t: nowIso(),
      event: "DB_WRITE_GAVE_UP",
      data: String((lastErr as any)?.message || lastErr),
    })
  );
}

// -------------------- key loading --------------------
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

async function loadSentinelKey(): Promise<
  { ok: true; row: KeyRow } | { ok: false; error: any }
> {
  try {
    const sentinelUserId = requireEnv("SENTINEL_USER_ID");
    const client = sb();

    const { data, error } = await client
      .from("coinbase_keys")
      .select("user_id, api_key_name, private_key, key_alg")
      .eq("user_id", sentinelUserId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message || error };
    if (!data || !looksValidKeyRow(data)) {
      return { ok: false, error: "sentinel_key_not_found_or_invalid" };
    }

    return { ok: true, row: data as KeyRow };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// -------------------- coinbase signing --------------------
type Ctx = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
};

function algFor(ctx: Ctx): "ES256" | "EdDSA" {
  const raw = (ctx.key_alg || "").toLowerCase();
  if (raw.includes("ed") || raw.includes("eddsa") || raw.includes("ed25519")) {
    return "EdDSA";
  }
  return "ES256";
}

function buildCdpJwt(ctx: Ctx, method: "GET" | "POST", path: string) {
  const apiKeyName = cleanString(ctx.api_key_name);
  const privateKeyPem = normalizePem(ctx.private_key);

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const pathForUri = path.split("?")[0];
  const uri = `${method} api.coinbase.com${pathForUri}`;

  const payload = {
    iss: "cdp",
    sub: apiKeyName,
    nbf: now,
    exp: now + 60,
    uri,
  };

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

// -------------------- account checks --------------------
async function fetchBtcPosition(ctx: Ctx) {
  const r = await cbGet(ctx, "/api/v3/brokerage/accounts");
  if (!r.ok) {
    return {
      ok: false as const,
      has_position: false,
      base_available: 0,
      base_total: 0,
      status: r.status,
      coinbase: r.json ?? r.text,
    };
  }

  const accounts = Array.isArray((r.json as any)?.accounts)
    ? (r.json as any).accounts
    : [];

  const btcAccounts = accounts.filter((a: any) => a?.currency === "BTC");

  let totalAvailable = 0;
  let totalBalance = 0;

  for (const a of btcAccounts) {
    const available = Number(a?.available_balance?.value ?? 0);
    const balance = Number(a?.balance?.value ?? 0);
    const hold = Number(a?.hold?.value ?? 0);

    const safeAvailable = Number.isFinite(available) ? available : 0;
    const safeBalance = Number.isFinite(balance)
      ? balance
      : safeAvailable + (Number.isFinite(hold) ? hold : 0);

    totalAvailable += safeAvailable;
    totalBalance += safeBalance > 0 ? safeBalance : safeAvailable;
  }

  const minPos = minPositionBaseBtc();
  const baseAvailable = Number(totalAvailable.toFixed(8));
  const baseTotal = Number(totalBalance.toFixed(8));

  return {
    ok: true as const,
    has_position: baseTotal >= minPos,
    base_available: baseAvailable,
    base_total: baseTotal,
    min_pos: minPos,
  };
}

function extractOrderId(j: any): string | null {
  return (
    cleanString(j?.success_response?.order_id) ||
    cleanString(j?.order_id) ||
    cleanString(j?.id) ||
    null
  );
}

// -------------------- route --------------------
export async function POST(req: Request) {
  try {
    if (!okAuth(req)) {
      return json(401, { ok: false, reason: "unauthorized" });
    }

    const ENABLED = process.env.SENTINEL_ENABLED === "true";
    const DRY_RUN = truthyDefault(process.env.SENTINEL_DRY_RUN, true);
    const BLOCK_IF_POSITION = truthyDefault(
      process.env.SENTINEL_BLOCK_IF_POSITION_EXISTS,
      true
    );

    if (!ENABLED) {
      return json(200, { ok: false, reason: "sentinel_disabled" });
    }

    const product_id = process.env.SENTINEL_PRODUCT || "BTC-USD";
    const quote_size = fmtQuoteSizeUsd(
      Number(process.env.SENTINEL_BUY_USD || "10")
    );

    const keyRes = await loadSentinelKey();
    if (!keyRes.ok) {
      return json(200, {
        ok: false,
        reason: "sentinel_key_load_failed",
        error: keyRes.error,
      });
    }

    const ctx: Ctx = keyRes.row;

    const pos = await fetchBtcPosition(ctx);
    if (BLOCK_IF_POSITION && pos.ok && pos.has_position) {
      return json(200, {
        ok: false,
        reason: "position_exists_blocked",
        dry_run: DRY_RUN,
        product_id,
        quote_size,
        user_id: ctx.user_id,
        base_total: pos.base_total,
        base_available: pos.base_available,
      });
    }

    if (DRY_RUN) {
      return json(200, {
        ok: true,
        mode: "SENTINEL_BUY",
        product_id,
        quote_size,
        dry_run: true,
        user_id: ctx.user_id,
        key_alg: ctx.key_alg || "ES256",
        block_if_position_exists: BLOCK_IF_POSITION,
        current_position: pos,
      });
    }

    const path = "/api/v3/brokerage/orders";
    const reqPayload = {
      client_order_id: `sentinel_${ctx.user_id}_${Date.now()}`,
      product_id,
      side: "BUY",
      order_configuration: {
        market_market_ioc: {
          quote_size,
        },
      },
    };

    const buy = await cbPost(ctx, path, reqPayload);
    const orderId = extractOrderId(buy.json);

    await writeTradeLog({
      created_at: nowIso(),
      bot: "sentinel",
      symbol: product_id,
      side: "BUY",
      order_id: orderId,
      base_size: null,
      quote_size: Number(quote_size),
      price: null,
      user_id: ctx.user_id,
      mode: "SENTINEL_BUY_IOC",
      reason: "manual_trigger",
      ok: buy.ok,
      status: buy.status,
      raw: {
        kind: "coinbase_order",
        action: "SENTINEL_BUY_IOC",
        request: { path, method: "POST" },
        payload: reqPayload,
        response_status: buy.status,
        response: buy.json ?? buy.text,
      },
    });

    return json(200, {
      ok: buy.ok,
      mode: "SENTINEL_BUY",
      product_id,
      quote_size,
      dry_run: false,
      user_id: ctx.user_id,
      order_id: orderId,
      response: buy.json ?? buy.text,
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
}