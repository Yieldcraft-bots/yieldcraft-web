// src/app/api/client-allocation/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { ATLAS_ASSET_REGISTRY } from "@/lib/atlas-intelligence/asset-registry";
import {
  validateClientAllocationPlan,
  type ClientAllocationItem,
} from "@/lib/atlas-intelligence/client-allocation";
import {
  getClientAllocationPlan,
  saveClientAllocationPlan,
} from "@/lib/repositories/clientAllocationRepository";

export const runtime = "nodejs";

type AuthResult =
  | {
      authenticated: true;
      userId: string;
      source: "cookie" | "bearer";
    }
  | {
      authenticated: false;
    };

function mustEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  return value;
}

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() ?? "";
}

async function authenticateRequest(req: Request): Promise<AuthResult> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  try {
    const cookieStore = await cookies();

    const cookieClient = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // This route does not modify authentication cookies.
        },
      },
    });

    const { data, error } = await cookieClient.auth.getUser();
    const userId = data.user?.id;

    if (!error && userId) {
      return {
        authenticated: true,
        userId,
        source: "cookie",
      };
    }
  } catch {
    // Continue to bearer-token authentication.
  }

  const token = getBearerToken(req);

  if (!token) {
    return {
      authenticated: false,
    };
  }

  const bearerClient = createClient(url, anonKey, {
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

  const { data, error } = await bearerClient.auth.getUser(token);
  const userId = data.user?.id;

  if (error || !userId) {
    return {
      authenticated: false,
    };
  }

  return {
    authenticated: true,
    userId,
    source: "bearer",
  };
}

function parseAllocations(
  value: unknown
): ClientAllocationItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const allocations: ClientAllocationItem[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const symbol = Reflect.get(item, "symbol");
    const targetPercent = Reflect.get(item, "targetPercent");

    if (
      typeof symbol !== "string" ||
      typeof targetPercent !== "number"
    ) {
      return null;
    }

    allocations.push({
      symbol,
      targetPercent,
    });
  }

  return allocations;
}

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);

    if (!auth.authenticated) {
      return json(401, {
        ok: false,
        error: "not_authenticated",
      });
    }

    const rows = await getClientAllocationPlan(auth.userId);

    const allocations = rows.map((row) => ({
      symbol: row.asset_symbol,
      targetPercent: Number(row.target_percent),
    }));

    return json(200, {
      ok: true,
      user_id: auth.userId,
      allocations,
      source: auth.source,
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return json(500, {
      ok: false,
      error: "server_error",
      details,
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateRequest(req);

    if (!auth.authenticated) {
      return json(401, {
        ok: false,
        error: "not_authenticated",
      });
    }

    const body: unknown = await req.json().catch(() => null);

    if (typeof body !== "object" || body === null) {
      return json(400, {
        ok: false,
        error: "invalid_request_body",
      });
    }

    const allocations = parseAllocations(
      Reflect.get(body, "allocations")
    );

    if (!allocations) {
      return json(400, {
        ok: false,
        error: "invalid_allocations",
        message:
          "allocations must be an array containing a string symbol and numeric targetPercent.",
      });
    }

    const validation = validateClientAllocationPlan(
      { allocations },
      ATLAS_ASSET_REGISTRY
    );

    if (!validation.valid) {
      return json(400, {
        ok: false,
        error: "allocation_validation_failed",
        totalPercent: validation.totalPercent,
        errors: validation.errors,
      });
    }

    await saveClientAllocationPlan(
      auth.userId,
      validation.allocations
    );

    return json(200, {
      ok: true,
      user_id: auth.userId,
      allocations: validation.allocations,
      totalPercent: validation.totalPercent,
      source: auth.source,
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return json(500, {
      ok: false,
      error: "server_error",
      details,
    });
  }
}