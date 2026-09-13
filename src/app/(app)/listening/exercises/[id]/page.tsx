import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

type StoredQuestion = { question: string; choices: string[]; correctIndex: number };
type StoredListeningDetails = { vocabulary: { word: string; definition: string; example: string }[] };

export default async function ListeningExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  // mysql2 parses JSON-typed columns automatically — `questions`/`answers` come back already
  // as an array, not a string to JSON.parse.
  const exercises = await query<
    { id: number; topic: string; difficulty: string; transcript: string; questions: StoredQuestion[]; answers: number[]; score: number | null; date: string }[]
  >(
    "SELECT id, topic, difficulty, transcript, questions, answers, score, date FROM listening_exercises WHERE id = ? AND user_id = ?",
    [id, session.sub]
  );
  const exercise = exercises[0];
  if (!exercise) notFound();

  const questions = exercise.questions;
  const userAnswers = exercise.answers;

  const summaries = await query<
    {
      strengths: string | null;
      weaknesses: string | null;
      action_item: string | null;
      details: StoredListeningDetails | null;
    }[]
  >(
    "SELECT strengths, weaknesses, action_item, details FROM summaries WHERE session_id = ? AND session_type = 'listening'",
    [id]
  );
  const summary = summaries[0] ?? null;
  const vocabulary = summary?.details?.vocabulary ?? [];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/" className="text-sm text-muted">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{exercise.topic}</h1>
        <p className="text-sm text-muted">
          {new Date(exercise.date).toLocaleString()} · {exercise.difficulty} · {exercise.score ?? "—"}% comprehension
        </p>
      </div>

      {summary && (
        <div className="rounded-xl border border-border bg-card p-4">
          {summary.strengths && (
            <div>
              <p className="text-xs font-semibold text-muted">What you understood well</p>
              <p className="text-sm">{summary.strengths}</p>
            </div>
          )}
          {summary.weaknesses && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted">What was misunderstood</p>
              <p className="text-sm">{summary.weaknesses}</p>
            </div>
          )}
          {summary.action_item && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted">Focus for next time</p>
              <p className="text-sm">{summary.action_item}</p>
            </div>
          )}
        </div>
      )}

      {vocabulary.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted">Vocabulary from this exercise</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {vocabulary.map((v, i) => (
              <li key={i}>
                <span className="font-medium">{v.word}</span> — {v.definition}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted">Your answers</p>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {questions.map((q, i) => (
            <li key={i}>
              <p className="font-medium">{q.question}</p>
              <p className={userAnswers[i] === q.correctIndex ? "text-accent" : "text-danger"}>
                You answered: {q.choices[userAnswers[i]] ?? "(no answer)"}
              </p>
              {userAnswers[i] !== q.correctIndex && (
                <p className="text-muted">Correct: {q.choices[q.correctIndex]}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Full transcript</summary>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-muted">{exercise.transcript}</pre>
      </details>
    </div>
  );
}
