// src/app/api/coinbase/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) return json(401, { connected: false, reason: "not_authenticated" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return json(500, { connected: false, reason: "server_misconfigured" });
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate token and get user id
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (userErr || !userId) return json(401, { connected: false, reason: "not_authenticated" });

    // 1) Do we have saved keys?
    const { data: keys, error: keyError } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (keyError || !keys) {
      return json(200, { connected: false, reason: "no_keys" });
    }

    if (!keys.api_key_name?.trim() || !keys.private_key?.trim()) {
      return json(200, { connected: false, reason: "invalid_keys" });
    }

    // 2) REAL verification: call balances endpoint (hits Coinbase using user keys)
    // This avoids duplicating JWT/signing logic here.
    const probeUrl = new URL("/api/coinbase/balances", req.url).toString();
    const probeRes = await fetch(probeUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    let probeJson: any = null;
    try {
      probeJson = await probeRes.json();
    } catch {
      probeJson = null;
    }

    const probeOk = !!(probeRes.ok && probeJson && probeJson.ok === true);

    if (!probeOk) {
      return json(200, {
        connected: false,
        reason: "coinbase_auth_failed",
        status: probeJson?.status ?? probeRes.status,
        hint:
          probeJson?.error ||
          "Check Coinbase API key permissions (View + Trade), portfolio, and that the key is Active.",
        alg: keys.key_alg ?? "unknown",
        updated_at: keys.updated_at ?? null,
      });
    }

    return json(200, {
      connected: true,
      reason: "ok",
      alg: keys.key_alg ?? "unknown",
      updated_at: keys.updated_at ?? null,
    });
  } catch (err) {
    console.error("coinbase/status error", err);
    return json(500, { connected: false, reason: "server_error" });
  }
}
