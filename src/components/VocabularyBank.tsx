"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type VocabWord = {
  id: number;
  word: string;
  definition: string | null;
  example: string | null;
  source_module: string | null;
  mastery_level: number;
  next_review_date: string | null;
};

const MASTERY_LABELS = ["New", "Learning", "Learning", "Familiar", "Familiar", "Mastered"];

export function VocabularyBank() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [wordsRes, reviewRes] = await Promise.all([fetch("/api/vocabulary"), fetch("/api/vocabulary/review")]);
    const wordsData = await wordsRes.json();
    const reviewData = await reviewRes.json();
    setWords(wordsData.words ?? []);
    setDueCount((reviewData.words ?? []).length);
    setLoading(false);
  }

  useEffect(() => {
    Promise.all([fetch("/api/vocabulary"), fetch("/api/vocabulary/review")])
      .then(([wordsRes, reviewRes]) => Promise.all([wordsRes.json(), reviewRes.json()]))
      .then(([wordsData, reviewData]) => {
        setWords(wordsData.words ?? []);
        setDueCount((reviewData.words ?? []).length);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, definition, example }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add word.");
        return;
      }
      setWord("");
      setDefinition("");
      setExample("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/vocabulary/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vocabulary Bank</h1>
          <p className="text-sm text-muted">Words from your sessions, reviewed with spaced repetition.</p>
        </div>
      </div>

      {!loading && dueCount !== null && dueCount > 0 && (
        <Link
          href="/vocabulary/review"
          className="flex items-center justify-between rounded-xl bg-accent p-4 text-accent-foreground"
        >
          <span className="text-sm font-semibold">{dueCount} word{dueCount === 1 ? "" : "s"} due for review</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <button
        onClick={() => setShowForm((v) => !v)}
        className="rounded-xl border border-border py-3 text-sm font-semibold"
      >
        {showForm ? "Cancel" : "+ Add a word"}
      </button>

      {showForm && (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <label className="flex flex-col gap-1 text-sm">
            Word
            <input
              required
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Definition
            <input
              required
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Example sentence (optional)
            <input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add word"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : words.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No words yet — they&apos;ll be added automatically from Speaking, Writing, and Listening sessions, or add one
          yourself above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {words.map((w) => (
            <li key={w.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{w.word}</p>
                  {w.definition && <p className="text-sm text-muted">{w.definition}</p>}
                  {w.example && <p className="mt-1 text-xs italic text-muted">&quot;{w.example}&quot;</p>}
                  <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {MASTERY_LABELS[w.mastery_level] ?? "New"}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="shrink-0 text-xs text-muted underline"
                  aria-label={`Remove ${w.word}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
