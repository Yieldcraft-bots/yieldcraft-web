"use client";

import Link from "next/link";

export default function AdminShell() {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Mission Control</h1>

      <div className="grid gap-4 max-w-md">
        <Link
          href="/admin/scout-watch"
          className="p-4 rounded-xl bg-white/5 hover:bg-white/10"
        >
          Scout Watch
        </Link>

        <Link
          href="/admin/platform"
          className="p-4 rounded-xl bg-white/5 hover:bg-white/10"
        >
          Platform
        </Link>

        <Link
          href="/admin/investor"
          className="p-4 rounded-xl bg-white/5 hover:bg-white/10"
        >
          Investor
        </Link>

        <Link
          href="/admin/edge-lab"
          className="p-4 rounded-xl bg-white/5 hover:bg-white/10"
        >
          Edge Lab
        </Link>
      </div>
    </main>
  );
}