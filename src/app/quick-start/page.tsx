// src/app/quick-start/page.tsx
"use client";

import Link from "next/link";
import React, { useCallback } from "react";

const COINBASE_API_SETTINGS_URL = "https://www.coinbase.com/settings/api";

// IMPORTANT:
// We route ALL “Open Coinbase” clicks through our internal redirect
// so you always get affiliate credit and can add UTM tracking safely.
const COINBASE_GO_URL = "/go/coinbase";

export default function QuickStartPage() {
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
            Pulse Quick Start
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Join → Subscribe → Coinbase → Connect →{" "}
            <span className="text-sky-300">Confirm green lights</span>.
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            YieldCraft connects directly to your exchange using signed requests.
            <br />
            No third-party bridges. No “fund transfers.” No confusion.
          </p>

          {/* 5-minute strip */}
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  5-minute setup (click in order)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your path is simple:{" "}
                  <span className="text-slate-200">
                    Join → Plan → Coinbase → Connect → Dashboard
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
              <MiniStep title="2) Plan" subtitle="Subscribe" />
              <MiniStep title="3) Coinbase" subtitle="Dedicated Pulse account" />
              <MiniStep title="4) API Key" subtitle="View + Trade only" />
              <MiniStep title="5) Connect" subtitle="Verify Pulse access" />
              <MiniStep title="6) Dashboard" subtitle="Confirm lights" />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-slate-50">Important:</span>{" "}
                it&apos;s normal to see{" "}
                <span className="text-sky-300 font-semibold">no trade</span> right
                away. Waiting is part of the strategy.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Your proof is the green lights + heartbeat confirmation — not an
                immediate order.
              </p>
            </div>
          </div>
        </div>

        {/* DISCIPLINE / FUNDING */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-sky-400 uppercase">
                The Discipline System
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-bold">
                Build a system for yourself — then let the bots go to work.
              </h2>
              <p className="mt-3 text-sm md:text-base text-slate-300">
                YieldCraft is designed to reward{" "}
                <span className="text-slate-50 font-semibold">consistency</span>,
                not impulse. We help you build a repeatable habit:
                <span className="text-slate-50 font-semibold">
                  {" "}pay yourself first
                </span>
                , contribute consistently, then let disciplined automation do what
                it&apos;s built to do.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Consistency &gt; intensity</Pill>
              <Pill>Risk guardrails</Pill>
              <Pill>Never force trades</Pill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoTile
              title="Start small (yes, even $60)"
              text="YieldCraft supports small accounts. Smaller balances may trade less often — by design and exchange minimums."
            />
            <InfoTile
              title="Add a consistent amount"
              text="Many users choose a monthly contribution (like paying yourself first). It builds discipline and reduces emotional decision-making."
            />
            <InfoTile
              title="Let the engine wait"
              text="YieldCraft does not trade constantly. No trade is often a sign of discipline — not a problem."
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-slate-50">How sizing works:</span>{" "}
              YieldCraft reads your available balances from the exchange and
              constrains order sizes by available funds, exchange minimum order
              rules, and risk controls.{" "}
              <span className="text-slate-50 font-semibold">
                No leverage. No forced sizing.
              </span>
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-sm font-semibold text-sky-200">
              Dedicated Pulse structure
            </p>

            <p className="mt-1 text-xs text-slate-300">
              Use a separate Coinbase account dedicated to Pulse. If you also use
              Atlas, do not use the same Coinbase account, funds, or API credentials
              for both systems.
            </p>
          </div>
        </section>

        {/* STATUS LIGHTS */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Live status lights</h3>
              <p className="mt-1 text-sm text-slate-400">
                This is what “live” looks like even when there&apos;s no signal yet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Direct execution</Pill>
              <Pill>Risk guardrails</Pill>
              <Pill>Maker-first behavior</Pill>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StatusItem
              color="green"
              title="Connected"
              description="Exchange auth is valid and responding."
            />
            <StatusItem
              color="green"
              title="Engine Armed"
              description="Your plan is active and bots are enabled."
            />
            <StatusItem
              color="yellow"
              title="Waiting for Signal"
              description="No trade yet — conditions not met (normal)."
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard
              title="What happens next"
              text="The engine checks conditions on a schedule. When the market meets your bot’s rules and risk limits, it executes automatically."
            />
            <InfoCard
              title="What you should NOT do"
              text="Don’t keep toggling settings trying to force trades. Most losses come from forcing action. YieldCraft is designed to wait."
            />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Performance targets are design goals, not promises. Markets are risky
            and results vary.
          </p>
        </section>

        {/* CONNECTION NOTICE */}
        <div className="mb-10 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm font-semibold text-sky-200">
            Connection check ≠ trade
          </p>
          <p className="mt-1 text-xs text-slate-300">
            When you connect your Pulse API key, YieldCraft performs a signed
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
              "Create your YieldCraft login or sign in",
              "After login, return to Pulse Quick Start",
              "One YieldCraft login can access your enabled YieldCraft products",
            ]}
            primary={{ label: "Create account", internalHref: "/login" }}
            secondary={{ label: "Login", internalHref: "/login" }}
            comfort={{
              title: "Already signed in?",
              lines: [
                "If you’re already logged in, this step is complete.",
                "Pulse and Atlas may use the same YieldCraft login, but their Coinbase accounts and API credentials remain separate.",
              ],
            }}
          />

          <StepCard
            id="step-plan"
            number={2}
            title="Subscribe to a plan that includes Pulse"
            bullets={[
              "Choose a plan that includes Pulse",
              "After checkout, return here or reopen Quick Start",
              "Once your plan is active, continue to the dedicated Pulse Coinbase account",
            ]}
            primary={{ label: "Choose a Plan", internalHref: "/pricing" }}
            comfort={{
              title: "Why plan before Coinbase?",
              lines: [
                "It establishes Pulse as the product you are setting up.",
                "It keeps the onboarding path clear before you create exchange credentials.",
              ],
            }}
          />

          <StepCard
            id="step-coinbase"
            number={3}
            title="Create or choose a separate Coinbase account for Pulse"
            bullets={[
              "Use a separate Coinbase account dedicated to Pulse trading",
              "If you also use Atlas, do not use the same Coinbase account for Pulse and Atlas",
              "Fund the Pulse Coinbase account separately",
            ]}
            primary={{
              label: "I Have My Pulse Coinbase Ready",
              onClick: () => scrollToId("step-api-key"),
            }}
            secondary={{
              // ALWAYS through affiliate redirect
              label: "Open Coinbase",
              internalHref: `${COINBASE_GO_URL}?utm_campaign=quickstart&utm_content=step3_open_coinbase`,
            }}
            comfort={{
              title: "Isolation rule",
              lines: [
                "Pulse and Atlas funds stay separate.",
                "Pulse and Atlas API credentials stay separate.",
                "This protects accounting and strategy boundaries.",
              ],
            }}
          />

          <StepCard
            id="step-api-key"
            number={4}
            title="Create your dedicated Pulse Coinbase API key"
            bullets={[
              "Open the separate Coinbase account you will use only for Pulse",
              "Open Coinbase API settings and create a new API key for Pulse",
              "Turn View ON and Trade ON",
              "Leave Transfer OFF and Receive OFF",
              "Leave the IP whitelist blank unless YieldCraft specifically instructs otherwise",
              "Under Signature algorithm, select ECDSA (Legacy SDKs) — the SECOND option",
              "Do NOT select Ed25519 (Recommended)",
              "Click Create & download, then copy the API key name and private key",
              "Keep Coinbase open until YieldCraft Verify & Continue succeeds",
            ]}
            primary={{
              label: "Open Coinbase API Settings",
              href: COINBASE_API_SETTINGS_URL,
            }}
            comfort={{
              title: "CRITICAL: use the correct API settings",
              lines: [
                "Coinbase may display the private key only once, so keep Coinbase open until YieldCraft verifies the connection.",
                "Never email or share your private key.",
                "Pulse needs View + Trade only. Transfer and Receive must remain OFF.",
                "Select ECDSA (Legacy SDKs), the SECOND signature option — not Ed25519.",
              ],
            }}
          />

          <StepCard
            id="step-connect"
            number={5}
            title="Connect your Pulse keys in YieldCraft"
            bullets={[
              "Open Connect Keys",
              "Paste the dedicated Pulse API key name and private key",
              "Click Verify & Continue",
              "Confirm Pulse shows GREEN on your YieldCraft Dashboard",
            ]}
            primary={{
              label: "Open Connect Keys",
              internalHref: "/connect-keys?product=pulse",
            }}
            comfort={{
              title: "Verify before leaving Coinbase",
              lines: [
                "Do not close Coinbase until Pulse is GREEN in YieldCraft.",
                "Use the Pulse API credentials here — never the Atlas credentials.",
                "If verification fails, re-copy the values using Coinbase’s copy buttons.",
              ],
            }}
          />

          <StepCard
            id="step-dashboard"
            number={6}
            title="Go to Dashboard and confirm Pulse is ready"
            bullets={[
              "Open Dashboard",
              "Confirm you are signed in and your plan is active",
              "Confirm Pulse shows GREEN",
              "No trade is normal — Pulse waits for qualifying conditions",
            ]}
            primary={{ label: "Go to Dashboard", internalHref: "/dashboard" }}
            comfort={{
              title: "Ready does not mean immediate activity",
              lines: [
                "Connection check ≠ trade.",
                "Pulse will not force trades just to appear active.",
                "GREEN means the connection is ready — the engine still waits for its rules and risk controls.",
              ],
            }}
          />
        </div>

        {/* SIMPLE FOOTER ACTIONS */}
        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-7">
          <h3 className="text-xl font-semibold">Already partway through setup?</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Jump directly to the step you need.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
            >
              Pricing
            </Link>

            <Link
              href="/connect-keys?product=pulse"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Connect Pulse Keys
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Dashboard
            </Link>

            <Link
              href="/atlas"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Atlas
            </Link>

            <Link
              href={`${COINBASE_GO_URL}?utm_campaign=quickstart&utm_content=footer_open_coinbase`}
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
      <span className={`mt-1 h-3 w-3 rounded-full ${colorMap[color]} ${ringMap[color]}`} />
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
  comfort,
}: {
  id?: string;
  number: number;
  title: string;
  bullets: string[];
  primary: { label: string; href?: string; internalHref?: string; onClick?: () => void };
  secondary?: { label: string; href?: string; internalHref?: string };
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