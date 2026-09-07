"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LISTENING_CONTENT_TYPES, DIFFICULTIES, type ListeningContentType, type Difficulty } from "@/lib/constants";
import { speak, stopSpeaking, recognizeOnce, isSpeechRecognitionSupported } from "@/lib/speech";
import type { GeneratedListeningContent, ListeningReviewResult } from "@/lib/listening";

type Stage = "setup" | "listen" | "questions" | "review" | "shadowing";

export function ListeningPractice({ hasApiKey }: { hasApiKey: boolean }) {
  const [stage, setStage] = useState<Stage>("setup");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [contentType, setContentType] = useState<ListeningContentType>("dialogue");
  const [content, setContent] = useState<GeneratedListeningContent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  const [answers, setAnswers] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<ListeningReviewResult | null>(null);

  const [shadowIndex, setShadowIndex] = useState(0);
  const [recognized, setRecognized] = useState<Record<number, string>>({});
  const [recording, setRecording] = useState(false);
  const sessionStartRef = useRef<number | null>(null);

  if (!hasApiKey) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-4 pt-16 text-center">
        <h1 className="text-lg font-semibold">Add your API key first</h1>
        <p className="text-sm text-muted">You need a Gemini API key on file to generate listening content.</p>
        <Link href="/settings" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          Go to Settings
        </Link>
      </div>
    );
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/listening/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty, contentType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "NO_API_KEY" ? "Add your API key in Settings." : "Could not generate content.");
        return;
      }
      setContent(data.content);
      setAnswers(new Array(data.content.questions.length).fill(-1));
      setStage("listen");
      sessionStartRef.current = Date.now();
    } finally {
      setGenerating(false);
    }
  }

  async function playAll() {
    if (!content) return;
    for (let i = 0; i < content.lines.length; i++) {
      setPlayingIndex(i);
      await speak(`${content.lines[i].speaker}: ${content.lines[i].text}`);
    }
    setPlayingIndex(null);
    setHasPlayedOnce(true);
  }

  function selectAnswer(choiceIndex: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = choiceIndex;
      return next;
    });
  }

  async function handleSubmitAnswers() {
    if (!content) return;
    setSubmitting(true);
    setError(null);
    const durationSeconds = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 1000) : 0;
    try {
      const res = await fetch("/api/listening/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          difficulty,
          lines: content.lines,
          questions: content.questions,
          vocabulary: content.vocabulary,
          userAnswers: answers,
          durationSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "NO_API_KEY" ? "Add your API key in Settings." : "Could not score this exercise.");
        return;
      }
      setReview(data.review);
      setStage("review");
    } finally {
      setSubmitting(false);
    }
  }

  async function recordShadow(index: number) {
    if (!content) return;
    setRecording(true);
    try {
      await speak(content.lines[index].text);
      const text = await recognizeOnce();
      setRecognized((prev) => ({ ...prev, [index]: text }));
    } finally {
      setRecording(false);
    }
  }

  function reset() {
    stopSpeaking();
    setStage("setup");
    setTopic("");
    setContent(null);
    setAnswers([]);
    setQuestionIndex(0);
    setReview(null);
    setError(null);
    setHasPlayedOnce(false);
    setShadowIndex(0);
    setRecognized({});
    sessionStartRef.current = null;
  }

  if (stage === "setup") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Listening Practice</h1>
            <p className="text-sm text-muted">Describe a topic and we&apos;ll generate content to listen to.</p>
          </div>
          <Link href="/listening/history" className="shrink-0 text-sm text-accent">
            History
          </Link>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. renewable energy, a job interview, ordering coffee"
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
          />
        </label>

        <div>
          <p className="mb-1 text-sm font-medium">Format</p>
          <div className="flex gap-2">
            {LISTENING_CONTENT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setContentType(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  contentType === t.id ? "bg-accent text-accent-foreground" : "bg-card text-muted border border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
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

        <button
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
          className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>
    );
  }

  if (stage === "listen" && content) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <button onClick={reset} className="self-start text-sm text-muted">
          ← Start over
        </button>
        <div>
          <h1 className="text-xl font-semibold">{content.title}</h1>
          <p className="text-sm text-muted">Tap play, then listen. You can replay as many times as you like.</p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          {content.lines.map((line, i) => (
            <p key={i} className={`text-sm ${playingIndex === i ? "font-semibold text-accent" : ""}`}>
              <span className="font-medium">{line.speaker}: </span>
              {line.text}
            </p>
          ))}
        </div>

        <button
          onClick={playAll}
          disabled={playingIndex !== null}
          className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-60"
        >
          {playingIndex !== null ? "Playing…" : hasPlayedOnce ? "Play again" : "▶ Play"}
        </button>

        <button
          onClick={() => setStage("questions")}
          disabled={!hasPlayedOnce}
          className="rounded-xl border border-border py-3.5 text-base font-semibold disabled:opacity-40"
        >
          Continue to questions
        </button>
      </div>
    );
  }

  if (stage === "questions" && content) {
    const q = content.questions[questionIndex];
    const isLast = questionIndex === content.questions.length - 1;
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <p className="text-sm text-muted">
          Question {questionIndex + 1} of {content.questions.length}
        </p>
        <h1 className="text-lg font-semibold">{q.question}</h1>

        <ul className="flex flex-col gap-2">
          {q.choices.map((choice, i) => (
            <li key={i}>
              <button
                onClick={() => selectAnswer(i)}
                className={`w-full rounded-xl border p-3.5 text-left text-sm ${
                  answers[questionIndex] === i
                    ? "border-accent bg-accent/10 font-medium text-accent"
                    : "border-border bg-card"
                }`}
              >
                {choice}
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          {questionIndex > 0 && (
            <button
              onClick={() => setQuestionIndex((i) => i - 1)}
              className="flex-1 rounded-xl border border-border py-3.5 text-base font-semibold"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleSubmitAnswers}
              disabled={submitting || answers[questionIndex] === -1}
              className="flex-1 rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-60"
            >
              {submitting ? "Scoring…" : "Submit"}
            </button>
          ) : (
            <button
              onClick={() => setQuestionIndex((i) => i + 1)}
              disabled={answers[questionIndex] === -1}
              className="flex-1 rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  if (stage === "review" && review && content) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <div>
          <h1 className="text-xl font-semibold">Comprehension: {review.score}%</h1>
        </div>
        <Section title="What you understood well">{review.strengths}</Section>
        <Section title="What was misunderstood">{review.misunderstood}</Section>
        <Section title="Focus for next time">{review.actionItem}</Section>

        {content.vocabulary.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted">New vocabulary (added to your Vocabulary Bank)</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {content.vocabulary.map((v, i) => (
                <li key={i}>
                  <span className="font-medium">{v.word}</span> — {v.definition}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isSpeechRecognitionSupported() ? (
          <button
            onClick={() => setStage("shadowing")}
            className="rounded-xl border border-border py-3.5 text-base font-semibold"
          >
            Try shadowing mode
          </button>
        ) : (
          <p className="text-center text-xs text-muted">
            Shadowing mode needs a browser with speech recognition (Chrome or Edge).
          </p>
        )}

        <button onClick={reset} className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground">
          New exercise
        </button>
      </div>
    );
  }

  if (stage === "shadowing" && content) {
    const line = content.lines[shadowIndex];
    const said = recognized[shadowIndex];
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
        <button onClick={() => setStage("review")} className="self-start text-sm text-muted">
          ← Back to review
        </button>
        <div>
          <h1 className="text-lg font-semibold">Shadowing — line {shadowIndex + 1} of {content.lines.length}</h1>
          <p className="text-xs text-muted">
            Listen, then repeat it out loud. We compare the words you said to the target line — this checks wording,
            not pronunciation.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted">Target</p>
          <p className="mt-1 text-sm">
            {line.speaker}: {line.text}
          </p>
        </div>

        {said !== undefined && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted">What we heard you say</p>
            <p className="mt-1 text-sm">{said || "(nothing recognized — try again)"}</p>
          </div>
        )}

        <button
          onClick={() => recordShadow(shadowIndex)}
          disabled={recording}
          className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-60"
        >
          {recording ? "Listen, then speak…" : "▶ Play & record my attempt"}
        </button>

        <div className="flex gap-2">
          {shadowIndex > 0 && (
            <button
              onClick={() => setShadowIndex((i) => i - 1)}
              className="flex-1 rounded-xl border border-border py-3.5 text-base font-semibold"
            >
              Previous line
            </button>
          )}
          {shadowIndex < content.lines.length - 1 && (
            <button
              onClick={() => setShadowIndex((i) => i + 1)}
              className="flex-1 rounded-xl border border-border py-3.5 text-base font-semibold"
            >
              Next line
            </button>
          )}
        </div>
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
