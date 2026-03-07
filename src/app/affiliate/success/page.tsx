// src/app/affiliate/success/page.tsx

import Link from "next/link";

export const runtime = "nodejs";

export default function AffiliateSuccessPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const codeRaw = searchParams?.code;
  const code =
    typeof codeRaw === "string"
      ? codeRaw
      : Array.isArray(codeRaw)
      ? codeRaw[0]
      : "";

  const dashboardHref = code
    ? `/affiliate/dashboard?code=${encodeURIComponent(code)}`
    : "/affiliate/dashboard";

  return (
    <main className="min-h-screen bg-[#050B16] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Affiliate setup <span className="text-[#ffcf33]">completed</span> ✅
        </h1>

        <p className="mt-4 text-white/80">
          Stripe payout setup was submitted successfully. You’re good to go.
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6">
          <div className="font-semibold text-emerald-100">
            Status: Connected to Stripe
          </div>

          {code ? (
            <div className="mt-4">
              <div className="text-xs text-white/70">Affiliate code</div>
              <code className="mt-1 inline-block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90">
                {code}
              </code>
            </div>
          ) : (
            <div className="mt-4 text-sm text-white/70">
              (No affiliate code found in the URL — that’s okay.)
            </div>
          )}

          <div className="mt-4 text-sm text-white/75">
            Next: open your affiliate dashboard to copy your referral link and
            start sharing it.
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/affiliate"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-bold text-white"
          >
            Back to Affiliate Page
          </Link>

          <Link
            href={dashboardHref}
            className="w-full rounded-xl bg-[#ffcf33] px-4 py-3 text-center font-bold text-black"
          >
            Go to Affiliate Dashboard
          </Link>
        </div>

        <div className="mt-6 text-xs text-white/45">
          affiliate-success-page-build: v2-dashboard-flow
        </div>
      </div>
    </main>
  );
}