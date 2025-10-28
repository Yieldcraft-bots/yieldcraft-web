// src/app/subscribe/page.tsx
import { redirect } from "next/navigation";

export default function SubscribeRedirect() {
  const url =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "/pricing";

  redirect(url); // sends users straight to Stripe (or /pricing if not set)
}
