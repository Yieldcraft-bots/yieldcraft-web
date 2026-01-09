import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function supabaseFromCookies() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await supabaseFromCookies();

    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user || authError) {
      return NextResponse.json(
        { connected: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: keys, error: keyError } = await supabase
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", user.id)
      .single();

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
