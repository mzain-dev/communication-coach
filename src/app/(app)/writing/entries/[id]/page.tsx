import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { WRITING_CATEGORIES } from "@/lib/constants";

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
    { strengths: string | null; weaknesses: string | null; score: number | null; action_item: string | null }[]
  >("SELECT strengths, weaknesses, score, action_item FROM summaries WHERE session_id = ? AND session_type = 'writing'", [
    id,
  ]);
  const summary = summaries[0] ?? null;
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

      {summary && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Clarity score: {summary.score ?? "—"}/100</p>
          {summary.strengths && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted">Strengths</p>
              <p className="text-sm">{summary.strengths}</p>
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
