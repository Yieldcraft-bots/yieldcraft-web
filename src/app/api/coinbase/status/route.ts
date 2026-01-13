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

export async function GET(req: Request) {
  try {
    // Authenticate user via Bearer token (multi-user safe; avoids cookies)
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return NextResponse.json(
        { connected: false, error: "server_misconfigured" },
        { status: 500 }
      );
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate token and get user id
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;

    if (userErr || !userId) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // ✅ Look up THIS user's saved Coinbase keys (correct table)
    const { data: keys, error: keyError } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (keyError || !keys) {
      return NextResponse.json(
        { connected: false, reason: "no_keys" },
        { status: 200 }
      );
    }

    if (!keys.api_key_name?.trim() || !keys.private_key?.trim()) {
      return NextResponse.json(
        { connected: false, reason: "invalid_keys" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        connected: true,
        alg: keys.key_alg ?? "unknown",
        updated_at: keys.updated_at ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("coinbase/status error", err);
    return NextResponse.json(
      { connected: false, error: "server_error" },
      { status: 500 }
    );
  }
}
