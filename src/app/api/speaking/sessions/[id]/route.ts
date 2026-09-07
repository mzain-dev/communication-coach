import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { deleteSessionRelatedData } from "@/lib/tracking";

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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const sessionId = Number(id);

  const rows = await query<{ id: number }[]>("SELECT id FROM speaking_sessions WHERE id = ? AND user_id = ?", [
    sessionId,
    session.sub,
  ]);
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteSessionRelatedData(session.sub, sessionId, "speaking");
  // A YouTube video that led to this call shouldn't disappear — just unlink the deleted session.
  await query("UPDATE youtube_sessions SET linked_speaking_session_id = NULL WHERE linked_speaking_session_id = ? AND user_id = ?", [
    sessionId,
    session.sub,
  ]);
  await query("DELETE FROM speaking_sessions WHERE id = ? AND user_id = ?", [sessionId, session.sub]);

  return NextResponse.json({ ok: true });
}
