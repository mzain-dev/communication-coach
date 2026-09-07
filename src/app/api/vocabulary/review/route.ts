import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

const DAILY_REVIEW_SIZE = 10;

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Struggled (low mastery) words are scheduled with shorter intervals, so ordering by
  // next_review_date then mastery_level naturally surfaces them more often (Module 4 spec).
  const words = await query<
    { id: number; word: string; definition: string; example: string | null; mastery_level: number }[]
  >(
    `SELECT id, word, definition, example, mastery_level
     FROM vocabulary
     WHERE user_id = ? AND (next_review_date IS NULL OR next_review_date <= CURDATE())
     ORDER BY next_review_date ASC, mastery_level ASC
     LIMIT ?`,
    [session.sub, DAILY_REVIEW_SIZE]
  );

  return NextResponse.json({ words });
}
