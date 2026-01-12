// src/app/api/coinbase/save-keys/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ✅ Resolve the user from the Bearer token (no cookies needed)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const userId = userData?.user?.id || null;

    if (userErr || !userId) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const api_key_name = cleanString(body?.api_key_name);
    const private_key = cleanString(body?.private_key);
    const key_alg = cleanString(body?.key_alg) || null;

    if (!api_key_name || !private_key) {
      return NextResponse.json(
        { ok: false, error: "Missing key fields" },
        { status: 400 }
      );
    }

    // light validation (don’t be too strict)
    if (!api_key_name.startsWith("organizations/")) {
      return NextResponse.json(
        { ok: false, error: "API Key Name must start with organizations/" },
        { status: 400 }
      );
    }
    if (!private_key.includes("BEGIN")) {
      return NextResponse.json(
        { ok: false, error: "Private key does not look valid" },
        { status: 400 }
      );
    }

    // ✅ Upsert keys for THIS user
    // Table assumed: coinbase_keys (user_id pk/unique)
    const { error: upsertErr } = await supabaseAdmin
      .from("coinbase_keys")
      .upsert(
        {
          user_id: userId,
          api_key_name,
          private_key,
          key_alg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: "DB write failed", details: upsertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, connected: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
