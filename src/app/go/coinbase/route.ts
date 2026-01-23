// src/app/go/coinbase/route.ts
import { NextResponse } from "next/server";

const FALLBACK = "https://www.coinbase.com/signup";

// Read from env at runtime (works in Vercel). This is PUBLIC by design.
function getRefUrl(): string {
  const v = process.env.NEXT_PUBLIC_COINBASE_REF_URL;
  const ref = typeof v === "string" ? v.trim() : "";
  return ref.length > 0 ? ref : FALLBACK;
}

export async function GET(req: Request) {
  const incoming = new URL(req.url);

  // Build destination safely (never crash if env is malformed)
  let dest: URL;
  try {
    dest = new URL(getRefUrl());
  } catch {
    dest = new URL(FALLBACK);
  }

  // Optional pass-through params (safe allowlist)
  // Example: /go/coinbase?utm_source=yieldcraft&utm_campaign=quickstart
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
    const val = incoming.searchParams.get(key);
    if (val && !dest.searchParams.has(key)) {
      dest.searchParams.set(key, val);
    }
  }

  // Always tag clicks (no secrets)
  if (!dest.searchParams.has("utm_source")) dest.searchParams.set("utm_source", "yieldcraft");
  if (!dest.searchParams.has("utm_medium")) dest.searchParams.set("utm_medium", "affiliate");
  if (!dest.searchParams.has("utm_campaign")) dest.searchParams.set("utm_campaign", "coinbase");

  // Prevent caching of redirects (helps analytics + avoids weird browser caching)
  const res = NextResponse.redirect(dest.toString(), 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
