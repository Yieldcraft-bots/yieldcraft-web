import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth;
  return "";
}

function supabaseFromRequest(req: Request) {
  // ✅ DO NOT await cookies() (fixes Vercel build error)
  const cookieStore = cookies();

  const bearer = getBearer(req);
  const hasBearer = !!bearer;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // ✅ Use ANON here. RLS + Bearer token scopes the user safely.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: hasBearer ? { headers: { Authorization: bearer } } : undefined,
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

export async function GET(req: Request) {
  try {
    const bearer = getBearer(req);
    if (!bearer) {
      return NextResponse.json(
        { connected: false, error: "Missing bearer token" },
        { status: 401 }
      );
    }

    const supabase = supabaseFromRequest(req);

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
