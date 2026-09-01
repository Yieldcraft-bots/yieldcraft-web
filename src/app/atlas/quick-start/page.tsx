"use client";

import Link from "next/link";
import React, { useCallback } from "react";

const COINBASE_API_SETTINGS_URL =
  "https://www.coinbase.com/settings/api";

const COINBASE_GO_URL =
  "/go/coinbase";

const ATLAS_STRIPE_LINK =
  process.env.NEXT_PUBLIC_STRIPE_LINK_ATLAS ||
  "/atlas";

export default function AtlasQuickStartPage() {
  const scrollToId =
    useCallback(
      (
        id: string
      ) => {
        const el =
          document.getElementById(
            id
          );

        if (!el) {
          return;
        }

        el.scrollIntoView({
          behavior:
            "smooth",

          block:
            "start",
        });
      },
      []
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">

        {/* HERO */}
        <div className="mb-10 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-400">
            Atlas Multi-Asset Quick Start
          </p>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
            Join → Subscribe → Coinbase → Connect →{" "}
            <span className="text-sky-300">
              Choose Allocation
            </span>{" "}
            → Confirm Ready
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-7 text-slate-300">
            Atlas is YieldCraft&apos;s long-term,
            client-configured portfolio system.
            Choose how you want your Atlas portfolio
            allocated, connect a dedicated Atlas
            Coinbase account, and confirm your setup is
            ready.
          </p>

          <div className="mt-6 rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-200">
            Complete these steps in order. Saving an
            allocation or verifying a Coinbase connection
            does not itself place a trade.
          </div>

          {/* QUICK PATH */}
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Atlas setup path
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Follow the setup in order so your
                  subscription, dedicated account,
                  connection, and portfolio targets stay
                  aligned.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  scrollToId(
                    "steps"
                  )
                }
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/60"
              >
                Start here
                <span className="ml-2">
                  →
                </span>
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStep
                title="1) Join"
                subtitle="Create account / login"
                active
              />

              <MiniStep
                title="2) Subscribe"
                subtitle="Activate Atlas"
              />

              <MiniStep
                title="3) Coinbase"
                subtitle="Dedicated Atlas account"
              />

              <MiniStep
                title="4) API Key"
                subtitle="View + Trade only"
              />

              <MiniStep
                title="5) Connect"
                subtitle="Verify Atlas access"
              />

              <MiniStep
                title="6) Allocation"
                subtitle="Choose portfolio targets"
              />

              <MiniStep
                title="7) Ready"
                subtitle="Confirm setup"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-slate-50">
                  Important:
                </span>{" "}
                Atlas is a long-term portfolio system.
                No immediate purchase is required for
                setup to be successful.
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                A completed setup means your Atlas
                membership, dedicated connection, and
                portfolio allocation are configured.
                Execution eligibility remains a separate
                protected process.
              </p>
            </div>
          </div>
        </div>

        {/* WHAT ATLAS IS */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
                The Atlas Discipline System
              </p>

              <h2 className="mt-3 text-2xl font-bold md:text-3xl">
                Build a long-term portfolio with rules,
                not emotion.
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                You choose the target allocation. Atlas
                uses that configuration as the foundation
                for disciplined portfolio accumulation as
                eligible capital becomes available.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>
                Multi-asset
              </Pill>

              <Pill>
                Client-defined allocation
              </Pill>

              <Pill>
                Separate from Pulse
              </Pill>

              <Pill>
                Accumulation-focused
              </Pill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoTile
              title="Choose your targets"
              text="Set the percentage you want assigned to each available Atlas asset. Your allocation must total 100%."
            />

            <InfoTile
              title="Add capital over time"
              text="Atlas is designed for long-horizon portfolio building rather than constant activity."
            />

            <InfoTile
              title="Let small amounts accumulate"
              text="Amounts can remain pending until they meet the applicable minimum for an eligible purchase."
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-slate-50">
                Atlas boundaries:
              </span>{" "}
              No leverage. No withdrawals through Atlas.
              No automatic selling decisions. Saving your
              allocation does not submit an order.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-sm font-semibold text-sky-200">
              Dedicated Atlas structure
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-300">
              Keep Atlas separate from Pulse and other
              active trading systems. Do not share funds
              or API credentials between the systems.
            </p>
          </div>
        </section>

        {/* STATUS */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                What Atlas ready looks like
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Readiness is about configuration and
                connection — not whether Atlas has already
                bought something.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>
                Allocation saved
              </Pill>

              <Pill>
                Coinbase verified
              </Pill>

              <Pill>
                Dedicated account
              </Pill>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StatusItem
              color="green"
              title="Membership Active"
              description="Your Atlas subscription is active."
            />

            <StatusItem
              color="green"
              title="Atlas Connected"
              description="Your dedicated Atlas Coinbase connection is verified."
            />

            <StatusItem
              color="green"
              title="Allocation Saved"
              description="Your portfolio targets total 100% and are saved."
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard
              title="No immediate trade is normal"
              text="Portfolio configuration, funding and execution eligibility are separate stages. Atlas does not need to buy immediately after setup."
            />

            <InfoCard
              title="Keep Atlas isolated"
              text="Do not use your Pulse account, Pulse API credentials, or active trading funds for Atlas."
            />
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Atlas does not guarantee returns. Markets can
            lose value and execution availability can
            vary.
          </p>
        </section>

        {/* CONNECTION NOTICE */}
        <div className="mb-10 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm font-semibold text-sky-200">
            Connection check ≠ trade
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-300">
            Connecting your Atlas API credentials verifies
            account access. Verification does{" "}
            <span className="font-semibold">
              not
            </span>{" "}
            itself submit a Coinbase order.
          </p>
        </div>

        {/* STEPS */}
        <div
          id="steps"
          className="space-y-6"
        >

          <StepCard
            id="step-join"
            number={1}
            title="Join / Log in to YieldCraft"
            bullets={[
              "Create your YieldCraft login or sign in",
              "Return to Atlas Quick Start after login",
              "One YieldCraft login can access your enabled YieldCraft products",
            ]}
            primary={{
              label:
                "Create account / Login",

              internalHref:
                "/login",
            }}
            secondary={{
              label:
                "View Atlas",

              internalHref:
                "/atlas",
            }}
            comfort={{
              title:
                "Already signed in?",

              lines: [
                "Move directly to the Atlas subscription step.",
                "Atlas and Pulse may use the same YieldCraft login, but their trading accounts and API credentials remain separate.",
              ],
            }}
          />

          <StepCard
            id="step-plan"
            number={2}
            title="Subscribe to Atlas"
            bullets={[
              "Activate the Atlas membership",
              "Return to this Quick Start after checkout",
              "Atlas is the dedicated long-term portfolio system",
            ]}
            primary={{
              label:
                "Subscribe to Atlas",

              href:
                ATLAS_STRIPE_LINK,
            }}
            secondary={{
              label:
                "Learn About Atlas",

              internalHref:
                "/atlas",
            }}
            comfort={{
              title:
                "Why subscribe first?",

              lines: [
                "It establishes Atlas as the product you are setting up.",
                "It keeps the onboarding path separate from Pulse and other YieldCraft systems.",
              ],
            }}
          />

          <StepCard
            id="step-coinbase"
            number={3}
            title="Create or choose a dedicated Coinbase account for Atlas"
            bullets={[
              "Do not use the same Coinbase account or API credentials you use for Pulse",
              "Use a separate Coinbase account dedicated to Atlas",
              "Fund the Atlas Coinbase account separately",
            ]}
            primary={{
              label:
                "I Have My Atlas Coinbase Ready",

              onClick:
                () =>
                  scrollToId(
                    "step-api-key"
                  ),
            }}
            secondary={{
              label:
                "Open Coinbase",

              internalHref:
                `${COINBASE_GO_URL}?utm_campaign=atlas_quickstart&utm_content=step3_open_coinbase`,
            }}
            comfort={{
              title:
                "Isolation rule",

              lines: [
                "Atlas and Pulse funds stay separate.",
                "Atlas and Pulse API credentials stay separate.",
                "This protects accounting and strategy boundaries.",
              ],
            }}
          />

          <StepCard
            id="step-api-key"
            number={4}
            title="Enable Coinbase trading access and create your Atlas API key"
            bullets={[
              "Open the dedicated Coinbase account you will use only for Atlas",
              "If you want Atlas to trade stocks, complete Coinbase Stocks & Equities onboarding first and confirm the account is approved for equity trading",
              "If Coinbase shows Stock trading unavailable, continue with supported crypto assets and do not allocate Atlas to equities",
              "Open Coinbase API settings and create a new API key for Atlas",
              "Turn View ON and Trade ON",
              "Leave Transfer OFF and Receive OFF",
              "Leave the IP whitelist blank unless YieldCraft specifically instructs otherwise",
              "Under Signature algorithm, select ECDSA (Legacy SDKs) — the SECOND option",
              "Do NOT select Ed25519 (Recommended)",
              "Click Create & download, then copy the API key name and private key",
              "Keep Coinbase open until YieldCraft Verify & Continue succeeds",
            ]}
            primary={{
              label:
                "Open Coinbase API Settings",

              href:
                COINBASE_API_SETTINGS_URL,
            }}
            comfort={{
              title:
                "Stock access requires Coinbase eligibility",

              lines: [
                "Crypto access does not automatically mean your Coinbase account is enabled for stock trading.",
                "To use Atlas equity assets, your Coinbase account must have Coinbase equity trading access.",
                "Coinbase determines account, asset, geographic, and trading-session eligibility.",
                "If Coinbase shows Stock trading unavailable, use supported crypto assets only and do not allocate to equities.",
                "Coinbase may display the private key only once, so keep Coinbase open until YieldCraft verifies the connection.",
                "Never enable Transfer or Receive permissions for the Atlas API key.",
              ],
            }}
          />

          <StepCard
            id="step-connect"
            number={5}
            title="Connect your Atlas credentials in YieldCraft"
            bullets={[
              "Open Connect Keys",
              "Paste the dedicated Atlas API key name and private key",
              "Verify the connection",
              "Confirm Atlas shows a successful Coinbase connection",
            ]}
            primary={{
              label:
                "Connect Atlas Keys",

              internalHref:
                "/connect-keys?product=atlas",
            }}
            comfort={{
              title:
                "Connection does not execute",

              lines: [
                "Verification confirms account access only.",
                "Use the Atlas API credentials here — never the Pulse credentials.",
                "A verified connection does not mean an immediate order will occur.",
              ],
            }}
          />

          <StepCard
            id="step-allocation"
            number={6}
            title="Choose your Atlas portfolio allocation"
            bullets={[
              "Open the Atlas allocation page",
              "Set your target percentage for each available Atlas asset",
              "Your complete portfolio must total exactly 100%",
              "Save the allocation to continue to portfolio preview",
            ]}
            primary={{
              label:
                "Set My Atlas Allocation",

              internalHref:
                "/atlas/allocation",
            }}
            secondary={{
              label:
                "Review Atlas",

              internalHref:
                "/atlas",
            }}
            comfort={{
              title:
                "Your allocation controls the portfolio targets",

              lines: [
                "Saving your allocation changes portfolio configuration only.",
                "Saving does not itself submit an order.",
                "You can return later to update your target percentages.",
              ],
            }}
          />

          <StepCard
            id="step-dashboard"
            number={7}
            title="Review and confirm Atlas readiness"
            bullets={[
              "Review your Atlas portfolio preview after saving your allocation",
              "Confirm your Atlas membership and Coinbase connection are active",
              "Open the Dashboard to confirm overall Atlas account status",
              "No immediate purchase is required for Atlas to be configured correctly",
            ]}
            primary={{
              label:
                "Review Portfolio Preview",

              internalHref:
                "/atlas/preview",
            }}
            secondary={{
              label:
                "Go to Dashboard",

              internalHref:
                "/dashboard",
            }}
            comfort={{
              title:
                "Ready does not mean immediate activity",

              lines: [
                "Atlas may wait when an amount is below an applicable minimum.",
                "Portfolio configuration and execution eligibility are separate protected stages.",
                "Client selling and withdrawal decisions remain under client control.",
              ],
            }}
          />

        </div>

        {/* FOOTER ACTIONS */}
        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-7">
          <h3 className="text-xl font-semibold">
            Already partway through setup?
          </h3>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Jump directly to the step you need.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/atlas"
              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
            >
              Atlas
            </Link>

            <Link
              href="/atlas/allocation"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Set Allocation
            </Link>

            <Link
              href="/connect-keys?product=atlas"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Connect Keys
            </Link>

            <Link
              href="/atlas/preview"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Portfolio Preview
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
          </div>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
 * PRESENTATION COMPONENTS
 * ============================================================
 */

function Pill({
  children,
}: {
  children:
    React.ReactNode;
}) {
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
  title:
    string;

  subtitle:
    string;

  active?:
    boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 transition " +
        (
          active
            ? "border-sky-500/40 bg-sky-500/5 shadow-[0_0_0_1px_rgba(56,189,248,0.10)]"
            : "border-slate-800 bg-slate-950/40"
        )
      }
    >
      <p className="text-sm font-semibold text-slate-100">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

function InfoTile({
  title,
  text,
}: {
  title:
    string;

  text:
    string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {text}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  text,
}: {
  title:
    string;

  text:
    string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {text}
      </p>
    </div>
  );
}

function StatusItem({
  color,
  title,
  description,
}: {
  color:
    "green" |
    "yellow" |
    "red";

  title:
    string;

  description:
    string;
}) {
  const colorMap:
    Record<
      "green" |
      "yellow" |
      "red",
      string
    > =
      {
        green:
          "bg-emerald-400",

        yellow:
          "bg-amber-400",

        red:
          "bg-red-500",
      };

  const ringMap:
    Record<
      "green" |
      "yellow" |
      "red",
      string
    > =
      {
        green:
          "shadow-[0_0_0_4px_rgba(52,211,153,0.12)]",

        yellow:
          "shadow-[0_0_0_4px_rgba(251,191,36,0.12)]",

        red:
          "shadow-[0_0_0_4px_rgba(239,68,68,0.12)]",
      };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <span
        className={`mt-1 h-3 w-3 rounded-full ${colorMap[color]} ${ringMap[color]}`}
      />

      <div>
        <p className="text-sm font-semibold">
          {title}
        </p>

        <p className="text-xs leading-5 text-slate-400">
          {description}
        </p>
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
  id?:
    string;

  number:
    number;

  title:
    string;

  bullets:
    string[];

  primary: {
    label:
      string;

    href?:
      string;

    internalHref?:
      string;

    onClick?:
      () => void;
  };

  secondary?: {
    label:
      string;

    href?:
      string;

    internalHref?:
      string;
  };

  comfort: {
    title:
      string;

    lines:
      string[];
  };
}) {
  return (
    <div
      id={id}
      className="rounded-3xl border border-slate-800 bg-slate-900/40 p-7 transition hover:border-sky-500/25 hover:shadow-[0_0_70px_rgba(56,189,248,0.08)]"
    >
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400 text-sm font-extrabold text-slate-950">
          {number}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-semibold">
            {title}
          </h4>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {bullets.map(
              (
                bullet
              ) => (
                <li
                  key={
                    bullet
                  }
                  className="flex gap-2"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300/80" />

                  <span>
                    {
                      bullet
                    }
                  </span>
                </li>
              )
            )}
          </ul>

          <div className="mt-5 flex flex-wrap gap-3">
            {primary.onClick ? (
              <button
                type="button"
                onClick={
                  primary.onClick
                }
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
              >
                {
                  primary.label
                }
              </button>
            ) : primary.internalHref ? (
              <Link
                href={
                  primary.internalHref
                }
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
              >
                {
                  primary.label
                }
              </Link>
            ) : (
              <a
                href={
                  primary.href
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
              >
                {
                  primary.label
                }
              </a>
            )}

            {secondary ? (
              secondary.internalHref ? (
                <Link
                  href={
                    secondary.internalHref
                  }
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                >
                  {
                    secondary.label
                  }
                </Link>
              ) : (
                <a
                  href={
                    secondary.href
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                >
                  {
                    secondary.label
                  }
                </a>
              )
            ) : null}

            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/40 px-4 py-3 text-xs font-semibold text-slate-200">
              Follow the setup in order.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <p className="text-sm font-semibold text-slate-100">
          {
            comfort.title
          }
        </p>

        <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
          {comfort.lines.map(
            (
              line
            ) => (
              <li
                key={
                  line
                }
                className="flex gap-2"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />

                <span>
                  {
                    line
                  }
                </span>
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  );
}