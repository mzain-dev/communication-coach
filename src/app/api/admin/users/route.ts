import { NextResponse } from "next/server";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await query<
    { id: number; name: string; email: string; role: string; is_active: number; created_at: string; has_api_key: number }[]
  >(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            (us.encrypted_api_key IS NOT NULL) as has_api_key
     FROM users u
     LEFT JOIN user_settings us ON us.user_id = u.id
     ORDER BY u.created_at DESC`
  );

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const temporaryPassword = typeof body?.temporaryPassword === "string" ? body.temporaryPassword : "";

  if (!name || !email || temporaryPassword.length < 8) {
    return NextResponse.json(
      { error: "Name, email, and a temporary password (8+ characters) are required." },
      { status: 400 }
    );
  }

  const existing = await query<{ id: number }[]>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(temporaryPassword);
  const result = await query<{ insertId: number }>(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
    [name, email, passwordHash]
  );

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}
