import { NextResponse } from "next/server";
import { requireAdmin, hashPassword, generateTemporaryPassword } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const users = await query<
    { id: number; name: string; email: string; role: string; is_active: number; created_at: string; last_login_at: string | null }[]
  >("SELECT id, name, email, role, is_active, created_at, last_login_at FROM users WHERE id = ?", [id]);
  const user = users[0];
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessions = await query<
    { id: number; scenario_name: string; duration_seconds: number; model_used: string | null; date: string }[]
  >(
    `SELECT ss.id, sc.name as scenario_name, ss.duration_seconds, ss.model_used, ss.date
     FROM speaking_sessions ss JOIN scenarios sc ON sc.id = ss.scenario_id
     WHERE ss.user_id = ? ORDER BY ss.date DESC LIMIT 50`,
    [id]
  );

  const summaries = await query<
    { id: number; session_id: number; session_type: string; score: number | null; action_item: string | null; date: string }[]
  >(
    `SELECT id, session_id, session_type, score, action_item, date FROM summaries WHERE user_id = ? ORDER BY date DESC LIMIT 50`,
    [id]
  );

  return NextResponse.json({ user, sessions, summaries });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (body?.resetPassword === true) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
    return NextResponse.json({ ok: true, temporaryPassword });
  }

  if (typeof body?.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) is required." }, { status: 400 });
  }

  await query("UPDATE users SET is_active = ? WHERE id = ?", [body.isActive, id]);
  return NextResponse.json({ ok: true });
}
