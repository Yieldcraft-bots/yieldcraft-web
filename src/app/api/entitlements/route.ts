// src/app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Ent = { pulse: boolean; recon: boolean; atlas: boolean; created_at: string | null };

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const DEFAULT_ENT: Ent = { pulse: false, recon: false, atlas: false, created_at: null };

async function fetchLatestEntitlementsRow(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("entitlements")
    .select("pulse, recon, atlas, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: true as const, entitlements: null as Ent | null };

  return {
    ok: true as const,
    entitlements: {
      pulse: !!(data as any).pulse,
      recon: !!(data as any).recon,
      atlas: !!(data as any).atlas,
      created_at: (data as any).created_at ?? null,
    } as Ent,
  };
}

/**
 * Optional fallback: some setups store plan flags and stripe customer on `profiles`.
 * This is defensive: if columns don't exist, we safely ignore.
 */
async function fetchProfileFallback(supabase: SupabaseClient, userId: string) {
  // Try a wide select; if columns don't exist, Supabase will error — we treat as "no profile data"
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, pulse, recon, atlas, plan, plan_tier, stripe_customer_id, customer_id, stripeCustomerId"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: true as const,
      entitlements: null as Ent | null,
      stripeCustomerId: null as string | null,
      planHint: null as string | null,
    };
  }

  const planHintRaw =
    (data as any).plan ??
    (data as any).plan_tier ??
    null;

  const stripeCustomerId =
    (data as any).stripe_customer_id ??
    (data as any).customer_id ??
    (data as any).stripeCustomerId ??
    null;

  // If boolean flags exist, use them
  const hasAnyFlag =
    typeof (data as any).pulse === "boolean" ||
    typeof (data as any).recon === "boolean" ||
    typeof (data as any).atlas === "boolean";

  const entitlements = hasAnyFlag
    ? ({
        pulse: !!(data as any).pulse,
        recon: !!(data as any).recon,
        atlas: !!(data as any).atlas,
        created_at: null,
      } as Ent)
    : null;

  return {
    ok: true as const,
    entitlements,
    stripeCustomerId: stripeCustomerId ? String(stripeCustomerId) : null,
    planHint: planHintRaw ? String(planHintRaw) : null,
  };
}

function inferFromPlanText(planText: string) {
  const t = planText.toLowerCase();

  // baseline: any paid-ish plan means Pulse
  const pulse = t.includes("pulse") || t.includes("pro") || t.includes("suite") || t.includes("all") || t.includes("paid");
  const recon = t.includes("recon") || t.includes("pro") || t.includes("suite") || t.includes("all");
  const atlas = t.includes("atlas") || t.includes("wealth") || t.includes("pro") || t.includes("suite") || t.includes("all");

  return { pulse, recon, atlas };
}

async function inferFromStripe(stripeCustomerId: string, planHint?: string | null) {
  const stripeKey = getEnv("STRIPE_SECRET_KEY");
  if (!stripeKey) return { ok: true as const, entitlements: null as Ent | null, detail: "stripe_key_missing" };

  // If we have a plan hint from DB, that can be enough
  if (planHint && planHint.trim()) {
    const inferred = inferFromPlanText(planHint);
    if (inferred.pulse || inferred.recon || inferred.atlas) {
      return {
        ok: true as const,
        entitlements: { ...inferred, created_at: null },
        detail: "inferred_from_plan_hint",
      };
    }
  }

  // Lazy-load Stripe so build doesn't hard-fail in environments without STRIPE_SECRET_KEY
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey);

  // Pull active/trialing subs
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });

  const activeLike = subs.data.filter((s) => s.status === "active" || s.status === "trialing");

  if (!activeLike.length) {
    return {
      ok: true as const,
      entitlements: null as Ent | null,
      detail: "no_active_subscription",
    };
  }

  // Conservative default: any active subscription => Pulse ON
  let pulse = true;
  let recon = false;
  let atlas = false;

  // Try to infer tier from price nickname / product name
  // (Defensive: Stripe objects vary based on expansion)
  const textBits: string[] = [];
  for (const s of activeLike) {
    for (const item of s.items.data) {
      const price: any = item.price;
      if (price?.nickname) textBits.push(String(price.nickname));
      if (price?.id) textBits.push(String(price.id));
      // product may be an id string unless expanded; still useful
      if (price?.product) textBits.push(String(price.product));
    }
  }
  const joined = textBits.join(" ").toLowerCase();

  if (joined.includes("recon") || joined.includes("pro") || joined.includes("suite") || joined.includes("all")) recon = true;
  if (joined.includes("atlas") || joined.includes("wealth") || joined.includes("pro") || joined.includes("suite") || joined.includes("all")) atlas = true;

  return {
    ok: true as const,
    entitlements: { pulse, recon, atlas, created_at: null },
    detail: "inferred_from_stripe",
  };
}

async function resolveEntitlements(supabase: SupabaseClient, userId: string) {
  // 1) entitlements table (source of truth if present)
  const entRow = await fetchLatestEntitlementsRow(supabase, userId);
  if (!entRow.ok) return { ok: false as const, error: entRow.error };
  if (entRow.entitlements) {
    return {
      ok: true as const,
      entitlements: entRow.entitlements,
      source: "entitlements_table",
      detail: "latest_row",
    };
  }

  // 2) profiles fallback (optional)
  const prof = await fetchProfileFallback(supabase, userId);
  if (!prof.ok) return { ok: false as const, error: "profile_lookup_failed" };

  if (prof.entitlements) {
    return {
      ok: true as const,
      entitlements: prof.entitlements,
      source: "profiles",
      detail: "flags",
    };
  }

  // 3) Stripe fallback (optional)
  if (prof.stripeCustomerId) {
    const stripeInf = await inferFromStripe(prof.stripeCustomerId, prof.planHint);
    if (!stripeInf.ok) return { ok: false as const, error: "stripe_infer_failed" };
    if (stripeInf.entitlements) {
      return {
        ok: true as const,
        entitlements: stripeInf.entitlements,
        source: "stripe",
        detail: stripeInf.detail,
      };
    }
  }

  // Nothing found => locked
  return {
    ok: true as const,
    entitlements: DEFAULT_ENT,
    source: "default",
    detail: "no_rows_found",
  };
}

export async function GET(req: Request) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // 1) Cookie-based auth (SSR cookies)
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (user) {
      const resolved = await resolveEntitlements(supabase, user.id);
      if (!resolved.ok) return json(500, { ok: false, error: resolved.error });

      return json(200, {
        ok: true,
        user_id: user.id,
        entitlements: resolved.entitlements,
        source: `cookie:${resolved.source}`,
        detail: resolved.detail,
      });
    }
  } catch {
    // ignore and fall through
  }

  // 2) Bearer token auth (localStorage-style login)
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];

  if (!token) return json(401, { ok: false, error: "not_authenticated" });

  const authed = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userRes, error: userErr } = await authed.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user) return json(401, { ok: false, error: "not_authenticated" });

  const resolved = await resolveEntitlements(authed, user.id);
  if (!resolved.ok) return json(500, { ok: false, error: resolved.error });

  return json(200, {
    ok: true,
    user_id: user.id,
    entitlements: resolved.entitlements,
    source: `bearer:${resolved.source}`,
    detail: resolved.detail,
  });
}
