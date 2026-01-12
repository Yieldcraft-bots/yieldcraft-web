import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export async function GET(req: Request) {
  try {
    // ✅ For multi-user: dashboard calls this with Authorization: Bearer <access_token>
    const token = getBearerToken(req);
    if (!token) {
      return json(401, { connected: false, error: "Not authenticated" });
    }

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    const user = auth?.user;

    if (!user || authError) {
      return json(401, { connected: false, error: "Not authenticated" });
    }

    const { data: keys, error: keyError } = await supabase
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", user.id)
      .maybeSingle();

    if (keyError || !keys) {
      return json(200, { connected: false, reason: "no_keys" });
    }

    if (!keys.api_key_name?.trim() || !keys.private_key?.trim()) {
      return json(200, { connected: false, reason: "invalid_keys" });
    }

    return json(200, { connected: true, alg: keys.key_alg ?? "unknown" });
  } catch (err) {
    console.error("coinbase/status error", err);
    return json(500, { connected: false, error: "server_error" });
  }
}
