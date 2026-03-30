"use client";

import Link from "next/link";
import React, { useCallback } from "react";

const COINBASE_API_SETTINGS_URL = "https://www.coinbase.com/settings/api";
const COINBASE_GO_URL = "/go/coinbase";
const ATLAS_STRIPE_LINK =
  process.env.NEXT_PUBLIC_STRIPE_LINK_ATLAS || "/atlas";

export default function AtlasQuickStartPage() {
  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        {/* HERO */}
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-400 uppercase">
            Atlas Quick Start (Order-Enforced)
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Join → Subscribe → Coinbase (Atlas account) → Connect →{" "}
            <span className="text-sky-300">Confirm green lights</span>.
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            Atlas by YieldCraft is the long-term accumulation system.
            <br />
            Use a separate Coinbase account or separate portfolio for Atlas only.
          </p>

          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  5-minute Atlas setup (click in order)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your path is simple:{" "}
                  <span className="text-slate-200">
                    Join → Atlas Plan → Coinbase → Connect → Dashboard
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => scrollToId("steps")}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/60"
              >
                Start here <span className="ml-2">→</span>
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-5">
              <MiniStep title="1) Join" subtitle="Create account / login" active />
              <MiniStep title="2) Atlas Plan" subtitle="Subscribe" />
              <MiniStep title="3) Coinbase" subtitle="Separate Atlas account + API" />
              <MiniStep title="4) Connect" subtitle="Paste Atlas keys securely" />
              <MiniStep title="5) Dashboard" subtitle="Confirm Atlas lights" />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-slate-50">Important:</span>{" "}
                Atlas is a long-term accumulation system. It is normal to see{" "}
                <span className="text-sky-300 font-semibold">no immediate trade</span>.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Your proof is the green lights + connection confirmation — not an
                instant order.
              </p>
            </div>
          </div>
        </div>

        {/* DISCIPLINE / FUNDING */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-sky-400 uppercase">
                The Atlas Discipline System
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-bold">
                Build long-term positions with discipline — not emotion.
              </h2>
              <p className="mt-3 text-sm md:text-base text-slate-300">
                Atlas is designed for slow, deliberate accumulation. It rewards{" "}
                <span className="text-slate-50 font-semibold">consistency</span>,
                not impulsive action. Fund the account, keep it separate from Pulse,
                and let the long-horizon system do its job.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Long-term accumulation</Pill>
              <Pill>Separate from Pulse</Pill>
              <Pill>Never force activity</Pill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoTile
              title="Start small"
              text="Atlas can begin with a modest balance. Smaller balances may accumulate more slowly — by design."
            />
            <InfoTile
              title="Add consistently"
              text="Many users choose a recurring monthly contribution to build discipline over time."
            />
            <InfoTile
              title="Let Atlas wait"
              text="Atlas does not need to act constantly. It is built for patience, not adrenaline."
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-slate-50">How Atlas works:</span>{" "}
              Atlas uses your available exchange balances, exchange minimum order
              rules, and long-horizon discipline logic.{" "}
              <span className="text-slate-50 font-semibold">
                No leverage. No forced sizing. No withdrawals.
              </span>
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-sm font-semibold text-sky-200">
              Best practice (required mindset)
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Use a dedicated Coinbase account or dedicated portfolio for Atlas.
              Keep it separate from Pulse. Do not mix active trading funds with
              long-term Atlas accumulation.
            </p>
          </div>
        </section>

        {/* STATUS LIGHTS */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Atlas status lights</h3>
              <p className="mt-1 text-sm text-slate-400">
                This is what “ready” looks like even if Atlas has not bought yet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Long-horizon</Pill>
              <Pill>Separate account</Pill>
              <Pill>Client-controlled exits</Pill>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StatusItem
              color="green"
              title="Connected"
              description="Atlas exchange auth is valid and responding."
            />
            <StatusItem
              color="green"
              title="Plan Active"
              description="Your Atlas plan is active and onboarding is complete."
            />
            <StatusItem
              color="yellow"
              title="Waiting by Design"
              description="No immediate buy is normal in a long-term system."
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard
              title="What happens next"
              text="Atlas checks your setup and balance, then waits for the long-term system to do its job. Immediate activity is not required."
            />
            <InfoCard
              title="What you should NOT do"
              text="Do not use your Pulse account/API for Atlas. Keep the two systems separate so accounting and risk stay clean."
            />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Atlas is a discipline system, not a promise of returns. Markets are risky
            and results vary.
          </p>
        </section>

        {/* CONNECTION NOTICE */}
        <div className="mb-10 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm font-semibold text-sky-200">Connection check ≠ trade</p>
          <p className="mt-1 text-xs text-slate-300">
            When you connect your Atlas API key, YieldCraft performs a signed
            heartbeat check. This confirms access — it does{" "}
            <span className="font-semibold">not</span> place a trade.
          </p>
        </div>

        {/* STEPS */}
        <div id="steps" className="space-y-6">
          <StepCard
            id="step-join"
            number={1}
            title="Join / Log in to YieldCraft"
            bullets={[
              "Create your YieldCraft login (or sign in)",
              "After login, come right back here to Atlas Quick Start",
              "This unlocks your Atlas plan + secure key storage",
            ]}
            primary={{ label: "Join", internalHref: "/join" }}
            secondary={{ label: "Login", internalHref: "/login" }}
            comfort={{
              title: "Comfort check",
              lines: [
                "If you’re already logged in, this step is complete.",
                "Atlas and Pulse use one YieldCraft login — not two separate logins.",
              ],
            }}
          />

          <StepCard
            id="step-plan"
            number={2}
            title="Subscribe to Atlas"
            bullets={[
              "Choose the Atlas plan before connecting Coinbase",
              "After checkout, return here to continue",
              "Atlas is the long-term accumulation system — separate from Pulse",
            ]}
            primary={{ label: "Subscribe to Atlas", href: ATLAS_STRIPE_LINK }}
            secondary={{ label: "View Atlas Page", internalHref: "/atlas" }}
            comfort={{
              title: "Why subscribe before Coinbase?",
              lines: [
                "It keeps the onboarding order clean.",
                "It ensures Atlas is the product you are connecting — not Pulse.",
              ],
            }}
          />

          <StepCard
            id="step-coinbase"
            number={3}
            title="Create or choose a separate Coinbase account / portfolio for Atlas"
            bullets={[
              "Do not use the same active trading account/API you use for Pulse",
              "Use a dedicated Coinbase account or separate portfolio for Atlas",
              "Atlas API key must be View + Trade only (NO withdrawals)",
            ]}
            primary={{
              label: "I have my Atlas Coinbase ready",
              onClick: () => scrollToId("step-api-key"),
            }}
            secondary={{
              label: "Open Coinbase",
              internalHref: `${COINBASE_GO_URL}?utm_campaign=atlas_quickstart&utm_content=step3_open_coinbase`,
            }}
            tertiary={{
              label: "Then go to API settings →",
              href: COINBASE_API_SETTINGS_URL,
            }}
            comfort={{
              title: "Rules-of-thumb",
              lines: [
                "Pulse account/API and Atlas account/API should stay separate.",
                "Never enable withdrawals on API keys.",
                "Keep Atlas simple: fund it, connect it, and let it accumulate.",
              ],
            }}
          />

          <StepCard
            id="step-api-key"
            number={4}
            title="Create an Atlas Coinbase API key (View + Trade only)"
            bullets={[
              "Open Coinbase API settings from your Atlas account/portfolio",
              "Create an API key with View + Trade only (NO withdrawals)",
              "Copy two values: API key name + private key",
              "Fund the Atlas account/portfolio before expecting Atlas to operate",
            ]}
            primary={{
              label: "Open Coinbase API settings",
              href: COINBASE_API_SETTINGS_URL,
            }}
            comfort={{
              title: "CRITICAL: don’t lose the private key",
              lines: [
                "Coinbase may show the private key one time only.",
                "Keep Coinbase open until you paste both values into YieldCraft and verify.",
                "If you closed it, create a NEW API key and paste the new values.",
              ],
            }}
          />

          <StepCard
            id="step-connect"
            number={5}
            title="Connect your Atlas keys in YieldCraft"
            bullets={[
              "Open Connect Keys",
              "Paste the Atlas API key name + private key",
              "Click Verify & Continue",
              "Confirm your Coinbase connection turns GREEN in YieldCraft",
            ]}
            primary={{ label: "Open Connect Keys", internalHref: "/connect-keys" }}
            comfort={{
              title: "Comfort check",
              lines: [
                "Do not close Coinbase until YOUR COINBASE is GREEN in YieldCraft.",
                "If connection fails, re-copy using Coinbase copy icons.",
                "Use the Atlas API key here — not the Pulse API key.",
              ],
            }}
          />

          <StepCard
            id="step-dashboard"
            number={6}
            title="Go to Dashboard and confirm Atlas green lights"
            bullets={[
              "Open Dashboard",
              "Confirm: Signed in + Atlas plan active + YOUR COINBASE green",
              "No immediate buy is normal — Atlas is a long-term system",
            ]}
            primary={{ label: "Go to Dashboard", internalHref: "/dashboard" }}
            comfort={{
              title: "Important",
              lines: [
                "Connection check ≠ trade.",
                "Atlas does not need to buy instantly to be working correctly.",
                "Green lights mean Atlas is ready.",
              ],
            }}
          />
        </div>

        {/* SIMPLE FOOTER ACTIONS */}
        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-7">
          <h3 className="text-xl font-semibold">Need a shortcut?</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Use these only if you already know where you are in the Atlas steps above.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/atlas"
              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
            >
              Atlas
            </Link>

            <Link
              href="/connect-keys"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Connect Keys
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Dashboard
            </Link>

            <a
              href={ATLAS_STRIPE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Subscribe
            </a>

            <Link
              href={`${COINBASE_GO_URL}?utm_campaign=atlas_quickstart&utm_content=footer_open_coinbase`}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Open Coinbase
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------- Components ---------- */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

function MiniStep({
  title,
  subtitle,
  active,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 transition " +
        (active
          ? "border-sky-500/40 bg-sky-500/5 shadow-[0_0_0_1px_rgba(56,189,248,0.10)]"
          : "border-slate-800 bg-slate-950/40")
      }
    >
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

function StatusItem({
  color,
  title,
  description,
}: {
  color: "green" | "yellow" | "red";
  title: string;
  description: string;
}) {
  const colorMap: Record<"green" | "yellow" | "red", string> = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };

  const ringMap: Record<"green" | "yellow" | "red", string> = {
    green: "shadow-[0_0_0_4px_rgba(52,211,153,0.12)]",
    yellow: "shadow-[0_0_0_4px_rgba(251,191,36,0.12)]",
    red: "shadow-[0_0_0_4px_rgba(239,68,68,0.12)]",
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <span
        className={`mt-1 h-3 w-3 rounded-full ${colorMap[color]} ${ringMap[color]}`}
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function StepCard({
  id,
  number,
  title,
  bullets,
  primary,
  secondary,
  tertiary,
  comfort,
}: {
  id?: string;
  number: number;
  title: string;
  bullets: string[];
  primary: { label: string; href?: string; internalHref?: string; onClick?: () => void };
  secondary?: { label: string; href?: string; internalHref?: string };
  tertiary?: { label: string; href?: string; internalHref?: string };
  comfort: { title: string; lines: string[] };
}) {
  return (
    <div
      id={id}
      className="rounded-3xl border border-slate-800 bg-slate-900/40 p-7 hover:border-sky-500/25 hover:shadow-[0_0_70px_rgba(56,189,248,0.08)] transition"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400 text-sm font-extrabold text-slate-950">
            {number}
          </div>

          <div className="min-w-0">
            <h4 className="text-lg font-semibold">{title}</h4>

            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-300/80" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              {primary.onClick ? (
                <button
                  type="button"
                  onClick={primary.onClick}
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  {primary.label}
                </button>
              ) : primary.internalHref ? (
                <Link
                  href={primary.internalHref}
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  {primary.label}
                </Link>
              ) : (
                <a
                  href={primary.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  {primary.label}
                </a>
              )}

              {secondary ? (
                secondary.internalHref ? (
                  <Link
                    href={secondary.internalHref}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                  >
                    {secondary.label}
                  </Link>
                ) : (
                  <a
                    href={secondary.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                  >
                    {secondary.label}
                  </a>
                )
              ) : null}

              {tertiary ? (
                tertiary.internalHref ? (
                  <Link
                    href={tertiary.internalHref}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                  >
                    {tertiary.label}
                  </Link>
                ) : (
                  <a
                    href={tertiary.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                  >
                    {tertiary.label}
                  </a>
                )
              ) : null}

              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/40 px-4 py-3 text-xs font-semibold text-slate-200">
                Follow the buttons in order. No guessing.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <p className="text-sm font-semibold text-slate-100">{comfort.title}</p>
        <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
          {comfort.lines.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}