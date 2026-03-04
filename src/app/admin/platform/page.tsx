"use client";

import { useEffect, useState } from "react";

export default function AdminPlatform() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/institutional-snapshot", {
        headers: {
          "x-cron-secret": process.env.NEXT_PUBLIC_CRON_SECRET || "",
        },
      });

      const json = await res.json();
      setData(json);
    }

    load();
  }, []);

  if (!data) return <div style={{ padding: 40 }}>Loading platform metrics...</div>;

  const inst = data.institutional?.data;

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>YieldCraft Admin Dashboard</h1>

      <h2>Platform Metrics</h2>

      <div>Total Users (30d): {inst?.total_users_30d}</div>
      <div>Active Users (24h): {inst?.active_users_24h}</div>
      <div>Total Trades: {inst?.total_trades_30d}</div>
      <div>Volume: ${inst?.total_volume_usd_30d}</div>
      <div>Maker %: {inst?.maker_entry_pct?.toFixed(2)}%</div>
      <div>Win Rate: {inst?.win_rate_pct}%</div>
      <div>Avg Hold (minutes): {inst?.avg_hold_minutes}</div>
      <div>Drawdown: {inst?.dd_pct_portfolio?.toFixed(2)}%</div>

      <h2 style={{ marginTop: 40 }}>CoreFund</h2>

      <div>Peak Equity: ${data.corefund?.snapshot?.peak_equity_usd}</div>
      <div>Current Equity: ${data.corefund?.snapshot?.last_equity_usd}</div>

      <h3 style={{ marginTop: 20 }}>Recent Trades</h3>

      <pre style={{ background: "#111", color: "#0f0", padding: 20 }}>
        {JSON.stringify(data.corefund?.trades, null, 2)}
      </pre>
    </div>
  );
}