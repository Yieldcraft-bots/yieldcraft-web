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
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }

  // convert literal \n into real newlines, normalize CRLF
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function inferKeyAlgFromPrivateKey(privateKeyRaw: string): "ES256" | "ed25519" {
  const pem = normalizePem(privateKeyRaw);

  // If the pem is invalid, createPrivateKey will throw (we catch upstream)
  const keyObj = crypto.createPrivateKey(pem);

  // Node returns: "ec" | "ed25519" | "rsa" | ...
  const t = (keyObj as any).asymmetricKeyType as string | undefined;

  if (t === "ed25519") return "ed25519";
  if (t === "ec") return "ES256";

  // Safe default (your system already defaults ES256 if unknown)
  return "ES256";
}

// IMPORTANT: Service role key must ONLY be used server-side (api routes / server actions)
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!url) throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");

  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function getUserCoinbaseKeys(userId: string) {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("coinbase_keys")
    .select("id, api_key_name, private_key, key_alg, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`coinbase_keys lookup failed: ${error.message}`);
  if (!data?.api_key_name || !data?.private_key) return null;

  let keyAlg: string | null = (data.key_alg as string | null) || null;

  // ✅ AUTO-HEAL: if missing/unknown, infer it from the private key and persist it
  if (!keyAlg || keyAlg === "unknown" || keyAlg === "null") {
    try {
      const inferred = inferKeyAlgFromPrivateKey(String(data.private_key));
      const canonical = inferred === "ed25519" ? "ed25519" : "ES256";

      // write it back so future reads are consistent everywhere
      const { error: upErr } = await sb
        .from("coinbase_keys")
        .update({ key_alg: canonical })
        .eq("id", data.id);

      if (!upErr) keyAlg = canonical;
    } catch {
      // do not block reads if inference fails; leave keyAlg as-is
    }
  }

  return {
    apiKeyName: data.api_key_name as string,
    privateKey: data.private_key as string,
    keyAlg,
  };
}
