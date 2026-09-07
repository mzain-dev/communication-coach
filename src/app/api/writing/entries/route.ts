import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDecryptedApiKeyForUser, MissingApiKeyError } from "@/lib/gemini";
import { generateWritingFeedback, WRITING_CATEGORIES, type WritingCategory } from "@/lib/writing";
import { recordGrammarErrors, recordVocabulary, recordLevelEstimate, recordDailyActivity } from "@/lib/tracking";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const entries = await query<
    { id: number; category: string; date: string; score: number | null }[]
  >(
    `SELECT we.id, we.category, we.date, sm.score
     FROM writing_entries we
     LEFT JOIN summaries sm ON sm.session_id = we.id AND sm.session_type = 'writing'
     WHERE we.user_id = ?
     ORDER BY we.date DESC
     LIMIT 50`,
    [session.sub]
  );

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category as WritingCategory;
  const originalText = typeof body?.originalText === "string" ? body.originalText : "";
  const durationSeconds = Number(body?.durationSeconds) || 0;

  if (!WRITING_CATEGORIES.some((c) => c.id === category)) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }
  if (!originalText.trim()) {
    return NextResponse.json({ error: "originalText is required." }, { status: 400 });
  }

  if (durationSeconds > 0) {
    await recordDailyActivity(session.sub, "writing", Math.max(1, Math.round(durationSeconds / 60)));
  }

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const feedback = await generateWritingFeedback(apiKey, originalText, category);

    const insertResult = await query<{ insertId: number }>(
      "INSERT INTO writing_entries (user_id, category, original_text, corrected_text) VALUES (?, ?, ?, ?)",
      [session.sub, category, originalText, feedback.correctedText]
    );
    const entryId = insertResult.insertId;

    await query(
      `INSERT INTO summaries (user_id, session_id, session_type, strengths, weaknesses, score, action_item)
       VALUES (?, ?, 'writing', ?, ?, ?, ?)`,
      [session.sub, entryId, feedback.strengths, feedback.weaknesses, feedback.clarityScore, feedback.actionItem]
    );
    await recordGrammarErrors(
      session.sub,
      entryId,
      "writing",
      feedback.grammarCorrections.map((c) => ({ errorType: c.errorType, example: `${c.original} → ${c.corrected}` }))
    );
    await recordVocabulary(session.sub, feedback.newVocabulary, "writing");
    await recordLevelEstimate(session.sub, "writing", feedback.estimatedLevel, entryId);

    return NextResponse.json({ entryId, feedback });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to generate writing feedback", err);
    return NextResponse.json({ error: "FEEDBACK_FAILED" }, { status: 502 });
  }
}
