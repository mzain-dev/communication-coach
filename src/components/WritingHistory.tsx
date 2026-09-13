"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WRITING_CATEGORIES } from "@/lib/constants";
import { useNotifications } from "@/components/Notifications";

type EntryRow = { id: number; category: string; date: string; score: number | null };

export function WritingHistory() {
  const { confirm, toast } = useNotifications();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/writing/entries")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, label: string) {
    const ok = await confirm(`Delete this entry ("${label}")? This can't be undone.`);
    if (!ok) return;
    const prev = entries;
    setEntries((e) => e.filter((entry) => entry.id !== id));
    try {
      const res = await fetch(`/api/writing/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setEntries(prev);
      toast("Couldn't delete this entry — please try again.");
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <Link href="/writing" className="text-sm text-muted">
          ← Writing Practice
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Writing History</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No entries yet — start one from Writing Practice.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const label = WRITING_CATEGORIES.find((c) => c.id === e.category)?.label ?? e.category;
            return (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <Link href={`/writing/entries/${e.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted">{new Date(e.date).toLocaleDateString()}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {e.score != null && (
                    <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                      {e.score}
                    </span>
                  )}
                  <button onClick={() => handleDelete(e.id, label)} className="text-xs text-muted underline" aria-label={`Delete ${label}`}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
