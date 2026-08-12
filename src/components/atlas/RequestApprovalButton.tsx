"use client";

import { useState } from "react";

export default function RequestApprovalButton() {
  const [status, setStatus] = useState("");

  async function requestApproval() {
    setStatus("Submitting approval request...");

    const response = await fetch(
      "/api/atlas-request-approval",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setStatus(
        result.error ?? "Approval request failed."
      );
      return;
    }

    setStatus(
      "Atlas approval request created."
    );
  }

  return (
    <div className="mt-6">
      <button
        onClick={requestApproval}
        className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
      >
        Request Atlas Approval
      </button>

      {status && (
        <p className="mt-3 text-sm text-slate-400">
          {status}
        </p>
      )}
    </div>
  );
}