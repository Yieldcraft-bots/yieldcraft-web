"use client";

import Link from "next/link";

export default function AdminShell() {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold">Mission Control</h1>

        <p className="mt-3 text-zinc-400 max-w-3xl">
          YieldCraft operating system. Daily operations, launch status,
          platform health, trading intelligence, and business management.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card title="Atlas Launch" value="IN PROGRESS" />
          <Card title="Pulse" value="LIVE" />
          <Card title="Edge Factory" value="SHADOW" />
          <Card title="Platform" value="ONLINE" />
        </div>

        <h2 className="mt-10 text-xl font-semibold">
          Operations
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdminLink
            href="/admin/control-tower"
            title="Control Tower"
            description="Launch readiness and Atlas operations."
          />

          <AdminLink
            href="/admin/operators/pulse-roster"
            title="Pulse Roster"
            description="User reconciliation and key health."
          />

          <AdminLink
            href="/admin/platform"
            title="Platform"
            description="System metrics and health."
          />

          <AdminLink
            href="/admin/scout-watch"
            title="Scout Watch"
            description="Truth account and performance review."
          />

          <AdminLink
            href="/admin/edge-lab"
            title="Edge Lab"
            description="Edge research and shadow policies."
          />

          <AdminLink
            href="/admin/investor"
            title="Investor"
            description="Investor and business operations."
          />
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-xl font-semibold">
            Current Priorities
          </h2>

          <ul className="mt-4 space-y-2 text-zinc-300">
            <li>1. Atlas launch audit</li>
            <li>2. Atlas activation funnel</li>
            <li>3. Marketing preparation</li>
            <li>4. Edge automation roadmap</li>
            <li>5. Business automation roadmap</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function AdminLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:bg-zinc-900"
    >
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-zinc-400">
        {description}
      </div>
    </Link>
  );
}