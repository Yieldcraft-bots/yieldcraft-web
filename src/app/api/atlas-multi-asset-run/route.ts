import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function okAuth(req: Request) {
  const secret =
    process.env.ATLAS_RUN_SECRET ??
    process.env.CRON_SECRET ??
    "";

  if (!secret.trim()) {
    return false;
  }

  const header =
    req.headers.get("x-atlas-run-secret") ??
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization");

  if (
    header === secret ||
    header === `Bearer ${secret}`
  ) {
    return true;
  }

  const url = new URL(req.url);

  return url.searchParams.get("secret") === secret;
}

export async function POST(req: Request) {
  if (!okAuth(req)) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  return json(200, {
    ok: true,
    route: "atlas-multi-asset-run",
    status: "ready",
    message: "Multi-asset execution endpoint is online.",
  });
}