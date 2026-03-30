// src/app/go/coinbase/page.tsx
import { redirect } from "next/navigation";

const COINBASE_REF_URL =
  process.env.NEXT_PUBLIC_COINBASE_REF_URL?.trim() || "/dashboard";

export default function GoCoinbasePage() {
  redirect(COINBASE_REF_URL);
}