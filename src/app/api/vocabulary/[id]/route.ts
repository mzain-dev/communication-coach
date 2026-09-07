import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  await query("DELETE FROM vocabulary WHERE id = ? AND user_id = ?", [id, session.sub]);
  return NextResponse.json({ ok: true });
}
