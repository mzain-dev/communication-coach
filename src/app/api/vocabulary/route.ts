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

  const words = await query<
    {
      id: number;
      word: string;
      definition: string | null;
      example: string | null;
      source_module: string | null;
      mastery_level: number;
      next_review_date: string | null;
    }[]
  >(
    `SELECT id, word, definition, example, source_module, mastery_level, next_review_date
     FROM vocabulary WHERE user_id = ? ORDER BY word ASC`,
    [session.sub]
  );

  return NextResponse.json({ words });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const word = typeof body?.word === "string" ? body.word.trim() : "";
  const definition = typeof body?.definition === "string" ? body.definition.trim() : "";
  const example = typeof body?.example === "string" ? body.example.trim() : "";

  if (!word || !definition) {
    return NextResponse.json({ error: "word and definition are required." }, { status: 400 });
  }

  const insertResult = await query<{ insertId: number }>(
    `INSERT INTO vocabulary (user_id, word, definition, example, source_module, next_review_date)
     VALUES (?, ?, ?, ?, 'manual', CURDATE())`,
    [session.sub, word, definition, example || null]
  );

  return NextResponse.json({ id: insertResult.insertId }, { status: 201 });
}
