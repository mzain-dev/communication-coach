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
    `SELECT ss.id, ss.transcript, ss.duration_seconds, ss.model_used, ss.date, sc.name as scenario_name
     FROM speaking_sessions ss JOIN scenarios sc ON sc.id = ss.scenario_id
     WHERE ss.id = ? AND ss.user_id = ?`,
    [id, session.sub]
  );
  const sessionRow = sessions[0];
  if (!sessionRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const summaries = await query<
    { strengths: string | null; weaknesses: string | null; score: number | null; action_item: string | null }[]
  >(
    "SELECT strengths, weaknesses, score, action_item FROM summaries WHERE session_id = ? AND session_type = 'speaking'",
    [id]
  );

  return NextResponse.json({ session: sessionRow, summary: summaries[0] ?? null });
}
