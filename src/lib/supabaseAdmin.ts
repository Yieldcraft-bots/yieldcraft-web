// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function normalizePem(pem: string) {
  let p = (pem || "").trim();

  // strip accidental wrapping quotes
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }

  // convert literal \n into real newlines, normalize CRLF
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function inferKeyAlgFromPrivateKey(privateKeyRaw: string): "ES256" | "ed25519" {
  const pem = normalizePem(privateKeyRaw);

  // If invalid, createPrivateKey throws
  const keyObj = crypto.createPrivateKey(pem);

  // Node returns: "ec" | "ed25519" | "rsa" | ...
  const t = (keyObj as any).asymmetricKeyType as string | undefined;

  if (t === "ed25519") return "ed25519";
  if (t === "ec") return "ES256";

  return "ES256";
}

function canonicalKeyAlg(v: any): "ES256" | "ed25519" | null {
  const s = String(v || "").trim().toLowerCase();
  if (!s || s === "unknown" || s === "null") return null;
  if (s.includes("ed25519") || s.includes("eddsa")) return "ed25519";
  if (s.includes("es256") || s === "ec") return "ES256";
  return null;
}

// IMPORTANT: Service role key must ONLY be used server-side (api routes / server actions)
export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!url)
    throw new Error(
      "Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)"
    );

  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

type KeyRow = {
  id?: string | null;
  api_key_name?: string | null;
  private_key?: string | null;
  key_alg?: string | null;
  created_at?: string | null;
};

async function fetchLatestKeyRow(table: string, userId: string) {
  const sb = supabaseAdmin();

  // We try to select common columns; if a table differs, Supabase will error — we treat as "not found"
  const { data, error } = await sb
    .from(table)
    .select("id, api_key_name, private_key, key_alg, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<KeyRow>();

  if (error) return null;
  if (!data?.api_key_name || !data?.private_key) return null;

  return { sb, data };
}

async function autoHealKeyAlg(
  sb: ReturnType<typeof supabaseAdmin>,
  table: string,
  rowId: string | null | undefined,
  privateKey: string,
  currentKeyAlg: string | null | undefined
) {
  if (!rowId) return canonicalKeyAlg(currentKeyAlg);

  let keyAlg = canonicalKeyAlg(currentKeyAlg);

  // infer + persist if missing/unknown
  if (!keyAlg) {
    try {
      const inferred = inferKeyAlgFromPrivateKey(String(privateKey));
      const canonical = inferred === "ed25519" ? "ed25519" : "ES256";

      const { error: upErr } = await sb
        .from(table)
        .update({ key_alg: canonical })
        .eq("id", rowId);

      if (!upErr) keyAlg = canonical;
    } catch {
      // don't block reads
    }
  }

  return keyAlg;
}

/**
 * Unified per-user Coinbase keys lookup.
 * Supports BOTH schemas:
 *  - user_coinbase_keys (newer)
 *  - coinbase_keys (legacy)
 */
export async function getUserCoinbaseKeys(userId: string) {
  // 1) Prefer newer table (this is likely what Connect Keys writes to)
  const newHit = await fetchLatestKeyRow("user_coinbase_keys", userId);
  if (newHit) {
    const { sb, data } = newHit;
    const healed = await autoHealKeyAlg(
      sb,
      "user_coinbase_keys",
      data.id ?? null,
      String(data.private_key),
      data.key_alg ?? null
    );

    return {
      apiKeyName: String(data.api_key_name),
      privateKey: String(data.private_key),
      keyAlg: healed,
      source: "user_coinbase_keys" as const,
    };
  }

  // 2) Fallback to legacy table
  const legacyHit = await fetchLatestKeyRow("coinbase_keys", userId);
  if (!legacyHit) return null;

  const { sb, data } = legacyHit;
  const healed = await autoHealKeyAlg(
    sb,
    "coinbase_keys",
    data.id ?? null,
    String(data.private_key),
    data.key_alg ?? null
  );

  return {
    apiKeyName: String(data.api_key_name),
    privateKey: String(data.private_key),
    keyAlg: healed,
    source: "coinbase_keys" as const,
  };
}
