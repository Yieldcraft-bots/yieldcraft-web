// src/app/go/coinbase/route.ts
import { NextResponse } from "next/server";

const FALLBACK = "https://www.coinbase.com/signup";

// Read from env at runtime (works in Vercel). This is PUBLIC by design.
function getRefUrl() {
  const v = process.env.NEXT_PUBLIC_COINBASE_REF_URL;
  const ref = typeof v === "string" ? v.trim() : "";
  return ref.length > 0 ? ref : FALLBACK;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Optional pass-through params (safe allowlist)
  // Example: /go/coinbase?utm_source=yieldcraft&utm_campaign=quickstart
  const passthrough = new URL(getRefUrl());

  const allow = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "ref",
    "code",
  ];

  for (const key of allow) {
    const val = url.searchParams.get(key);
    if (val && !passthrough.searchParams.has(key)) {
      passthrough.searchParams.set(key, val);
    }
  }

  // Always tag the click so you can see it in Coinbase / analytics later
  // (Does NOT expose anything sensitive)
  if (!passthrough.searchParams.has("utm_source")) passthrough.searchParams.set("utm_source", "yieldcraft");
  if (!passthrough.searchParams.has("utm_medium")) passthrough.searchParams.set("utm_medium", "affiliate");
  if (!passthrough.searchParams.has("utm_campaign")) passthrough.searchParams.set("utm_campaign", "coinbase");

  return NextResponse.redirect(passthrough.toString(), { status: 302 });
}
