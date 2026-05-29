"use client";

import { useState } from "react";

export default function RefreshReconciliationButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRefresh() {
    try {
      const token = window.prompt(
        "Enter reconciliation operator token"
      );

      if (!token) {
        setMessage("Refresh cancelled.");
        return;
      }

      setLoading(true);
      setMessage("");

      const res = await fetch(
        `/api/operator/reconcile-users?token=${encodeURIComponent(token)}`,
        {
          method: "GET",
        }
      );

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      setMessage("Reconciliation completed.");

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setMessage(err?.message || "Reconciliation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 flex items-center gap-4">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {loading ? "Running..." : "Refresh Reconciliation"}
      </button>

      {message && (
        <span className="text-sm text-zinc-400">
          {message}
        </span>
      )}
    </div>
  );
}