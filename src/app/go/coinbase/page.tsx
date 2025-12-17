// src/app/go/coinbase/page.tsx
import { redirect } from "next/navigation";

export const runtime = "nodejs";

// Coinbase affiliate redirect (server-side, so it's clean + reliable)
const COINBASE_AFFILIATE_URL =
  process.env.NEXT_PUBLIC_COINBASE_AFFILIATE_URL ||
  "https://advanced.coinbase.com/join/2BPE28R";

export default function CoinbaseGoPage() {
  redirect(COINBASE_AFFILIATE_URL);
}
