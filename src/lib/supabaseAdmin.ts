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
    throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");

  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

type KeyRow = {
  id?: string | null; // exists in user_coinbase_keys, NOT in coinbase_keys
  user_id?: string | null;
  api_key_name?: string | null;
  private_key?: string | null;
  key_alg?: string | null;
  created_at?: string | null;
};

async function fetchLatestKeyRow(table: string, userId: string) {
  const sb = supabaseAdmin();

  // Select a "safe" superset. If a column doesn't exist, Supabase errors.
  // We handle that by retrying without "id" for legacy tables.
  const baseSelect = "api_key_name, private_key, key_alg, created_at, user_id";

  // Try with id first (new table)
  let { data, error } = await sb
    .from(table)
    .select(`id, ${baseSelect}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<KeyRow>();

  // If "id" doesn't exist (legacy), retry without it
  if (error && String(error.message || "").toLowerCase().includes("column") && String(error.message || "").toLowerCase().includes(".id")) {
    const retry = await sb
      .from(table)
      .select(baseSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<KeyRow>();

    data = retry.data as any;
    error = retry.error as any;
  }

  if (error) return null;
  if (!data?.api_key_name || !data?.private_key) return null;

  return { sb, data };
}

async function autoHealKeyAlgById(
  sb: ReturnType<typeof supabaseAdmin>,
  table: string,
  rowId: string | null | undefined,
  privateKey: string,
  currentKeyAlg: string | null | undefined
) {
  let keyAlg = canonicalKeyAlg(currentKeyAlg);

  // infer + persist if missing/unknown
  if (!keyAlg) {
    try {
      const inferred = inferKeyAlgFromPrivateKey(String(privateKey));
      const canonical = inferred === "ed25519" ? "ed25519" : "ES256";

      if (rowId) {
        const { error: upErr } = await sb
          .from(table)
          .update({ key_alg: canonical })
          .eq("id", rowId);

        if (!upErr) keyAlg = canonical;
      } else {
        // if no id, caller must use the other healer (user_id + created_at)
        keyAlg = null;
      }
    } catch {
      // don't block reads
    }
  }

  return keyAlg;
}

async function autoHealKeyAlgByUserAndCreatedAt(
  sb: ReturnType<typeof supabaseAdmin>,
  table: string,
  userId: string,
  createdAt: string | null | undefined,
  privateKey: string,
  currentKeyAlg: string | null | undefined
) {
  let keyAlg = canonicalKeyAlg(currentKeyAlg);

  if (!keyAlg) {
    try {
      const inferred = inferKeyAlgFromPrivateKey(String(privateKey));
      const canonical = inferred === "ed25519" ? "ed25519" : "ES256";

      // Needs created_at to target the newest row safely
      if (createdAt) {
        const { error: upErr } = await sb
          .from(table)
          .update({ key_alg: canonical })
          .eq("user_id", userId)
          .eq("created_at", createdAt);

        if (!upErr) keyAlg = canonical;
      }
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

    // try heal via id first
    let healed = await autoHealKeyAlgById(
      sb,
      "user_coinbase_keys",
      data.id ?? null,
      String(data.private_key),
      data.key_alg ?? null
    );

    // if no id (or heal didn't run), fall back to user_id + created_at
    if (!healed) {
      healed = await autoHealKeyAlgByUserAndCreatedAt(
        sb,
        "user_coinbase_keys",
        userId,
        data.created_at ?? null,
        String(data.private_key),
        data.key_alg ?? null
      );
    }

    return {
      apiKeyName: String(data.api_key_name),
      privateKey: String(data.private_key),
      keyAlg: healed,
      source: "user_coinbase_keys" as const,
    };
  }

  // 2) Fallback to legacy table (no id column)
  const legacyHit = await fetchLatestKeyRow("coinbase_keys", userId);
  if (!legacyHit) return null;

  const { sb, data } = legacyHit;

  const healed = await autoHealKeyAlgByUserAndCreatedAt(
    sb,
    "coinbase_keys",
    userId,
    data.created_at ?? null,
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
