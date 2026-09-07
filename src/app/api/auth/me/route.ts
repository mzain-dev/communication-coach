import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  const rows = await query<{ encrypted_api_key: string | null }[]>(
    "SELECT encrypted_api_key FROM user_settings WHERE user_id = ?",
    [session.sub]
  );

  return NextResponse.json({
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
      hasApiKey: Boolean(rows[0]?.encrypted_api_key),
    },
  });
}
