// src/app/api/user-keys-test/route.ts
// READ-ONLY DIAGNOSTIC: proves we can fetch a user's stored Coinbase keys from Supabase.
// DOES NOT TRADE. DOES NOT RETURN PRIVATE KEY.

import { NextResponse, type NextRequest } from "next/server";
import { getUserCoinbaseKeys } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return json(400, { ok: false, error: "Missing query param: user_id" });
  }

  try {
    const keys = await getUserCoinbaseKeys(userId);

    if (!keys) {
      return json(200, { ok: true, found: false });
    }

    // NEVER return private key. Just confirm presence + metadata.
    return json(200, {
      ok: true,
      found: true,
      apiKeyNameTail: keys.apiKeyName.slice(-6),
      keyAlg: keys.keyAlg,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}
