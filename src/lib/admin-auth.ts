import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * ============================================================
 * YieldCraft Admin Authentication
 * ------------------------------------------------------------
 * PURPOSE
 * Verify that an incoming server request is authorized to access
 * protected YieldCraft admin API routes.
 *
 * Single Responsibility:
 * Validate either:
 * 1. A trusted server-side admin secret, or
 * 2. A verified Supabase access token belonging to the admin user.
 *
 * SAFETY
 * - Server-only
 * - No database writes
 * - No execution
 * - No trading
 * - No Coinbase
 * - No Pulse
 * - No Atlas execution
 * ============================================================
 */

const DEFAULT_ADMIN_USER_ID =
  "295165f4-df46-403f-8727-80408d6a2578";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getAdminUserId(): string {
  return process.env.ADMIN_USER_ID?.trim() || DEFAULT_ADMIN_USER_ID;
}

function createSupabaseServiceClient() {
  return createClient(
    requireEnvironmentVariable("SUPABASE_URL"),
    requireEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function isValidAdminSecret(request: Request): boolean {
  const expectedSecret = (
    process.env.ADMIN_SECRET ||
    process.env.CRON_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();

  if (!expectedSecret) {
    return false;
  }

  const suppliedHeader =
    request.headers.get("x-admin-secret") ||
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-yc-secret");

  if (
    suppliedHeader === expectedSecret ||
    suppliedHeader === `Bearer ${expectedSecret}`
  ) {
    return true;
  }

  const requestUrl = new URL(request.url);
  const suppliedQuerySecret = requestUrl.searchParams.get("secret");

  return suppliedQuerySecret === expectedSecret;
}

async function isVerifiedSupabaseAdmin(
  request: Request
): Promise<boolean> {
  const authorizationHeader =
    request.headers.get("authorization") || "";

  const accessToken = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  if (!accessToken) {
    return false;
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } =
    await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return false;
  }

  return data.user.id === getAdminUserId();
}

export async function isAuthorizedAdminRequest(
  request: Request
): Promise<boolean> {
  if (isValidAdminSecret(request)) {
    return true;
  }

  return isVerifiedSupabaseAdmin(request);
}