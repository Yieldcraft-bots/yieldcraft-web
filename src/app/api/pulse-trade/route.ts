import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/* =========================================================
   Helpers
   ========================================================= */

function jsonOk(data: any, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function jsonError(message: string, extra: any = {}, status = 400) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function normalizeBool(v: any): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function normalizePem(raw: string): string {
  // handles: quoted strings, \n, CRLF, accidental extra spaces
  let s = (raw ?? "").trim();

  // strip surrounding quotes if present
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }

  // convert escaped newlines into real newlines
  s = s.replace(/\\n/g, "\n");

  // normalize line endings
  s = s.replace(/\r\n/g, "\n");

  return s.trim();
}

async function safeReadJson(req: Request): Promise<{ ok: true; data: any } | { ok: false; raw: string }> {
  const raw = await req.text();

  // allow empty body (we'll default action to "status")
  if (!raw || raw.trim() === "") return { ok: true, data: {} };

  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, raw };
  }
}

function buildCoinbaseJwt(method: string, path: string) {
  const apiKeyName = process.env.COINBASE_API_KEY_NAME || "";
  const privateKeyRaw = process.env.COINBASE_PRIVATE_KEY || "";
  const alg = (process.env.COINBASE_KEY_ALG || "ES256").toUpperCase();

  if (!apiKeyName) throw new Error("Missing COINBASE_API_KEY_NAME");
  if (!privateKeyRaw) throw new Error("Missing COINBASE_PRIVATE_KEY");

  const privateKey = normalizePem(privateKeyRaw);

  const now = Math.floor(Date.now() / 1000);
  const uri = `${method.toUpperCase()} api.coinbase.com${path}`;

  // Coinbase-style nonce header (works with your other canary/test approach)
  const nonce = crypto.randomBytes(16).toString("hex");

  const token = jwt.sign(
    {
      iss: "cdp",
      sub: apiKeyName,
      nbf: now,
      exp: now + 60,
      uri,
    },
    privateKey,
    {
      algorithm: alg as jwt.Algorithm,
      header: { kid: apiKeyName, nonce },
    }
  );

  return token;
}

/* =========================================================
   Route
   ========================================================= */

export async function GET() {
  const EXECUTION_ENABLED = normalizeBool(process.env.EXECUTION_ENABLED);
  return jsonOk({
    status: "PULSE_TRADE_READY",
    trading_enabled: EXECUTION_ENABLED,
    note: "Use POST with JSON body. Empty body defaults to action=status.",
    actions: ["status", "dry_run_order", "place_order"],
  });
}

export async function POST(req: Request) {
  const EXECUTION_ENABLED = normalizeBool(process.env.EXECUTION_ENABLED);

  const parsed = await safeReadJson(req);
  if (!parsed.ok) {
    return jsonError(
      "Invalid JSON body.",
      { raw_preview: parsed.raw.slice(0, 300) },
      400
    );
  }

  const body = parsed.data ?? {};
  const action = String(body.action ?? "status");

  // Always-available status
  if (action === "status") {
    return jsonOk({
      status: "PULSE_TRADE_READY",
      trading_enabled: EXECUTION_ENABLED,
      env_seen: { EXECUTION_ENABLED: String(process.env.EXECUTION_ENABLED ?? "") },
      note: "POST {action:'dry_run_order'|'place_order'} to build/place an order.",
    });
  }

  // Inputs (defaults)
  const product_id = String(body.product_id ?? "BTC-USD");
  const side = String(body.side ?? "BUY").toUpperCase();
  const quote_size = body.quote_size != null ? String(body.quote_size) : "1.00";
  const base_size = body.base_size != null ? String(body.base_size) : "0.00002";

  // Build the order payload (Coinbase /api/v3/brokerage/orders)
  const client_order_id = body.client_order_id
    ? String(body.client_order_id)
    : `yc_${action}_${Date.now()}`;

  const orderPayload: any = {
    client_order_id,
    product_id,
    side,
    order_configuration: {
      market_market_ioc:
        side === "BUY" ? { quote_size } : { base_size },
    },
  };

  if (action === "dry_run_order") {
    return jsonOk({
      mode: "DRY_RUN",
      trading_enabled: EXECUTION_ENABLED,
      endpoint: "POST /api/pulse-trade",
      would_call: "POST https://api.coinbase.com/api/v3/brokerage/orders",
      payload: orderPayload,
      note:
        "Dry-run only. No order was placed. Use action=place_order to execute (requires EXECUTION_ENABLED=true).",
    });
  }

  if (action === "place_order") {
    if (!EXECUTION_ENABLED) {
      return jsonError(
        "Execution gate is OFF. Set EXECUTION_ENABLED=true in Vercel and redeploy.",
        { trading_enabled: EXECUTION_ENABLED },
        403
      );
    }

    try {
      const path = "/api/v3/brokerage/orders";
      const token = buildCoinbaseJwt("POST", path);

      // simple timeout guard
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`https://api.coinbase.com${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const text = await res.text();
      let coinbase: any = text;
      try {
        coinbase = JSON.parse(text);
      } catch {
        // leave as text
      }

      return NextResponse.json(
        {
          ok: res.ok,
          mode: "LIVE",
          trading_enabled: true,
          status: res.status,
          payload: orderPayload,
          coinbase,
        },
        { status: res.ok ? 200 : res.status }
      );
    } catch (e: any) {
      return jsonError(e?.message || "Live execution failed.", { action }, 500);
    }
  }

  return jsonError("Unknown action.", { action }, 400);
}
