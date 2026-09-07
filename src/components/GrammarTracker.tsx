"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MicroLesson } from "@/lib/grammar";

type Pattern = { error_type: string; frequency: number; latest_example: string; latest_date: string };

export function GrammarTracker({ hasApiKey }: { hasApiKey: boolean }) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Record<string, MicroLesson>>({});
  const [lessonLoading, setLessonLoading] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/grammar")
      .then((res) => res.json())
      .then((data) => setPatterns(data.patterns ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function getMicroLesson(errorType: string) {
    setLessonError(null);
    if (lessons[errorType]) {
      setOpenLesson(openLesson === errorType ? null : errorType);
      return;
    }
    setLessonLoading(errorType);
    try {
      const res = await fetch("/api/grammar/micro-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLessonError(data.error === "NO_API_KEY" ? "Add your API key in Settings." : "Could not generate a lesson.");
        return;
      }
      setLessons((prev) => ({ ...prev, [errorType]: data.lesson }));
      setOpenLesson(errorType);
    } finally {
      setLessonLoading(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Grammar Tracker</h1>
        <p className="text-sm text-muted">Recurring mistakes across your Speaking and Writing sessions.</p>
      </div>

      {!hasApiKey && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          Add your API key in <Link href="/settings" className="text-accent underline">Settings</Link> to generate
          targeted micro-lessons for your weak points.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : patterns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No recurring mistakes logged yet — they&apos;re tracked automatically from your Speaking and Writing sessions.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {patterns.map((p) => (
            <li key={p.error_type} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize">{p.error_type}</p>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  {p.frequency}×
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{p.latest_example}</p>

              {hasApiKey && (
                <button
                  onClick={() => getMicroLesson(p.error_type)}
                  disabled={lessonLoading === p.error_type}
                  className="mt-2 text-sm font-medium text-accent disabled:opacity-60"
                >
                  {lessonLoading === p.error_type
                    ? "Generating…"
                    : openLesson === p.error_type
                      ? "Hide micro-lesson"
                      : "Get a micro-lesson"}
                </button>
              )}

              {openLesson === p.error_type && lessons[p.error_type] && (
                <div className="mt-3 rounded-lg bg-background p-3">
                  <p className="text-sm">{lessons[p.error_type].explanation}</p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {lessons[p.error_type].practiceItems.map((item, i) => (
                      <li key={i}>
                        <p>{item.prompt}</p>
                        <p className="text-xs text-accent">Answer: {item.answer}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {lessonError && <p className="text-sm text-danger">{lessonError}</p>}
    </div>
  );
}
