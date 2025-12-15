import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({
    ok: true,
    note: "pulse-trade placeholder (AUTH_OK_BASELINE untouched).",
  });
}
