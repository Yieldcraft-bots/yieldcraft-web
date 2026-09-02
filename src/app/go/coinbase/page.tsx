// src/app/go/coinbase/page.tsx

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COINBASE_REF_URL =
  process.env.NEXT_PUBLIC_COINBASE_REF_URL?.trim() || "/dashboard";

type SearchParamValue = string | string[] | undefined;

type GoCoinbasePageProps = {
  searchParams: Promise<{
    utm_campaign?: SearchParamValue;
    utm_content?: SearchParamValue;
  }>;
};

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing env: ${name}`);
  }

  return value.trim();
}

function normalizeParam(value: SearchParamValue): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return null;
  }

  const normalized = raw.trim().slice(0, 200);

  return normalized || null;
}

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();

    const authClient = createServerClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // This redirect does not modify authentication cookies.
          },
        },
      }
    );

    const { data, error } = await authClient.auth.getUser();

    if (error || !data.user?.id) {
      return null;
    }

    return data.user.id;
  } catch {
    return null;
  }
}

async function recordCoinbaseReferralClick(
  campaign: string | null,
  content: string | null
): Promise<void> {
  try {
    const userId = await getAuthenticatedUserId();

    const serviceClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { error } = await serviceClient
      .from("coinbase_referral_clicks")
      .insert({
        user_id: userId,
        campaign,
        content,
        source_path: "/go/coinbase",
      });

    if (error) {
      console.error(
        "[coinbase-referral] click telemetry insert failed:",
        error.message
      );
    }
  } catch (error) {
    console.error(
      "[coinbase-referral] click telemetry failed:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export default async function GoCoinbasePage({
  searchParams,
}: GoCoinbasePageProps) {
  const params = await searchParams;

  const campaign = normalizeParam(params.utm_campaign);
  const content = normalizeParam(params.utm_content);

  await recordCoinbaseReferralClick(campaign, content);

  redirect(COINBASE_REF_URL);
}