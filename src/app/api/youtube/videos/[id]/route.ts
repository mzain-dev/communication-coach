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
