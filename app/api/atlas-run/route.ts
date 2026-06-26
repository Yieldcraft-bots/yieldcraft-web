import { NextResponse } from "next/server";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { calculateAtlasAllocation } from "@/lib/atlas-allocation-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KeyRow = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
  product_scope?: string | null;
};

type AtlasMarketState = "ACCUMULATE" | "NORMAL" | "PATIENT";

type AtlasUserState = {
  user_id: string;
  last_cash_available_usd?: any;
  last_btc_available?: any;
  last_buy_at?: string | null;
  last_buy_amount_usd?: any;
  last_buy_order_id?: string | null;
  last_sell_detected_at?: string | null;
  last_sell_detected_btc_before?: any;
  last_sell_detected_btc_after?: any;
  cooldown_until?: string | null;
  market_state_used?: string | null;
  notes?: any;
};

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function cleanString(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function toNum(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function money(n: number) {
  return Number(n.toFixed(2));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

function sb() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

function okAuth(req: Request) {
  const secret = process.env.ATLAS_RUN_SECRET || process.env.CRON_SECRET || "";
  if (!secret.trim()) return false;

  const h =
    req.headers.get("x-atlas-run-secret") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization");

  if (h === secret || h === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

function algFor(keyAlg?: string | null): "ES256" | "EdDSA" {
  const raw = (keyAlg || "").toLowerCase();
  if (raw.includes("ed") || raw.includes("eddsa") || raw.includes("ed25519")) {
    return "EdDSA";
  }
  return "ES256";
}

function buildCdpJwt(
  apiKeyName: string,
  privateKeyPem: string,
  method: "GET" | "POST",
  path: string,
  alg: "ES256" | "EdDSA"
) {
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
    algorithm: alg as any,
    header: { kid: apiKeyName, nonce } as any,
  };

  return jwt.sign(payload as any, privateKeyPem as any, options as any);
}

async function cbGet(ctx: KeyRow, path: string) {
  const apiKeyName = cleanString(ctx.api_key_name);
  const privateKeyPem = normalizePem(ctx.private_key);
  const alg = algFor(ctx.key_alg);
  const token = buildCdpJwt(apiKeyName, privateKeyPem, "GET", path, alg);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

async function cbPost(ctx: KeyRow, path: string, payload: any) {
  const apiKeyName = cleanString(ctx.api_key_name);
  const privateKeyPem = normalizePem(ctx.private_key);
  const alg = algFor(ctx.key_alg);
  const token = buildCdpJwt(apiKeyName, privateKeyPem, "POST", path, alg);

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

function summarizeCurrency(accounts: any[], currency: string) {
  const rows = accounts.filter((a: any) => a?.currency === currency);

  let available = 0;
  let balance = 0;

  for (const a of rows) {
    available += toNum(a?.available_balance?.value, 0);
    balance += toNum(a?.balance?.value, 0);
  }

  return {
    currency,
    available: Number(available.toFixed(8)),
    balance: Number(balance.toFixed(8)),
  };
}

function summarizeBalances(accounts: any[]) {
  const usd = summarizeCurrency(accounts, "USD");
  const usdc = summarizeCurrency(accounts, "USDC");
  const btc = summarizeCurrency(accounts, "BTC");

  return {
    usd_available: usd.available,
    usdc_available: usdc.available,
    cash_available_usd: money(usd.available + usdc.available),
    btc_available: btc.available,
  };
}

function atlasMarketState(): AtlasMarketState {
  const raw = cleanString(process.env.ATLAS_MARKET_STATE).toUpperCase();

  if (raw === "ACCUMULATE") return "ACCUMULATE";
  if (raw === "PATIENT") return "PATIENT";

  return "NORMAL";
}

function deploymentPctForState(state: AtlasMarketState) {
  if (state === "ACCUMULATE") {
    return toNum(process.env.ATLAS_ACCUMULATE_DEPLOY_PCT || "40", 40);
  }

  if (state === "PATIENT") {
    return toNum(process.env.ATLAS_PATIENT_DEPLOY_PCT || "5", 5);
  }

  return toNum(process.env.ATLAS_NORMAL_DEPLOY_PCT || "20", 20);
}

function cooldownHours() {
  return toNum(process.env.ATLAS_SELL_COOLDOWN_HOURS || "72", 72);
}

function sellDetectThresholdBtc() {
  return toNum(process.env.ATLAS_SELL_DETECT_THRESHOLD_BTC || "0.00000001", 0.00000001);
}

function nowIso() {
  return new Date().toISOString();
}

function addHoursIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isCooldownActive(cooldownUntil?: string | null) {
  if (!cooldownUntil) return false;
  const t = new Date(cooldownUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function detectSellEvent(state: AtlasUserState | null, currentBtc: number) {
  if (!state) return null;

  const previousBtc = toNum(state.last_btc_available, 0);
  const threshold = sellDetectThresholdBtc();

  if (previousBtc > 0 && currentBtc + threshold < previousBtc) {
    return {
      detected: true,
      btc_before: previousBtc,
      btc_after: currentBtc,
      decrease_btc: Number((previousBtc - currentBtc).toFixed(8)),
      threshold_btc: threshold,
      cooldown_hours: cooldownHours(),
      cooldown_until: addHoursIso(cooldownHours()),
    };
  }

  return null;
}

async function loadAtlasUserState(client: any, userId: string): Promise<AtlasUserState | null> {
  const { data, error } = await client
    .from("atlas_user_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`atlas_user_state_lookup_failed: ${error.message}`);
  }

  return data || null;
}

async function upsertAtlasUserState(client: any, payload: any) {
  const { error } = await client
    .from("atlas_user_state")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    throw new Error(`atlas_user_state_upsert_failed: ${error.message}`);
  }
}

function allocationPreview(availableCash: number) {
  const state = atlasMarketState();

  const minBuy = toNum(
    process.env.ATLAS_MIN_BUY_USD ||
      process.env.ATLAS_MIN_CASH_USD ||
      "10",
    10
  );

  const minCash = toNum(
    process.env.ATLAS_MIN_CASH_USD || String(minBuy),
    minBuy
  );

  const deployPct = deploymentPctForState(state);

  const hardCap = toNum(
    process.env.ATLAS_HARD_MAX_BUY_USD || "0",
    0
  );

  const allocation = calculateAtlasAllocation({
    availableCash,
    deployPct,
    minCash,
    minBuy,
    hardCap,
  });

  return {
    eligible: allocation.eligible,
    reason: allocation.reason,
    market_state: state,
    available_cash_usd: availableCash,
    proposed_buy_usd: allocation.proposedBuyUsd,
    remaining_cash_usd: allocation.remainingCashUsd,
    calculated_buy_usd: allocation.calculatedBuyUsd,
    policy: {
      min_cash_usd: minCash,
      min_buy_usd: minBuy,
      deploy_pct: deployPct,
      hard_max_buy_usd: hardCap > 0 ? hardCap : null,
      reserve_model: "none_dedicated_risk_capital",
      states: {
        ACCUMULATE: "deploy faster",
        NORMAL: "standard accumulation",
        PATIENT: "deploy slower",
      },
    },
  };
}

function buildFundingPlan(
  usdAvailable: number,
  usdcAvailable: number,
  proposedBuy: number
) {
  if (proposedBuy <= 0) {
    return {
      executable: false,
      funding_currency: null,
      product_id: null,
      reason: "no_proposed_buy",
    };
  }

  if (usdAvailable >= proposedBuy) {
    return {
      executable: true,
      funding_currency: "USD",
      product_id: "BTC-USD",
      reason: "usd_available",
    };
  }

  if (usdcAvailable >= proposedBuy) {
    return {
      executable: true,
      funding_currency: "USDC",
      product_id: "BTC-USDC",
      reason: "usdc_available",
    };
  }

  if (usdAvailable + usdcAvailable >= proposedBuy) {
    return {
      executable: false,
      funding_currency: "MIXED",
      product_id: null,
      reason: "combined_cash_sufficient_but_single_currency_insufficient",
    };
  }

  return {
    executable: false,
    funding_currency: null,
    product_id: null,
    reason: "insufficient_single_currency_cash",
  };
}

function buildOrderPayload(
  userId: string,
  productId: string,
  proposedBuyUsd: number,
  live: boolean
) {
  const quoteSize = money(proposedBuyUsd).toFixed(2);
  const mode = live ? "live" : "dry_run";

  return {
    client_order_id: `yc_atlas_${mode}_${userId.slice(0, 8)}_${Date.now()}`,
    product_id: productId,
    side: "BUY",
    order_configuration: {
      market_market_ioc: {
        quote_size: quoteSize,
      },
    },
  };
}

function extractOrderId(parsed: any) {
  const id =
    parsed?.success_response?.order_id ||
    parsed?.order_id ||
    parsed?.order?.order_id ||
    null;

  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function POST(req: Request) {
  try {
    if (!okAuth(req)) {
      return json(401, { ok: false, reason: "unauthorized" });
    }

    const url = new URL(req.url);
    const targetUserId = cleanString(url.searchParams.get("target_user_id"));

    const ATLAS_RUN_ENABLED = truthy(process.env.ATLAS_RUN_ENABLED);
    const ATLAS_DRY_RUN = process.env.ATLAS_DRY_RUN !== "false";
    const ATLAS_LIVE_ARMED = truthy(process.env.ATLAS_LIVE_ARMED);

    if (!ATLAS_RUN_ENABLED) {
      return json(200, {
        ok: false,
        reason: "atlas_run_disabled",
        dry_run: ATLAS_DRY_RUN,
        live_armed: ATLAS_LIVE_ARMED,
        target_user_id: targetUserId || null,
      });
    }

    const liveRequested = !ATLAS_DRY_RUN;

    if (liveRequested && !ATLAS_LIVE_ARMED) {
      return json(403, {
        ok: false,
        reason: "live_blocked_atlas_live_armed_false",
        dry_run: ATLAS_DRY_RUN,
        live_armed: ATLAS_LIVE_ARMED,
        target_user_id: targetUserId || null,
      });
    }

    if (liveRequested && !targetUserId) {
      return json(403, {
        ok: false,
        reason: "live_blocked_target_user_required",
        dry_run: ATLAS_DRY_RUN,
        live_armed: ATLAS_LIVE_ARMED,
        target_user_id: null,
      });
    }

    const client = sb();

    let keyQuery = client
      .from("coinbase_keys")
      .select("user_id, api_key_name, private_key, key_alg, product_scope, updated_at")
      .eq("product_scope", "atlas")
      .order("updated_at", { ascending: false });

    if (targetUserId) {
      keyQuery = keyQuery.eq("user_id", targetUserId);
    }

    const { data, error } = await keyQuery;

    if (error) {
      return json(500, {
        ok: false,
        reason: "coinbase_keys_lookup_failed",
        target_user_id: targetUserId || null,
        error: error.message,
      });
    }

    const keys = Array.isArray(data) ? (data as KeyRow[]) : [];
    const users = [];
    let ordersPlaced = 0;

    for (const key of keys) {
      try {
        const memoryBefore = await loadAtlasUserState(client, key.user_id);
        const acct = await cbGet(key, "/api/v3/brokerage/accounts");

        if (!acct.ok) {
          users.push({
            user_id: key.user_id,
            product_scope: "atlas",
            status: "coinbase_accounts_failed",
            action: "no_order_placed",
            coinbase_status: acct.status,
            memory: {
              loaded: !!memoryBefore,
            },
          });
          continue;
        }

        const accounts = Array.isArray((acct.json as any)?.accounts)
          ? (acct.json as any).accounts
          : [];

        const balancesBefore = summarizeBalances(accounts);
        const state = atlasMarketState();

        const sellEvent = detectSellEvent(memoryBefore, balancesBefore.btc_available);
        const cooldownActive =
          !sellEvent && isCooldownActive(memoryBefore?.cooldown_until || null);

        if (sellEvent) {
          await upsertAtlasUserState(client, {
            user_id: key.user_id,
            last_cash_available_usd: balancesBefore.cash_available_usd,
            last_btc_available: balancesBefore.btc_available,
            last_sell_detected_at: nowIso(),
            last_sell_detected_btc_before: sellEvent.btc_before,
            last_sell_detected_btc_after: sellEvent.btc_after,
            cooldown_until: sellEvent.cooldown_until,
            market_state_used: state,
            notes: {
              event: "sell_detected",
              reason: "btc_balance_decreased",
              decrease_btc: sellEvent.decrease_btc,
              cooldown_hours: sellEvent.cooldown_hours,
            },
          });

          users.push({
            user_id: key.user_id,
            product_scope: "atlas",
            status: "cooldown_started",
            action: "no_order_sell_detected",
            balances: balancesBefore,
            memory: {
              loaded: !!memoryBefore,
              sell_detected: true,
              cooldown_until: sellEvent.cooldown_until,
              btc_before: sellEvent.btc_before,
              btc_after: sellEvent.btc_after,
            },
            allocation: {
              eligible: false,
              reason: "sell_detected_cooldown_started",
              market_state: state,
              proposed_buy_usd: 0,
            },
            funding_plan: {
              executable: false,
              funding_currency: null,
              product_id: null,
              reason: "sell_detected_cooldown_started",
            },
            dry_run_order_payload: null,
          });
          continue;
        }

        if (cooldownActive) {
          await upsertAtlasUserState(client, {
            user_id: key.user_id,
            last_cash_available_usd: balancesBefore.cash_available_usd,
            last_btc_available: balancesBefore.btc_available,
            cooldown_until: memoryBefore?.cooldown_until || null,
            market_state_used: state,
            notes: {
              event: "cooldown_active",
              reason: "client_liquidation_grace_period",
            },
          });

          users.push({
            user_id: key.user_id,
            product_scope: "atlas",
            status: "cooldown_active",
            action: "no_order_cooldown_active",
            balances: balancesBefore,
            memory: {
              loaded: !!memoryBefore,
              cooldown_active: true,
              cooldown_until: memoryBefore?.cooldown_until || null,
            },
            allocation: {
              eligible: false,
              reason: "cooldown_active",
              market_state: state,
              proposed_buy_usd: 0,
            },
            funding_plan: {
              executable: false,
              funding_currency: null,
              product_id: null,
              reason: "cooldown_active",
            },
            dry_run_order_payload: null,
          });
          continue;
        }

        const allocation = allocationPreview(balancesBefore.cash_available_usd);

        const fundingPlan = buildFundingPlan(
          balancesBefore.usd_available,
          balancesBefore.usdc_available,
          allocation.proposed_buy_usd
        );

        const canBuildOrder =
          allocation.eligible && fundingPlan.executable && fundingPlan.product_id;

        const orderPayload = canBuildOrder
          ? buildOrderPayload(
              key.user_id,
              fundingPlan.product_id as string,
              allocation.proposed_buy_usd,
              liveRequested
            )
          : null;

        if (!orderPayload) {
          await upsertAtlasUserState(client, {
            user_id: key.user_id,
            last_cash_available_usd: balancesBefore.cash_available_usd,
            last_btc_available: balancesBefore.btc_available,
            cooldown_until: memoryBefore?.cooldown_until || null,
            market_state_used: state,
            notes: {
              event: "observed_no_order",
              allocation_reason: allocation.reason,
            },
          });

          users.push({
            user_id: key.user_id,
            product_scope: "atlas",
            status: "balance_checked",
            action: "preview_only_no_order",
            balances: balancesBefore,
            memory: {
              loaded: !!memoryBefore,
              cooldown_active: false,
            },
            allocation,
            funding_plan: fundingPlan,
            dry_run_order_payload: null,
          });
          continue;
        }

        if (!liveRequested) {
          await upsertAtlasUserState(client, {
            user_id: key.user_id,
            last_cash_available_usd: balancesBefore.cash_available_usd,
            last_btc_available: balancesBefore.btc_available,
            cooldown_until: memoryBefore?.cooldown_until || null,
            market_state_used: state,
            notes: {
              event: "dry_run_order_ready",
              proposed_buy_usd: allocation.proposed_buy_usd,
              product_id: fundingPlan.product_id,
            },
          });

          users.push({
            user_id: key.user_id,
            product_scope: "atlas",
            status: "balance_checked",
            action: "dry_run_order_payload_ready",
            balances: balancesBefore,
            memory: {
              loaded: !!memoryBefore,
              cooldown_active: false,
            },
            allocation,
            funding_plan: fundingPlan,
            dry_run_order_payload: orderPayload,
          });
          continue;
        }

        const orderPath = "/api/v3/brokerage/orders";
        const orderRes = await cbPost(key, orderPath, orderPayload);
        const orderId = extractOrderId(orderRes.json);

        await sleep(1250);

        const acctAfter = await cbGet(key, "/api/v3/brokerage/accounts");
        const accountsAfter =
          acctAfter.ok && Array.isArray((acctAfter.json as any)?.accounts)
            ? (acctAfter.json as any).accounts
            : [];

        const balancesAfter = acctAfter.ok ? summarizeBalances(accountsAfter) : null;

        if (orderRes.ok) ordersPlaced += 1;

        await upsertAtlasUserState(client, {
          user_id: key.user_id,
          last_cash_available_usd:
            balancesAfter?.cash_available_usd ?? balancesBefore.cash_available_usd,
          last_btc_available: balancesAfter?.btc_available ?? balancesBefore.btc_available,
          last_buy_at: orderRes.ok ? nowIso() : memoryBefore?.last_buy_at || null,
          last_buy_amount_usd: orderRes.ok
            ? allocation.proposed_buy_usd
            : memoryBefore?.last_buy_amount_usd || null,
          last_buy_order_id: orderRes.ok ? orderId : memoryBefore?.last_buy_order_id || null,
          cooldown_until: memoryBefore?.cooldown_until || null,
          market_state_used: state,
          notes: {
            event: orderRes.ok ? "live_buy_submitted" : "live_buy_failed",
            product_id: fundingPlan.product_id,
            proposed_buy_usd: allocation.proposed_buy_usd,
            coinbase_status: orderRes.status,
            order_id: orderId,
          },
        });

        users.push({
          user_id: key.user_id,
          product_scope: "atlas",
          status: orderRes.ok ? "live_order_submitted" : "live_order_failed",
          action: orderRes.ok ? "live_buy_submitted" : "live_buy_failed",
          balances: {
            before: balancesBefore,
            after: balancesAfter,
          },
          memory: {
            loaded: !!memoryBefore,
            updated: true,
            cooldown_active: false,
          },
          allocation,
          funding_plan: fundingPlan,
          order_payload: orderPayload,
          coinbase_status: orderRes.status,
          coinbase: orderRes.json ?? orderRes.text,
          order_id: orderId,
        });
      } catch (e: any) {
        users.push({
          user_id: key.user_id,
          product_scope: "atlas",
          status: "error",
          action: "no_order_placed",
          error: e?.message || String(e),
        });
      }
    }

    return json(200, {
      ok: true,
      mode: liveRequested
        ? "ATLAS_LIVE_GATED_EXECUTION"
        : "ATLAS_POLICY_V2_MEMORY_DRY_RUN_PREVIEW",
      dry_run: ATLAS_DRY_RUN,
      live_armed: ATLAS_LIVE_ARMED,
      target_user_id: targetUserId || null,
      atlas_key_rows: keys.length,
      atlas_users_found: users.length,
      orders_placed: ordersPlaced,
      users,
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      reason: "server_error",
      error: err?.message || String(err),
    });
  }
}