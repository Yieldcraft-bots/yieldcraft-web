import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET() {
  try {
    // ✅ In your Next version, cookies() is async → must await
    const cookieStore = await cookies();
    type CookieStore = Awaited<ReturnType<typeof cookies>>;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // ✅ Use anon key for session cookie auth (service role not needed here)
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return (cookieStore as CookieStore).get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: keys, error: keyError } = await supabase
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", data.user.id)
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
