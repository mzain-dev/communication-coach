"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ReviewWord = { id: number; word: string; definition: string; example: string | null; mastery_level: number };

export function VocabularyReview() {
  const router = useRouter();
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/vocabulary/review")
      .then((res) => res.json())
      .then((data) => setWords(data.words ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function answer(correct: boolean) {
    const current = words[index];
    await fetch(`/api/vocabulary/${current.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correct }),
    });
    if (index + 1 >= words.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
    }
  }

  if (loading) {
    return <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-4 pt-16 text-center text-sm text-muted">Loading…</div>;
  }

  if (words.length === 0 || done) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-4 pt-16 text-center">
        <h1 className="text-lg font-semibold">{done ? "Review complete" : "Nothing due right now"}</h1>
        <p className="text-sm text-muted">
          {done ? "Nice work — come back tomorrow for more." : "Check back later, or add more words to your bank."}
        </p>
        <button
          onClick={() => router.push("/vocabulary")}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Back to Vocabulary Bank
        </button>
      </div>
    );
  }

  const current = words[index];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pt-10 pb-24">
      <p className="text-center text-sm text-muted">
        Card {index + 1} of {words.length}
      </p>

      <button
        onClick={() => setRevealed((r) => !r)}
        className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center"
      >
        <p className="text-2xl font-semibold">{current.word}</p>
        {revealed ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{current.definition}</p>
            {current.example && <p className="text-sm italic text-muted">&quot;{current.example}&quot;</p>}
          </div>
        ) : (
          <p className="text-xs text-muted">Tap to reveal definition</p>
        )}
      </button>

      {revealed && (
        <div className="flex gap-2">
          <button
            onClick={() => answer(false)}
            className="flex-1 rounded-xl border border-border py-3.5 text-base font-semibold"
          >
            Still learning
          </button>
          <button
            onClick={() => answer(true)}
            className="flex-1 rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
