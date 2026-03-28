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

function toNum(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parseProduct(productId: string) {
  const [base, quote] = cleanString(productId).split("-");
  return {
    base: base || "BTC",
    quote: quote || "USD",
  };
}

function chicagoParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    weekday: lookup.weekday || "Mon",
  };
}

function currentWeeklyCycleKey(d = new Date()) {
  const { year, month, day, weekday } = chicagoParts(d);

  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const delta = weekdayMap[weekday] ?? 0;
  const mondayUtc = new Date(Date.UTC(year, month - 1, day - delta));
  const y = mondayUtc.getUTCFullYear();
  const m = String(mondayUtc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(mondayUtc.getUTCDate()).padStart(2, "0");

  return `WEEKLY_CT_${y}-${m}-${dd}`;
}

function lookbackIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
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
    if (m?.[1]) {
      delete payload[m[1]];
      continue;
    }

    const m2 = msg.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (m2?.[1]) {
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

async function alreadyBoughtThisCycle(userId: string, cycleKey: string) {
  try {
    const client = sb();

    const { data, error } = await client
      .from("trade_logs")
      .select("created_at, raw")
      .eq("bot", "sentinel")
      .eq("user_id", userId)
      .eq("side", "BUY")
      .eq("ok", true)
      .gte("created_at", lookbackIso(14))
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return {
        ok: false as const,
        matched: false,
        error: error.message || String(error),
      };
    }

    const rows = Array.isArray(data) ? data : [];
    const hit = rows.find((r: any) => cleanString(r?.raw?.cycle_key) === cycleKey);

    return {
      ok: true as const,
      matched: !!hit,
      last: hit || rows[0] || null,
    };
  } catch (e: any) {
    return {
      ok: false as const,
      matched: false,
      error: e?.message || String(e),
    };
  }
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
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

// -------------------- account checks --------------------
async function fetchAccounts(ctx: Ctx) {
  const r = await cbGet(ctx, "/api/v3/brokerage/accounts");
  if (!r.ok) {
    return {
      ok: false as const,
      status: r.status,
      coinbase: r.json ?? r.text,
      accounts: [] as any[],
    };
  }

  const accounts = Array.isArray((r.json as any)?.accounts)
    ? (r.json as any).accounts
    : [];

  return {
    ok: true as const,
    status: r.status,
    accounts,
  };
}

function summarizeCurrency(accounts: any[], currency: string) {
  const rows = accounts.filter((a: any) => a?.currency === currency);

  let totalAvailable = 0;
  let totalBalance = 0;
  let totalHold = 0;

  for (const a of rows) {
    const available = toNum(a?.available_balance?.value, 0);
    const balance = toNum(a?.balance?.value, 0);
    const hold = toNum(a?.hold?.value, 0);

    totalAvailable += available;
    totalBalance += balance;
    totalHold += hold;
  }

  return {
    currency,
    available: Number(totalAvailable.toFixed(8)),
    balance: Number(totalBalance.toFixed(8)),
    hold: Number(totalHold.toFixed(8)),
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

    const ENABLED = truthyDefault(process.env.SENTINEL_ENABLED, false);
    const DRY_RUN = truthyDefault(process.env.SENTINEL_DRY_RUN, true);
    const ENFORCE_WEEKLY_GUARD = truthyDefault(
      process.env.SENTINEL_ENFORCE_WEEKLY_GUARD,
      true
    );
    const FAIL_CLOSED_ON_GUARD_CHECK = truthyDefault(
      process.env.SENTINEL_FAIL_CLOSED_ON_GUARD_CHECK,
      true
    );
    const REQUIRE_AVAILABLE_FUNDS = truthyDefault(
      process.env.SENTINEL_REQUIRE_AVAILABLE_FUNDS,
      true
    );

    if (!ENABLED) {
      return json(200, { ok: false, reason: "sentinel_disabled" });
    }

    const product_id = process.env.SENTINEL_PRODUCT || "BTC-USD";
    const requestedQuoteSize = toNum(process.env.SENTINEL_BUY_USD || "10", 10);
    const quote_size = fmtQuoteSizeUsd(requestedQuoteSize);
    const cycle_key = currentWeeklyCycleKey();
    const trigger_source = req.headers.get("x-trigger-source") || "manual";

    const { base, quote } = parseProduct(product_id);

    const keyRes = await loadSentinelKey();
    if (!keyRes.ok) {
      return json(200, {
        ok: false,
        reason: "sentinel_key_load_failed",
        error: keyRes.error,
      });
    }

    const ctx: Ctx = keyRes.row;

    if (ENFORCE_WEEKLY_GUARD) {
      const guard = await alreadyBoughtThisCycle(ctx.user_id, cycle_key);

      if (!guard.ok && FAIL_CLOSED_ON_GUARD_CHECK) {
        await writeTradeLog({
          created_at: nowIso(),
          bot: "sentinel",
          symbol: product_id,
          side: "BUY",
          user_id: ctx.user_id,
          mode: "SENTINEL_WEEKLY_BUY",
          reason: "skip_cycle_guard_check_failed",
          ok: false,
          status: 0,
          raw: {
            kind: "sentinel_state",
            cycle_key,
            trigger_source,
            guard_error: guard.error,
          },
        });

        return json(200, {
          ok: false,
          reason: "cycle_guard_check_failed",
          cycle_key,
          error: guard.error,
        });
      }

      if (guard.ok && guard.matched) {
        await writeTradeLog({
          created_at: nowIso(),
          bot: "sentinel",
          symbol: product_id,
          side: "BUY",
          user_id: ctx.user_id,
          mode: "SENTINEL_WEEKLY_BUY",
          reason: "skip_already_bought_this_cycle",
          ok: true,
          status: 200,
          raw: {
            kind: "sentinel_state",
            cycle_key,
            trigger_source,
            previous_buy: guard.last || null,
          },
        });

        return json(200, {
          ok: true,
          reason: "already_bought_this_cycle",
          cycle_key,
          product_id,
          quote_size,
          user_id: ctx.user_id,
        });
      }
    }

    const acct = await fetchAccounts(ctx);
    if (!acct.ok) {
      return json(200, {
        ok: false,
        reason: "coinbase_accounts_failed",
        status: acct.status,
        error: acct.coinbase,
      });
    }

    const quoteBal = summarizeCurrency(acct.accounts, quote);
    const baseBal = summarizeCurrency(acct.accounts, base);

    if (REQUIRE_AVAILABLE_FUNDS && quoteBal.available + 1e-9 < requestedQuoteSize) {
      await writeTradeLog({
        created_at: nowIso(),
        bot: "sentinel",
        symbol: product_id,
        side: "BUY",
        user_id: ctx.user_id,
        mode: "SENTINEL_WEEKLY_BUY",
        reason: "skip_insufficient_funds",
        ok: true,
        status: 200,
        raw: {
          kind: "sentinel_state",
          cycle_key,
          trigger_source,
          requested_quote_size: requestedQuoteSize,
          available_quote_balance: quoteBal.available,
          quote_currency: quote,
          balances: { quote: quoteBal, base: baseBal },
        },
      });

      return json(200, {
        ok: true,
        reason: "insufficient_funds_skip",
        cycle_key,
        product_id,
        requested_quote_size: requestedQuoteSize,
        available_quote_balance: quoteBal.available,
        quote_currency: quote,
        user_id: ctx.user_id,
      });
    }

    if (DRY_RUN) {
      await writeTradeLog({
        created_at: nowIso(),
        bot: "sentinel",
        symbol: product_id,
        side: "BUY",
        user_id: ctx.user_id,
        mode: "SENTINEL_WEEKLY_BUY",
        reason: "dry_run_preview",
        ok: true,
        status: 200,
        raw: {
          kind: "sentinel_preview",
          cycle_key,
          trigger_source,
          product_id,
          quote_size,
          balances: { quote: quoteBal, base: baseBal },
        },
      });

      return json(200, {
        ok: true,
        mode: "SENTINEL_WEEKLY_BUY",
        dry_run: true,
        cycle_key,
        trigger_source,
        product_id,
        quote_size,
        user_id: ctx.user_id,
        key_alg: ctx.key_alg || "ES256",
        balances: {
          quote: quoteBal,
          base: baseBal,
        },
      });
    }

    const path = "/api/v3/brokerage/orders";
    const reqPayload = {
      client_order_id: `sentinel_${ctx.user_id}_${cycle_key}_${Date.now()}`,
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
      mode: "SENTINEL_WEEKLY_BUY",
      reason: buy.ok ? "scheduled_buy" : "buy_failed",
      ok: buy.ok,
      status: buy.status,
      raw: {
        kind: "coinbase_order",
        action: "SENTINEL_WEEKLY_BUY",
        cycle_key,
        trigger_source,
        balances_before: {
          quote: quoteBal,
          base: baseBal,
        },
        request: { path, method: "POST" },
        payload: reqPayload,
        response_status: buy.status,
        response: buy.json ?? buy.text,
      },
    });

    return json(200, {
      ok: buy.ok,
      mode: "SENTINEL_WEEKLY_BUY",
      dry_run: false,
      cycle_key,
      trigger_source,
      product_id,
      quote_size,
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