// src/app/api/coinbase/save-keys/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}

function normalizePem(pem: string) {
  // Accept pasted keys that contain literal "\n" and/or wrapping quotes
  let s = cleanString(pem);

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }

  return s.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
}

function sbAdmin() {
  // Prefer server-only SUPABASE_URL, but allow NEXT_PUBLIC_SUPABASE_URL fallback
  const url = cleanString(process.env.SUPABASE_URL) || cleanString(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const admin = sbAdmin();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    // Resolve the user from the Bearer token (no cookies needed)
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;

    if (userErr || !userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const api_key_name = cleanString(body?.api_key_name);
    const private_key = normalizePem(body?.private_key);
    const key_alg = cleanString(body?.key_alg) || null;

    if (!api_key_name || !private_key) {
      return NextResponse.json({ ok: false, error: "Missing key fields" }, { status: 400 });
    }

    // Light validation (don’t be too strict)
    if (!api_key_name.startsWith("organizations/")) {
      return NextResponse.json(
        { ok: false, error: "API Key Name must start with organizations/" },
        { status: 400 }
      );
    }

    // Basic PEM shape check + size guard
    if (!private_key.includes("BEGIN") || private_key.length < 100 || private_key.length > 12000) {
      return NextResponse.json(
        { ok: false, error: "Private key does not look valid" },
        { status: 400 }
      );
    }

    // Upsert keys for THIS user
    // Assumes: coinbase_keys has UNIQUE constraint on user_id
    const { error: upsertErr } = await admin
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
