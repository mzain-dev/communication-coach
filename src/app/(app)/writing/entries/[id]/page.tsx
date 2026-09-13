import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { WRITING_CATEGORIES } from "@/lib/constants";
import { WritingFeedbackCard, type WritingFeedbackCardData } from "@/components/WritingFeedbackCard";

type StoredWritingDetails = {
  tone: string;
  grammarCorrections: { original: string; corrected: string; explanation: string; errorType: string }[];
  sentenceSuggestions: string;
  vocabularySuggestions: string;
  newVocabulary: { word: string; definition: string; example: string }[];
  professionalVersion: string;
};

export default async function WritingEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const entries = await query<
    { id: number; category: string; original_text: string; corrected_text: string | null; date: string }[]
  >("SELECT id, category, original_text, corrected_text, date FROM writing_entries WHERE id = ? AND user_id = ?", [
    id,
    session.sub,
  ]);
  const entry = entries[0];
  if (!entry) notFound();

  const summaries = await query<
    {
      strengths: string | null;
      weaknesses: string | null;
      score: number | null;
      action_item: string | null;
      details: StoredWritingDetails | null;
    }[]
  >(
    "SELECT strengths, weaknesses, score, action_item, details FROM summaries WHERE session_id = ? AND session_type = 'writing'",
    [id]
  );
  const summary = summaries[0] ?? null;
  const details = summary?.details ?? null;
  const feedback: WritingFeedbackCardData | null = summary
    ? {
        clarityScore: summary.score ?? 0,
        strengths: summary.strengths ?? "",
        weaknesses: summary.weaknesses ?? "",
        actionItem: summary.action_item ?? "",
        tone: details?.tone ?? "",
        grammarCorrections: details?.grammarCorrections ?? [],
        sentenceSuggestions: details?.sentenceSuggestions ?? "",
        vocabularySuggestions: details?.vocabularySuggestions ?? "",
        newVocabulary: details?.newVocabulary ?? [],
        professionalVersion: details?.professionalVersion ?? "",
      }
    : null;
  const categoryLabel = WRITING_CATEGORIES.find((c) => c.id === entry.category)?.label ?? entry.category;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/" className="text-sm text-muted">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{categoryLabel}</h1>
        <p className="text-sm text-muted">{new Date(entry.date).toLocaleString()}</p>
      </div>

      {feedback && <WritingFeedbackCard feedback={feedback} />}

      <details className="rounded-xl border border-border bg-card p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">Original</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{entry.original_text}</p>
      </details>

      {entry.corrected_text && (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Corrected</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{entry.corrected_text}</p>
        </details>
      )}
    </div>
  );
}
