import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Aggregated recurring mistakes across Speaking + Writing (Module 5): frequency per error
  // type, with the most recent example for context.
  const patterns = await query<
    { error_type: string; frequency: number; latest_example: string; latest_date: string }[]
  >(
    `SELECT error_type, COUNT(*) as frequency,
            SUBSTRING_INDEX(GROUP_CONCAT(example ORDER BY date DESC SEPARATOR '||'), '||', 1) as latest_example,
            MAX(date) as latest_date
     FROM grammar_errors
     WHERE user_id = ?
     GROUP BY error_type
     ORDER BY frequency DESC, latest_date DESC`,
    [session.sub]
  );

  return NextResponse.json({ patterns });
}

/** Clears every logged instance of one recurring-mistake pattern (?type=...) — the Grammar
 * Tracker only ever shows aggregated patterns, so "delete" here means "clear this pattern"
 * rather than removing one individual instance. */
export async function DELETE(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const errorType = new URL(request.url).searchParams.get("type");
  if (!errorType) return NextResponse.json({ error: "type query param is required." }, { status: 400 });

  await query("DELETE FROM grammar_errors WHERE user_id = ? AND error_type = ?", [session.sub, errorType]);
  return NextResponse.json({ ok: true });
}
