// src/app/api/coinbase/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // 1) Verify user from the Bearer token (RLS-safe identity)
    const supaAuth = createClient(url, anon, {
      auth: { persistSession: false },
    });

    const { data: userRes, error: userErr } = await supaAuth.auth.getUser(token);
    const user = userRes?.user;

    if (userErr || !user) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 2) Read keys using service role (bypasses RLS), but scoped to THIS user.id
    const supaDb = createClient(url, service, {
      auth: { persistSession: false },
    });

    const { data: keys, error: keyError } = await supaDb
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", user.id)
      .maybeSingle();

    if (keyError || !keys) {
      return NextResponse.json({ connected: false, reason: "no_keys" });
    }

    if (!keys.api_key_name?.trim() || !keys.private_key?.trim()) {
      return NextResponse.json({ connected: false, reason: "invalid_keys" });
    }

    return NextResponse.json({
      connected: true,
      alg: keys.key_alg ?? "unknown",
    });
  } catch (err) {
    console.error("coinbase/status error", err);
    return NextResponse.json(
      { connected: false, error: "server_error" },
      { status: 500 }
    );
  }
}
