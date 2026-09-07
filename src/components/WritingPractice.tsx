"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { WRITING_CATEGORIES, DIFFICULTIES, type WritingCategory, type Difficulty } from "@/lib/constants";
import type { WritingFeedbackResult } from "@/lib/writing";

type Stage = "pick" | "prompt" | "write" | "feedback";

export function WritingPractice({ hasApiKey }: { hasApiKey: boolean }) {
  const [stage, setStage] = useState<Stage>("pick");
  const [category, setCategory] = useState<WritingCategory | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writeStartRef = useRef<number | null>(null);

  if (!hasApiKey) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-4 pt-16 text-center">
        <h1 className="text-lg font-semibold">Add your API key first</h1>
        <p className="text-sm text-muted">You need a Gemini API key on file to get writing feedback.</p>
        <Link href="/settings" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          Go to Settings
        </Link>
      </div>
    );
  }

  async function pickCategory(c: WritingCategory) {
    setCategory(c);
    setError(null);
    if (c === "free") {
      setPrompt(null);
      setStage("write");
      // eslint-disable-next-line react-hooks/purity -- only ever invoked from a click handler (never during render); the lint rule can't trace through the onClick={() => pickCategory(c.id)} indirection.
      writeStartRef.current = Date.now();
      return;
    }
    setLoadingPrompt(true);
    setStage("prompt");
    try {
      const res = await fetch("/api/writing/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: c, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "NO_API_KEY" ? "Add your API key in Settings." : "Could not generate a prompt.");
        setStage("pick");
        return;
      }
      setPrompt(data.prompt);
      setStage("write");
      writeStartRef.current = Date.now();
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handleSubmit() {
    if (!category || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    const durationSeconds = writeStartRef.current ? Math.round((Date.now() - writeStartRef.current) / 1000) : 0;
    try {
      const res = await fetch("/api/writing/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, originalText: text, durationSeconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "NO_API_KEY" ? "Add your API key in Settings." : "Could not generate feedback.");
        return;
      }
      setFeedback(data.feedback);
      setStage("feedback");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStage("pick");
    setCategory(null);
    setPrompt(null);
    setText("");
    setFeedback(null);
    setError(null);
    writeStartRef.current = null;
  }

  if (stage === "pick") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Writing Practice</h1>
            <p className="text-sm text-muted">Pick a category to get a prompt, or free-write.</p>
          </div>
          <Link href="/writing/history" className="shrink-0 text-sm text-accent">
            History
          </Link>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Difficulty</p>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  difficulty === d.id ? "bg-accent text-accent-foreground" : "bg-card text-muted border border-border"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <ul className="flex flex-col gap-2">
          {WRITING_CATEGORIES.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => pickCategory(c.id)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left active:bg-border"
              >
                <span className="text-sm font-semibold">{c.label}</span>
                <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (stage === "prompt" || (stage === "write" && loadingPrompt)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-4 pt-16 text-center">
        <p className="text-sm text-muted">Generating a prompt…</p>
      </div>
    );
  }

  if (stage === "write") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <button onClick={reset} className="self-start text-sm text-muted">
          ← Choose a different category
        </button>

        {prompt && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted">Prompt</p>
            <p className="mt-1 text-sm">{prompt}</p>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Write here…"
          className="rounded-xl border border-border bg-card p-3 text-base outline-none focus:border-accent"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-60"
        >
          {submitting ? "Getting feedback…" : "Submit"}
        </button>
      </div>
    );
  }

  if (stage === "feedback" && feedback) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <div>
          <h1 className="text-xl font-semibold">Feedback</h1>
          <p className="text-sm text-muted">Clarity score: {feedback.clarityScore}/100</p>
        </div>

        <Section title="Tone">{feedback.tone}</Section>

        {feedback.grammarCorrections.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted">Grammar corrections</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {feedback.grammarCorrections.map((c, i) => (
                <li key={i}>
                  <p>
                    <span className="text-danger line-through">{c.original}</span> →{" "}
                    <span className="text-accent">{c.corrected}</span>
                  </p>
                  <p className="text-xs text-muted">{c.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Section title="Sentence & phrasing suggestions">{feedback.sentenceSuggestions}</Section>
        <Section title="Vocabulary upgrades">{feedback.vocabularySuggestions}</Section>

        {feedback.newVocabulary.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted">New vocabulary (added to your Vocabulary Bank)</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {feedback.newVocabulary.map((v, i) => (
                <li key={i}>
                  <span className="font-medium">{v.word}</span> — {v.definition}
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Professional rewrite (for comparison)</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{feedback.professionalVersion}</p>
        </details>

        <Section title="Strengths">{feedback.strengths}</Section>
        <Section title="Focus for next time">{feedback.actionItem}</Section>

        <button onClick={reset} className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground">
          Write another
        </button>
      </div>
    );
  }

  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
