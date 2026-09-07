import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDecryptedApiKeyForUser, MissingApiKeyError } from "@/lib/gemini";
import { generateMicroLesson } from "@/lib/grammar";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const errorType = typeof body?.errorType === "string" ? body.errorType : "";
  if (!errorType) return NextResponse.json({ error: "errorType is required." }, { status: 400 });

  const examples = await query<{ example: string }[]>(
    "SELECT example FROM grammar_errors WHERE user_id = ? AND error_type = ? ORDER BY date DESC LIMIT 5",
    [session.sub, errorType]
  );

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const lesson = await generateMicroLesson(
      apiKey,
      errorType,
      examples.map((e) => e.example)
    );
    return NextResponse.json({ lesson });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to generate micro-lesson", err);
    return NextResponse.json({ error: "GENERATION_FAILED" }, { status: 502 });
  }
}
