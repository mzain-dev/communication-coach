import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDecryptedApiKeyForUser, MissingApiKeyError } from "@/lib/gemini";
import { generateListeningReview, type ListeningLine, type ListeningQuestion, type ListeningVocabWord } from "@/lib/listening";
import { recordVocabulary, recordLevelEstimate, recordDailyActivity } from "@/lib/tracking";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const exercises = await query<{ id: number; topic: string; difficulty: string; date: string; score: number | null }[]>(
    "SELECT id, topic, difficulty, date, score FROM listening_exercises WHERE user_id = ? ORDER BY date DESC LIMIT 50",
    [session.sub]
  );

  return NextResponse.json({ exercises });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const topic = typeof body?.topic === "string" ? body.topic : "";
  const difficulty = typeof body?.difficulty === "string" ? body.difficulty : "intermediate";
  const lines = Array.isArray(body?.lines) ? (body.lines as ListeningLine[]) : [];
  const questions = Array.isArray(body?.questions) ? (body.questions as ListeningQuestion[]) : [];
  const vocabulary = Array.isArray(body?.vocabulary) ? (body.vocabulary as ListeningVocabWord[]) : [];
  const userAnswers = Array.isArray(body?.userAnswers) ? (body.userAnswers as number[]) : [];
  const durationSeconds = Number(body?.durationSeconds) || 0;

  if (!topic || lines.length === 0 || questions.length === 0) {
    return NextResponse.json({ error: "topic, lines, and questions are required." }, { status: 400 });
  }

  if (durationSeconds > 0) {
    await recordDailyActivity(session.sub, "listening", Math.max(1, Math.round(durationSeconds / 60)));
  }

  const transcriptText = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const review = await generateListeningReview(apiKey, transcriptText, questions, userAnswers);

    const insertResult = await query<{ insertId: number }>(
      `INSERT INTO listening_exercises (user_id, topic, difficulty, transcript, questions, answers, score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        session.sub,
        topic,
        difficulty,
        transcriptText,
        JSON.stringify(questions),
        JSON.stringify(userAnswers),
        review.score,
      ]
    );
    const exerciseId = insertResult.insertId;

    await query(
      `INSERT INTO summaries (user_id, session_id, session_type, strengths, weaknesses, score, action_item)
       VALUES (?, ?, 'listening', ?, ?, ?, ?)`,
      [session.sub, exerciseId, review.strengths, review.misunderstood, review.score, review.actionItem]
    );

    // New vocabulary heard in the clip is auto-sent to the Vocabulary Bank (Module 3 spec).
    await recordVocabulary(session.sub, vocabulary, "listening");
    await recordLevelEstimate(session.sub, "listening", review.estimatedLevel, exerciseId);

    return NextResponse.json({ exerciseId, review });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to generate listening review", err);
    return NextResponse.json({ error: "REVIEW_FAILED" }, { status: 502 });
  }
}
