// src/app/api/go/coinbase/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

// This route should NEVER send users to coinbase.com.
// It only exists as a safe redirect back into the app.
export async function GET(req: Request) {
  const dest = `${baseUrl(req)}/dashboard`;
  return NextResponse.redirect(dest, { status: 302 });
}

export async function POST(req: Request) {
  const dest = `${baseUrl(req)}/dashboard`;
  return NextResponse.redirect(dest, { status: 302 });
}
