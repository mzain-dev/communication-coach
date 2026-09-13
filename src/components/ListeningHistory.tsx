"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/components/Notifications";

type ExerciseRow = { id: number; topic: string; difficulty: string; date: string; score: number | null };

export function ListeningHistory() {
  const { confirm, toast } = useNotifications();
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/listening/exercises")
      .then((res) => res.json())
      .then((data) => setExercises(data.exercises ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, topic: string) {
    const ok = await confirm(`Delete this exercise ("${topic}")? This can't be undone.`);
    if (!ok) return;
    const prev = exercises;
    setExercises((e) => e.filter((exercise) => exercise.id !== id));
    try {
      const res = await fetch(`/api/listening/exercises/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setExercises(prev);
      toast("Couldn't delete this exercise — please try again.");
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <Link href="/listening" className="text-sm text-muted">
          ← Listening Practice
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Listening History</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : exercises.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No exercises yet — start one from Listening Practice.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {exercises.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
              <Link href={`/listening/exercises/${e.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.topic}</p>
                <p className="text-xs capitalize text-muted">
                  {e.difficulty} · {new Date(e.date).toLocaleDateString()}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {e.score != null && (
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                    {e.score}
                  </span>
                )}
                <button onClick={() => handleDelete(e.id, e.topic)} className="text-xs text-muted underline" aria-label={`Delete ${e.topic}`}>
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
