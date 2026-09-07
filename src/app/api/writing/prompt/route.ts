import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getDecryptedApiKeyForUser, MissingApiKeyError } from "@/lib/gemini";
import { generateWritingPrompt, WRITING_CATEGORIES, type WritingCategory } from "@/lib/writing";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category as WritingCategory;
  const difficulty = typeof body?.difficulty === "string" ? body.difficulty : "intermediate";

  if (!WRITING_CATEGORIES.some((c) => c.id === category)) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }
  if (category === "free") {
    return NextResponse.json({ prompt: null });
  }

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const prompt = await generateWritingPrompt(apiKey, category, difficulty);
    return NextResponse.json({ prompt });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to generate writing prompt", err);
    return NextResponse.json({ error: "GENERATION_FAILED" }, { status: 502 });
  }
}
