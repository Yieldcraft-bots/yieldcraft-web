// src/app/api/connect-keys/route.ts
// Multi-user Coinbase CDP key connect + verify + encrypted storage (Supabase)
//
// Expects from client:
// - user_id (string)
// - coinbase_api_key_name (string)   e.g. "organizations/.../apiKeys/<kid>"
// - coinbase_private_key (string)   PEM (ES256)
// Optional:
// - label (string)
//
// Stores (encrypted) per user in Supabase table: user_exchange_keys
// Verifies by calling Coinbase GET /api/v3/brokerage/accounts with signed CDP JWT.
//
// REQUIRED ENV:
// - YC_MASTER_KEY_B64
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// NOTE: This does not enable trading; it only connects + verifies + stores keys securely.

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function normalizePem(pem: string) {
  let p = (pem || "").trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

/**
 * AES-256-GCM encryption using YC_MASTER_KEY_B64 (32 bytes base64)
 * Output format: v1:<iv_b64>:<tag_b64>:<cipher_b64>
 */
function encryptString(plain: string) {
  const keyB64 = requireEnv("YC_MASTER_KEY_B64");
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("YC_MASTER_KEY_B64 must decode to 32 bytes");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plain, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

function buildCdpJwt(apiKeyName: string, privateKeyPem: string, method: "GET" | "POST", path: string) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${method} api.coinbase.com${path}`;

  return jwt.sign(
    { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri },
    privateKeyPem as any,
    { algorithm: "ES256", header: { kid: apiKeyName, nonce } as any }
  );
}

async function coinbaseVerify(apiKeyName: string, privateKeyPem: string) {
  const path = "/api/v3/brokerage/accounts";
  const token = buildCdpJwt(apiKeyName, privateKeyPem, "GET", path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);

  return {
    ok: res.ok,
    status: res.status,
    coinbase: parsed ?? text,
  };
}

async function upsertSupabaseKey(row: {
  user_id: string;
  exchange: string;
  label: string;
  api_key_name: string;
  private_key_enc: string;
  verified_ok: boolean;
  verified_at: string;
}) {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(`${url}/rest/v1/user_exchange_keys`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);

  if (!res.ok) {
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }

  return parsed ?? text;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const user_id = String(body?.user_id || "").trim();
  const apiKeyName = String(body?.coinbase_api_key_name || "").trim();
  const privateKeyRaw = String(body?.coinbase_private_key || "").trim();
  const label = String(body?.label || "coinbase").trim();

  if (!user_id) return json(400, { ok: false, error: "Missing user_id" });
  if (!apiKeyName) return json(400, { ok: false, error: "Missing coinbase_api_key_name" });
  if (!privateKeyRaw) return json(400, { ok: false, error: "Missing coinbase_private_key" });

  const privateKeyPem = normalizePem(privateKeyRaw);

  // Basic PEM sanity check
  if (!privateKeyPem.includes("BEGIN") || !privateKeyPem.includes("PRIVATE KEY")) {
    return json(400, {
      ok: false,
      error: "Private key must be PEM text (CDP ES256). Not an API secret.",
    });
  }

  // 1) Verify against Coinbase
  let verify;
  try {
    verify = await coinbaseVerify(apiKeyName, privateKeyPem);
  } catch (e: any) {
    return json(500, { ok: false, error: "Coinbase verify failed", detail: String(e?.message || e) });
  }

  if (!verify.ok) {
    // Do NOT store unverified secrets
    return json(401, {
      ok: false,
      verified: false,
      error: "Coinbase credentials invalid or not authorized",
      coinbase_status: verify.status,
      coinbase: verify.coinbase,
    });
  }

  // 2) Encrypt + store in Supabase
  const enc = encryptString(privateKeyPem);

  const nowIso = new Date().toISOString();

  try {
    await upsertSupabaseKey({
      user_id,
      exchange: "coinbase",
      label,
      api_key_name: apiKeyName,
      private_key_enc: enc,
      verified_ok: true,
      verified_at: nowIso,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: "Storage failed", detail: String(e?.message || e) });
  }

  return json(200, {
    ok: true,
    verified: true,
    exchange: "coinbase",
    user_id,
    label,
    verified_at: nowIso,
  });
}

// Helpful ping
export async function GET() {
  return json(200, { ok: true, status: "CONNECT_KEYS_READY" });
}
