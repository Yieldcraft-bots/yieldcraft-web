// src/app/api/coinbase/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);

    // This endpoint is meant to be called by the app (Dashboard) with a Bearer token.
    if (!token) {
      return NextResponse.json(
        { connected: false, error: "Missing bearer token" },
        { status: 401 }
      );
    }

    // 1) Verify user from the JWT using the ANON key
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser(
      token
    );

    const user = authData?.user ?? null;

    if (!user || authError) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 2) Read coinbase_keys using SERVICE ROLE (RLS-safe)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: keys, error: keyError } = await adminClient
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
