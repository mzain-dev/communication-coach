import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { FeedbackCard, type FeedbackCardData } from "@/components/FeedbackCard";

type StoredSpeakingDetails = {
  fluency: string;
  grammarAccuracy: string;
  vocabularyLevel: string;
  confidenceTone: string;
  correctedExamples: { original: string; corrected: string }[];
  grammarErrors: { errorType: string; example: string }[];
  newVocabulary: { word: string; definition: string; example: string }[];
};

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const sessions = await query<
    {
      id: number;
      transcript: string;
      duration_seconds: number;
      model_used: string | null;
      date: string;
      scenario_name: string;
    }[]
  >(
    `SELECT ss.id, ss.transcript, ss.duration_seconds, ss.model_used, ss.date, COALESCE(yt.title, sc.name) as scenario_name
     FROM speaking_sessions ss
     JOIN scenarios sc ON sc.id = ss.scenario_id
     LEFT JOIN youtube_sessions yt ON yt.linked_speaking_session_id = ss.id
     WHERE ss.id = ? AND ss.user_id = ?`,
    [id, session.sub]
  );
  const sessionRow = sessions[0];
  if (!sessionRow) notFound();

  const summaries = await query<
    {
      strengths: string | null;
      weaknesses: string | null;
      score: number | null;
      action_item: string | null;
      details: StoredSpeakingDetails | null;
    }[]
  >(
    "SELECT strengths, weaknesses, score, action_item, details FROM summaries WHERE session_id = ? AND session_type = 'speaking'",
    [id]
  );
  const summary = summaries[0] ?? null;
  const details = summary?.details ?? null;
  const feedback: FeedbackCardData | null = summary
    ? {
        overallScore: summary.score ?? 0,
        strengths: summary.strengths ?? "",
        weaknesses: summary.weaknesses ?? "",
        actionItem: summary.action_item ?? "",
        fluency: details?.fluency ?? "",
        grammarAccuracy: details?.grammarAccuracy ?? "",
        vocabularyLevel: details?.vocabularyLevel ?? "",
        confidenceTone: details?.confidenceTone ?? "",
        correctedExamples: details?.correctedExamples ?? [],
        grammarErrors: details?.grammarErrors ?? [],
        newVocabulary: details?.newVocabulary ?? [],
      }
    : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/" className="text-sm text-muted">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{sessionRow.scenario_name}</h1>
        <p className="text-sm text-muted">
          {new Date(sessionRow.date).toLocaleString()} · {Math.round(sessionRow.duration_seconds / 60)} min
          {sessionRow.model_used ? ` · ${sessionRow.model_used}` : ""}
        </p>
      </div>

      {feedback ? (
        <FeedbackCard feedback={feedback} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No feedback was generated for this session.
        </p>
      )}

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Full transcript</summary>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-muted">{sessionRow.transcript}</pre>
      </details>
    </div>
  );
}
