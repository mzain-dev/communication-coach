import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { fetchYouTubeTitle, InvalidYouTubeUrlError } from "@/lib/youtube";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const videos = await query<
    { id: number; url: string; title: string; date_added: string; linked_speaking_session_id: number | null }[]
  >(
    "SELECT id, url, title, date_added, linked_speaking_session_id FROM youtube_sessions WHERE user_id = ? ORDER BY date_added DESC LIMIT 50",
    [session.sub]
  );

  return NextResponse.json({ videos });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";

  if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });
  if (!transcript) {
    return NextResponse.json(
      { error: "NO_TRANSCRIPT", message: "Paste the video's transcript to continue — see the instructions above." },
      { status: 400 }
    );
  }

  let title: string;
  try {
    title = await fetchYouTubeTitle(url);
  } catch (err) {
    if (err instanceof InvalidYouTubeUrlError) {
      return NextResponse.json({ error: "INVALID_URL", message: err.message }, { status: 400 });
    }
    throw err;
  }

  const insertResult = await query<{ insertId: number }>(
    "INSERT INTO youtube_sessions (user_id, url, title, transcript) VALUES (?, ?, ?, ?)",
    [session.sub, url, title, transcript]
  );

  return NextResponse.json({ id: insertResult.insertId, title }, { status: 201 });
}
