// src/app/api/connect-keys/route.ts
// Connect Coinbase keys (multi-user)
//
// Accepts either:
//  1) Authorization: Bearer <supabase_access_token>   (preferred)
//  2) body.user_id                                   (legacy fallback)
//
// Body fields accepted (either naming style):
//  - label (optional)
//  - api_key_name OR coinbase_api_key_name
//  - private_key OR coinbase_private_key
//  - key_alg (optional)
//
// Writes to table: coinbase_keys (onConflict user_id)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return json(500, { ok: false, error: "Server misconfigured (missing Supabase env vars)" });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));

    // 1) Prefer Bearer token → resolve user
    let userId: string | null = null;
    const token = getBearerToken(req);

    if (token) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      userId = userData?.user?.id || null;
      if (userErr || !userId) {
        return json(401, { ok: false, error: "Not authenticated" });
      }
    }

    // 2) Legacy fallback: accept user_id from body
    if (!userId) {
      const fallbackUserId = cleanString(body?.user_id);
      if (fallbackUserId) userId = fallbackUserId;
    }

    if (!userId) {
      return json(400, { ok: false, error: "Missing user_id (no bearer token and no body.user_id)" });
    }

    const label = cleanString(body?.label) || "Coinbase";

    const api_key_name =
      cleanString(body?.api_key_name) || cleanString(body?.coinbase_api_key_name);
    const private_key =
      cleanString(body?.private_key) || cleanString(body?.coinbase_private_key);

    const key_alg = cleanString(body?.key_alg) || null;

    if (!api_key_name || !private_key) {
      return json(400, { ok: false, error: "Missing key fields" });
    }

    // light validation (don’t be too strict)
    if (!api_key_name.startsWith("organizations/")) {
      return json(400, { ok: false, error: "API Key Name must start with organizations/" });
    }
    if (!private_key.includes("BEGIN") || !private_key.includes("PRIVATE KEY")) {
      return json(400, { ok: false, error: "Private key does not look like a PEM block" });
    }

    // Upsert into coinbase_keys keyed by user_id
    const { error: upsertErr } = await supabaseAdmin
      .from("coinbase_keys")
      .upsert(
        {
          user_id: userId,
          label,
          api_key_name,
          private_key,
          key_alg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return json(500, { ok: false, error: "DB write failed", details: upsertErr.message });
    }

    return json(200, { ok: true, connected: true, user_id: userId });
  } catch (err: any) {
    return json(500, { ok: false, error: "server_error", details: err?.message || String(err) });
  }
}
