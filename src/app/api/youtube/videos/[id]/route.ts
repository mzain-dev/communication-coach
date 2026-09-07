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

  const videos = await query<
    { id: number; url: string; title: string; transcript: string; date_added: string; linked_speaking_session_id: number | null }[]
  >("SELECT id, url, title, transcript, date_added, linked_speaking_session_id FROM youtube_sessions WHERE id = ? AND user_id = ?", [
    id,
    session.sub,
  ]);
  const video = videos[0];
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ video });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const videoId = Number(id);

  const rows = await query<{ linked_speaking_session_id: number | null }[]>(
    "SELECT linked_speaking_session_id FROM youtube_sessions WHERE id = ? AND user_id = ?",
    [videoId, session.sub]
  );
  const video = rows[0];
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The discussion call only makes sense in the context of its video, so deleting the video
  // also removes that call and its feedback/grammar/level data — not just unlinking it.
  if (video.linked_speaking_session_id) {
    await deleteSessionRelatedData(session.sub, video.linked_speaking_session_id, "speaking");
    await query("DELETE FROM speaking_sessions WHERE id = ? AND user_id = ?", [
      video.linked_speaking_session_id,
      session.sub,
    ]);
  }
  await query("DELETE FROM youtube_sessions WHERE id = ? AND user_id = ?", [videoId, session.sub]);

  return NextResponse.json({ ok: true });
}
