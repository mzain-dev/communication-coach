"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/components/Notifications";

type SessionRow = {
  id: number;
  scenario_name: string;
  duration_seconds: number;
  model_used: string | null;
  date: string;
  score: number | null;
};

export function SpeakingHistory() {
  const { confirm, toast } = useNotifications();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/speaking/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, name: string) {
    const ok = await confirm(`Delete this session ("${name}")? This can't be undone.`);
    if (!ok) return;
    const prev = sessions;
    setSessions((s) => s.filter((session) => session.id !== id));
    try {
      const res = await fetch(`/api/speaking/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setSessions(prev);
      toast("Couldn't delete this session — please try again.");
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <Link href="/speaking" className="text-sm text-muted">
          ← Speaking Practice
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Speaking History</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No sessions yet — start one from Speaking Practice.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
              <Link href={`/speaking/sessions/${s.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.scenario_name}</p>
                <p className="text-xs text-muted">
                  {new Date(s.date).toLocaleDateString()} · {Math.round(s.duration_seconds / 60)} min
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {s.score != null && (
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                    {s.score}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(s.id, s.scenario_name)}
                  className="text-xs text-muted underline"
                  aria-label={`Delete ${s.scenario_name}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
