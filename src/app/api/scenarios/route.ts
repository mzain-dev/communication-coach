import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const scenarios = await query<
    { id: number; name: string; type: string; difficulty: string; is_client_track: number }[]
  >("SELECT id, name, type, difficulty, is_client_track FROM scenarios ORDER BY id ASC");

  return NextResponse.json({ scenarios });
}
