import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ListeningQuestion } from "@/lib/listening";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  // mysql2 parses JSON-typed columns into JS values automatically — `questions`/`answers`
  // come back already as an array, not a string to JSON.parse.
  const exercises = await query<
    { id: number; topic: string; difficulty: string; transcript: string; questions: ListeningQuestion[]; answers: number[]; score: number | null; date: string }[]
  >("SELECT id, topic, difficulty, transcript, questions, answers, score, date FROM listening_exercises WHERE id = ? AND user_id = ?", [
    id,
    session.sub,
  ]);
  const exercise = exercises[0];
  if (!exercise) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const summaries = await query<
    { strengths: string | null; weaknesses: string | null; action_item: string | null }[]
  >(
    "SELECT strengths, weaknesses, action_item FROM summaries WHERE session_id = ? AND session_type = 'listening'",
    [id]
  );

  return NextResponse.json({ exercise, summary: summaries[0] ?? null });
}
