"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const AFFILIATE_CODE_KEY = "yc_affiliate_code";

function getBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "https://yieldcraft.co";
}

function normalizeCode(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

export default function AffiliateDashboardPage() {
  const [affiliateCode, setAffiliateCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = normalizeCode(params.get("code"));

      if (codeFromUrl) {
        localStorage.setItem(AFFILIATE_CODE_KEY, codeFromUrl);
        setAffiliateCode(codeFromUrl);
        return;
      }

      const saved = normalizeCode(localStorage.getItem(AFFILIATE_CODE_KEY));
      if (saved) setAffiliateCode(saved);
    } catch {
      // no-op
    }
  }, []);

  const referralLink = useMemo(() => {
    if (!affiliateCode) return "";
    return `${getBaseUrl()}/pricing?ref=${affiliateCode}`;
  }, [affiliateCode]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }

  return (
    <main className="min-h-screen bg-[#050B16] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
              Affiliate Dashboard
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Grow with <span className="text-[#ffcf33]">YieldCraft</span>
            </h1>

            <p className="mt-4 max-w-3xl text-white/75">
              Share your referral link, track your setup status, and prepare for
              recurring commissions as tracking goes live.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Stripe payout setup connected
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Your referral link</h2>

            {!affiliateCode ? (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                No affiliate code found yet. Go through the affiliate onboarding
                flow first, or open this page with <code>?code=YOURCODE</code>.
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <div className="text-xs text-white/60">Affiliate code</div>
                  <code className="mt-2 inline-block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90">
                    {affiliateCode}
                  </code>
                </div>

                <div className="mt-5">
                  <div className="text-xs text-white/60">Referral URL</div>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <code className="flex-1 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/90">
                      {referralLink}
                    </code>

                    <button
                      type="button"
                      onClick={() => copy(referralLink)}
                      className="rounded-xl bg-[#ffcf33] px-4 py-3 text-sm font-bold text-black"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={referralLink || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Open referral page
                  </a>

                  <Link
                    href="/pricing"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                  >
                    View pricing page
                  </Link>
                </div>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Status</h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/50">Affiliate status</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Pending / Active workflow ready
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/50">Payout setup</div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">
                  Stripe connected
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/50">Commission model</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  30% recurring
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Performance</h2>
            <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
              Dashboard v1
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Referral Clicks" value="0" sub="tracking next" />
            <MetricCard label="Signups" value="0" sub="tracking next" />
            <MetricCard label="Active Members" value="0" sub="tracking next" />
            <MetricCard label="Commission Earned" value="$0.00" sub="tracking next" />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Affiliate metrics will populate after we wire Stripe sync and commission
            logging. Your referral link is ready now.
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">What to do now</h3>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              <div>1. Share your referral link.</div>
              <div>2. Send people to the pricing page.</div>
              <div>3. Use Starter, Growth, Pro, and Atlas language publicly.</div>
              <div>4. Keep claims compliant — no guarantees or spam.</div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">Navigation</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/affiliate"
                className="rounded-xl bg-[#ffcf33] px-4 py-3 text-sm font-bold text-black"
              >
                Back to Affiliate
              </Link>

              <Link
                href="/affiliate/success"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
              >
                Success Page
              </Link>

              <Link
                href="/pricing"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
              >
                Pricing
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 text-xs text-white/35">
          affiliate-dashboard-build: v1
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/45">{sub}</div> : null}
    </div>
  );
}