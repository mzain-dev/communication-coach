import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { encrypt, decrypt, maskApiKey } from "@/lib/crypto";
import { DEFAULT_LIVE_MODEL_ID } from "@/lib/models";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rows = await query<{ encrypted_api_key: string | null; preferred_model: string | null }[]>(
    "SELECT encrypted_api_key, preferred_model FROM user_settings WHERE user_id = ?",
    [session.sub]
  );
  const row = rows[0];
  const maskedKey = row?.encrypted_api_key ? maskApiKey(decrypt(row.encrypted_api_key)) : null;

  return NextResponse.json({
    hasApiKey: Boolean(row?.encrypted_api_key),
    maskedKey,
    preferredModel: row?.preferred_model ?? DEFAULT_LIVE_MODEL_ID,
  });
}

export async function PUT(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const preferredModel = typeof body?.preferredModel === "string" ? body.preferredModel : DEFAULT_LIVE_MODEL_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required." }, { status: 400 });
  }

  const encrypted = encrypt(apiKey);

  await query(
    `INSERT INTO user_settings (user_id, encrypted_api_key, preferred_model)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE encrypted_api_key = VALUES(encrypted_api_key), preferred_model = VALUES(preferred_model)`,
    [session.sub, encrypted, preferredModel]
  );

  return NextResponse.json({ ok: true, maskedKey: maskApiKey(apiKey) });
}
