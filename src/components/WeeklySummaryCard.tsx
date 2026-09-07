"use client";

import { useState } from "react";
import Link from "next/link";
import type { WeeklySummaryResult } from "@/lib/weekly-summary";

export function WeeklySummaryCard({ hasApiKey }: { hasApiKey: boolean }) {
  const [summary, setSummary] = useState<WeeklySummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/progress/weekly-summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.error === "NO_API_KEY") setError("Add your API key in Settings.");
        else if (data.error === "NOT_ENOUGH_DATA") setError("Not enough activity yet this week — come back after a session or two.");
        else setError("Could not generate a summary right now.");
        return;
      }
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Weekly summary</p>
        {!summary && hasApiKey && (
          <button onClick={generate} disabled={loading} className="text-sm font-medium text-accent disabled:opacity-60">
            {loading ? "Generating…" : "Generate"}
          </button>
        )}
      </div>

      {!hasApiKey && (
        <p className="mt-1 text-sm text-muted">
          Add your API key in <Link href="/settings" className="text-accent underline">Settings</Link> to generate a
          weekly summary.
        </p>
      )}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      {summary && (
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted">Biggest improvement</p>
            <p>{summary.biggestImprovement}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">Ongoing weak point</p>
            <p>{summary.weakPoint}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">Focus for next week</p>
            <p>{summary.focusSuggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}
