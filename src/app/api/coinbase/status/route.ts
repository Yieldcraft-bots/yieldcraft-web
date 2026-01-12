import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // ✅ Next.js in your setup: cookies() is async
    const cookieStore = await cookies();

    // ✅ Support BOTH:
    // - Cookie-based auth (normal browser requests)
    // - Bearer token auth (dashboard fetches)
    const authHeader = req.headers.get("authorization") || "";
    const hasBearer = authHeader.toLowerCase().startsWith("bearer ");

    // ✅ Use ANON for auth/session checks (this is the correct pattern)
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: hasBearer ? { headers: { Authorization: authHeader } } : undefined,
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: auth, error: authError } = await supabaseAuth.auth.getUser();
    const user = auth?.user;

    if (authError || !user) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // ✅ Use SERVICE ROLE only for DB read (bypass RLS safely on server)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: keys, error: keyError } = await supabaseAdmin
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", user.id)
      .maybeSingle();

    if (keyError || !keys) {
      return NextResponse.json({ connected: false, reason: "no_keys" }, { status: 200 });
    }

    if (!keys.api_key_name?.trim() || !keys.private_key?.trim()) {
      return NextResponse.json({ connected: false, reason: "invalid_keys" }, { status: 200 });
    }

    return NextResponse.json({ connected: true, alg: keys.key_alg ?? "unknown" }, { status: 200 });
  } catch (err) {
    console.error("coinbase/status error", err);
    return NextResponse.json(
      { connected: false, error: "server_error" },
      { status: 500 }
    );
  }
}
