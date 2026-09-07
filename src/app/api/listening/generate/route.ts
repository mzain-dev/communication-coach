import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getDecryptedApiKeyForUser, MissingApiKeyError } from "@/lib/gemini";
import { generateListeningContent, LISTENING_CONTENT_TYPES, type ListeningContentType } from "@/lib/listening";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const difficulty = typeof body?.difficulty === "string" ? body.difficulty : "intermediate";
  const contentType = body?.contentType as ListeningContentType;

  if (!topic) return NextResponse.json({ error: "topic is required." }, { status: 400 });
  if (!LISTENING_CONTENT_TYPES.some((t) => t.id === contentType)) {
    return NextResponse.json({ error: "Unknown contentType." }, { status: 400 });
  }

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const content = await generateListeningContent(apiKey, topic, difficulty, contentType);
    return NextResponse.json({ content });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to generate listening content", err);
    return NextResponse.json({ error: "GENERATION_FAILED" }, { status: 502 });
  }
}
