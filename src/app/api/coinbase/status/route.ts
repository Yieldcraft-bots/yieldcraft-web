// src/app/api/coinbase/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductScope = "pulse" | "atlas";

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

function normalizeScope(v: string | null): ProductScope {
  return v?.toLowerCase() === "atlas" ? "atlas" : "pulse";
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

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (userErr || !userId) {
      return json(401, { connected: false, reason: "not_authenticated" });
    }

    const reqUrl = new URL(req.url);
    const productScope = normalizeScope(reqUrl.searchParams.get("product"));

    const { data: keys, error: keyError } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg, updated_at, product_scope")
      .eq("user_id", userId)
      .eq("product_scope", productScope)
      .maybeSingle();

    if (keyError || !keys) {
      return json(200, {
        connected: false,
        reason: "no_keys",
        product_scope: productScope,
      });
    }

    if (!keys.api_key_name?.trim() || !keys.private_key?.trim()) {
      return json(200, {
        connected: false,
        reason: "invalid_keys",
        product_scope: productScope,
      });
    }

    const probeUrl = new URL(
      `/api/coinbase/balances?product=${productScope}`,
      req.url
    ).toString();

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
        product_scope: productScope,
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
      product_scope: productScope,
      alg: keys.key_alg ?? "unknown",
      updated_at: keys.updated_at ?? null,
    });
  } catch (err) {
    console.error("coinbase/status error", err);
    return json(500, { connected: false, reason: "server_error" });
  }
}