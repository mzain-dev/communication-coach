import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { nextReviewSchedule } from "@/lib/tracking";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (typeof body?.correct !== "boolean") {
    return NextResponse.json({ error: "correct (boolean) is required." }, { status: 400 });
  }

  const rows = await query<{ mastery_level: number }[]>(
    "SELECT mastery_level FROM vocabulary WHERE id = ? AND user_id = ?",
    [id, session.sub]
  );
  const word = rows[0];
  if (!word) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { masteryLevel, intervalDays } = nextReviewSchedule(word.mastery_level, body.correct);

  await query(
    "UPDATE vocabulary SET mastery_level = ?, next_review_date = DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE id = ? AND user_id = ?",
    [masteryLevel, intervalDays, id, session.sub]
  );

  return NextResponse.json({ masteryLevel, nextReviewInDays: intervalDays });
}
