import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDecryptedApiKeyForUser, generateSpeakingFeedback, MissingApiKeyError, type SpeakingFocusMode } from "@/lib/gemini";
import { recordGrammarErrors, recordVocabulary, recordLevelEstimate, recordDailyActivity } from "@/lib/tracking";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const sessions = await query<
    { id: number; scenario_name: string; duration_seconds: number; model_used: string | null; date: string; score: number | null }[]
  >(
    `SELECT ss.id, COALESCE(yt.title, sc.name) as scenario_name, ss.duration_seconds, ss.model_used, ss.date, sm.score
     FROM speaking_sessions ss
     JOIN scenarios sc ON sc.id = ss.scenario_id
     LEFT JOIN youtube_sessions yt ON yt.linked_speaking_session_id = ss.id
     LEFT JOIN summaries sm ON sm.session_id = ss.id AND sm.session_type = 'speaking'
     WHERE ss.user_id = ?
     ORDER BY ss.date DESC
     LIMIT 50`,
    [session.sub]
  );

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const scenarioId = Number(body?.scenarioId) || null;
  const youtubeSessionId = Number(body?.youtubeSessionId) || null;
  const transcript = typeof body?.transcript === "string" ? body.transcript : "";
  const durationSeconds = Number(body?.durationSeconds) || 0;
  const modelUsed = typeof body?.modelUsed === "string" ? body.modelUsed : null;

  if ((!scenarioId && !youtubeSessionId) || !transcript.trim()) {
    return NextResponse.json(
      { error: "Either scenarioId or youtubeSessionId, plus a non-empty transcript, are required." },
      { status: 400 }
    );
  }

  // Module 9: a YouTube-context call still goes through speaking_sessions (linked back via
  // youtube_sessions.linked_speaking_session_id) using the generic "YouTube Video Discussion"
  // scenario row as its FK target — the real context comes from the video's transcript, not a
  // fixed scenario prompt.
  let resolvedScenarioId = scenarioId;
  let feedbackSubjectName: string;
  let focusMode: SpeakingFocusMode = "default";
  let youtubeVideo: { title: string } | null = null;

  if (youtubeSessionId) {
    const videos = await query<{ title: string; scenario_id: number }[]>(
      `SELECT yt.title, sc.id as scenario_id FROM youtube_sessions yt, scenarios sc
       WHERE yt.id = ? AND yt.user_id = ? AND sc.type = 'youtube' LIMIT 1`,
      [youtubeSessionId, session.sub]
    );
    const video = videos[0];
    if (!video) return NextResponse.json({ error: "YouTube video not found." }, { status: 404 });
    resolvedScenarioId = video.scenario_id;
    feedbackSubjectName = video.title;
    focusMode = "youtube";
    youtubeVideo = { title: video.title };
  } else {
    const scenarios = await query<{ name: string; is_client_track: number }[]>(
      "SELECT name, is_client_track FROM scenarios WHERE id = ?",
      [scenarioId]
    );
    const scenario = scenarios[0];
    if (!scenario) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
    feedbackSubjectName = scenario.name;
    focusMode = scenario.is_client_track ? "client" : "default";
  }

  const insertResult = await query<{ insertId: number }>(
    "INSERT INTO speaking_sessions (user_id, scenario_id, transcript, duration_seconds, model_used) VALUES (?, ?, ?, ?, ?)",
    [session.sub, resolvedScenarioId, transcript, durationSeconds, modelUsed]
  );
  const sessionId = insertResult.insertId;

  if (youtubeSessionId) {
    await query("UPDATE youtube_sessions SET linked_speaking_session_id = ? WHERE id = ? AND user_id = ?", [
      sessionId,
      youtubeSessionId,
      session.sub,
    ]);
  }

  if (durationSeconds > 0) {
    await recordDailyActivity(session.sub, "speaking", Math.max(1, Math.round(durationSeconds / 60)));
  }

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const feedback = await generateSpeakingFeedback(apiKey, transcript, feedbackSubjectName, focusMode);

    const details = {
      fluency: feedback.fluency,
      grammarAccuracy: feedback.grammarAccuracy,
      vocabularyLevel: feedback.vocabularyLevel,
      confidenceTone: feedback.confidenceTone,
      correctedExamples: feedback.correctedExamples,
      grammarErrors: feedback.grammarErrors,
      newVocabulary: feedback.newVocabulary,
    };
    await query(
      `INSERT INTO summaries (user_id, session_id, session_type, strengths, weaknesses, score, action_item, details)
       VALUES (?, ?, 'speaking', ?, ?, ?, ?, ?)`,
      [
        session.sub,
        sessionId,
        feedback.strengths,
        feedback.weaknesses,
        feedback.overallScore,
        feedback.actionItem,
        JSON.stringify(details),
      ]
    );
    await recordGrammarErrors(session.sub, sessionId, "speaking", feedback.grammarErrors);
    await recordVocabulary(session.sub, feedback.newVocabulary, "speaking");
    await recordLevelEstimate(session.sub, "speaking", feedback.estimatedLevel, sessionId);

    return NextResponse.json({ sessionId, feedback, youtubeVideo });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ sessionId, error: "NO_API_KEY" }, { status: 200 });
    }
    console.error("Failed to generate feedback", err);
    return NextResponse.json({ sessionId, error: "FEEDBACK_FAILED" }, { status: 200 });
  }
}
