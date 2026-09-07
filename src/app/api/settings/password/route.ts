import { NextResponse } from "next/server";
import { requireSession, hashPassword, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";

export async function PUT(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const rows = await query<{ password_hash: string }[]>("SELECT password_hash FROM users WHERE id = ?", [
    session.sub,
  ]);
  const user = rows[0];
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, session.sub]);

  return NextResponse.json({ ok: true });
}
