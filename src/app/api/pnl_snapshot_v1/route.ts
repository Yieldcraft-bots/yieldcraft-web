// src/app/api/pnl_enrich_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

// ---------- Coinbase auth (CDP JWT) ----------
// Requires these envs to already exist in Vercel (same ones your trading routes use):
// COINBASE_API_KEY_NAME, COINBASE_PRIVATE_KEY, COINBASE_KEY_ALG (ES256 or EdDSA)
function normalizePem(pem: string) {
  return pem
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
}

function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtES256(privateKeyPem: string, header: any, payload: any) {
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;

  const sig = crypto.createSign("RSA-SHA256"); // NOTE: crypto uses ECDSA via key type even though name says RSA-SHA256
  sig.update(data);
  sig.end();

  const der = sig.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" });
  const encSig = b64url(der);

  return `${data}.${encSig}`;
}

function signJwtEdDSA(privateKeyPem: string, header: any, payload: any) {
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;

  const signature = crypto.sign(null, Buffer.from(data), privateKeyPem);
  const encSig = b64url(signature);

  return `${data}.${encSig}`;
}

function buildCdpJwt(method: string, path: string) {
  const keyName = requireEnv("COINBASE_API_KEY_NAME");
  const keyAlgRaw = cleanString(process.env.COINBASE_KEY_ALG || "ES256").toUpperCase();
  const alg = keyAlgRaw === "ED25519" || keyAlgRaw === "EDDSA" ? "EdDSA" : "ES256";

  const pem = normalizePem(requireEnv("COINBASE_PRIVATE_KEY"));

  // Coinbase CDP expects: uri = "<METHOD> api.coinbase.com<PATH>"
  const uri = `${method.toUpperCase()} api.coinbase.com${path}`;

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg,
    kid: keyName,
    nonce: crypto.randomBytes(12).toString("hex"),
    typ: "JWT",
  };
  const payload = {
    iss: "cdp",
    nbf: now,
    exp: now + 60,
    sub: keyName,
    uri,
  };

  return alg === "EdDSA"
    ? signJwtEdDSA(pem, header, payload)
    : signJwtES256(pem, header, payload);
}

async function coinbaseFetch(method: "GET" | "POST", path: string) {
  const jwt = buildCdpJwt(method, path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = { _raw: text };
  }

  return { ok: res.ok, status: res.status, json: j, text };
}

// Try to extract fill facts from Coinbase historical order response
function extractOrderFacts(j: any) {
  // Coinbase shapes vary; try a bunch of common paths
  const order =
    j?.order ||
    j?.data?.order ||
    j?.success_response?.order ||
    j?.response?.order ||
    j?.order_details ||
    j?.result?.order ||
    j;

  const filledSize =
    Number(order?.filled_size) ||
    Number(order?.filled_value) || // sometimes used differently, but keep as fallback
    Number(order?.filled_amount) ||
    Number(order?.filled_quantity) ||
    0;

  const avgPx =
    Number(order?.average_filled_price) ||
    Number(order?.avg_filled_price) ||
    Number(order?.average_price) ||
    0;

  // Try fills arrays (if present)
  const fills =
    order?.fills ||
    order?.fill ||
    order?.order_fills ||
    j?.fills ||
    j?.data?.fills ||
    null;

  let derivedBase = 0;
  let derivedQuote = 0;
  let derivedAvg = 0;

  if (Array.isArray(fills) && fills.length > 0) {
    let totalBase = 0;
    let totalQuote = 0;

    for (const f of fills) {
      const base = Number(f?.size || f?.filled_size || f?.base_size || 0);
      const price = Number(f?.price || f?.fill_price || 0);
      if (Number.isFinite(base) && base > 0) {
        totalBase += base;
        if (Number.isFinite(price) && price > 0) totalQuote += base * price;
      }
    }

    derivedBase = totalBase;
    derivedQuote = totalQuote;
    derivedAvg = totalBase > 0 ? totalQuote / totalBase : 0;
  }

  const base_size = (filledSize > 0 ? filledSize : derivedBase) || 0;
  const price = (avgPx > 0 ? avgPx : derivedAvg) || 0;

  // If we can derive quote notional, nice to store (optional)
  const quote_size = derivedQuote > 0 ? derivedQuote : (base_size > 0 && price > 0 ? base_size * price : 0);

  return {
    base_size: Number.isFinite(base_size) && base_size > 0 ? base_size : null,
    price: Number.isFinite(price) && price > 0 ? price : null,
    quote_size: Number.isFinite(quote_size) && quote_size > 0 ? quote_size : null,
    fills: Array.isArray(fills) ? fills : null,
    order_raw: order || null,
  };
}

export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const runId = `enrich_${shortId()}`;

  const order_id = cleanString(url.searchParams.get("order_id"));
  const limit = Math.min(200, Math.max(1, num(url.searchParams.get("limit"), 25)));

  try {
    const client = sb();

    // If a single order_id is supplied, enrich just that one.
    // Otherwise enrich latest rows missing price/base_size.
    let rows: any[] = [];

    if (order_id) {
      const { data, error } = await client
        .from("trade_logs")
        .select("created_at, side, order_id, price, base_size, quote_size, raw")
        .eq("order_id", order_id)
        .limit(1);

      if (error) return json(500, { ok: false, runId, error: error.message || error });
      rows = Array.isArray(data) ? data : [];
    } else {
      const { data, error } = await client
        .from("trade_logs")
        .select("created_at, side, order_id, price, base_size, quote_size, raw")
        .not("order_id", "is", null)
        .or("price.is.null,base_size.is.null")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return json(500, { ok: false, runId, error: error.message || error });
      rows = Array.isArray(data) ? data : [];
    }

    let updated = 0;
    const details: any[] = [];

    for (const r of rows) {
      const oid = cleanString(r?.order_id);
      if (!oid) continue;

      const path = `/api/v3/brokerage/orders/historical/${encodeURIComponent(oid)}`;
      const cb = await coinbaseFetch("GET", path);

      if (!cb.ok) {
        details.push({ order_id: oid, ok: false, status: cb.status, error: cb.json || cb.text });
        continue;
      }

      const facts = extractOrderFacts(cb.json);

      // Only update if we actually got something useful
      const patch: any = {};
      if (facts.price != null) patch.price = Number(facts.price);
      if (facts.base_size != null) patch.base_size = Number(facts.base_size);
      if (facts.quote_size != null) patch.quote_size = Number(facts.quote_size);

      // Store fills/order into raw for later debugging
      const rawPrev = typeof r?.raw === "object" && r?.raw ? r.raw : {};
      patch.raw = {
        ...rawPrev,
        enrich_v1: {
          at: new Date().toISOString(),
          order_id: oid,
          coinbase_path: path,
          fills: facts.fills,
          order: facts.order_raw,
        },
      };

      const { error: upErr } = await client
        .from("trade_logs")
        .update(patch)
        .eq("order_id", oid);

      if (upErr) {
        details.push({ order_id: oid, ok: false, status: 500, error: upErr.message || upErr });
        continue;
      }

      updated += 1;
      details.push({
        order_id: oid,
        ok: true,
        price: patch.price ?? null,
        base_size: patch.base_size ?? null,
        quote_size: patch.quote_size ?? null,
      });
    }

    return json(200, {
      ok: true,
      runId,
      requested_order_id: order_id || null,
      scanned: rows.length,
      updated,
      details,
    });
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}