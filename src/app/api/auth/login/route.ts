import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSessionToken, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  is_active: number;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const rows = await query<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.is_active) {
    return NextResponse.json({ error: "This account has been deactivated." }, { status: 403 });
  }

  const token = await createSessionToken({
    sub: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
  });

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
