import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const entries = await query<
    { id: number; category: string; original_text: string; corrected_text: string | null; date: string }[]
  >("SELECT id, category, original_text, corrected_text, date FROM writing_entries WHERE id = ? AND user_id = ?", [
    id,
    session.sub,
  ]);
  const entry = entries[0];
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const summaries = await query<
    { strengths: string | null; weaknesses: string | null; score: number | null; action_item: string | null }[]
  >("SELECT strengths, weaknesses, score, action_item FROM summaries WHERE session_id = ? AND session_type = 'writing'", [
    id,
  ]);

  return NextResponse.json({ entry, summary: summaries[0] ?? null });
}
