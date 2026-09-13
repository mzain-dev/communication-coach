import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDecryptedApiKeyForUser, createEphemeralLiveToken, MissingApiKeyError } from "@/lib/gemini";
import { LIVE_MODEL_FALLBACK_CHAIN, DEFAULT_LIVE_MODEL_ID } from "@/lib/models";
import { CALL_GLOBAL_INSTRUCTIONS } from "@/lib/constants";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const scenarioId = Number(body?.scenarioId) || null;
  const youtubeSessionId = Number(body?.youtubeSessionId) || null;
  const modelId = typeof body?.modelId === "string" ? body.modelId : DEFAULT_LIVE_MODEL_ID;

  if (!scenarioId && !youtubeSessionId) {
    return NextResponse.json({ error: "Either scenarioId or youtubeSessionId is required." }, { status: 400 });
  }
  if (!LIVE_MODEL_FALLBACK_CHAIN.some((m) => m.id === modelId)) {
    return NextResponse.json({ error: "Unknown modelId." }, { status: 400 });
  }

  let systemPrompt: string;

  if (youtubeSessionId) {
    const videos = await query<{ title: string; transcript: string }[]>(
      "SELECT title, transcript FROM youtube_sessions WHERE id = ? AND user_id = ?",
      [youtubeSessionId, session.sub]
    );
    const video = videos[0];
    if (!video) return NextResponse.json({ error: "YouTube video not found." }, { status: 404 });
    systemPrompt = `You are having a spoken conversation with an English learner about a YouTube video titled "${video.title}". Here is the video's transcript for context:\n\n${video.transcript}\n\nDiscuss the video naturally: ask comprehension questions about specific parts, challenge the learner to summarize sections in their own words, and gently correct misunderstandings about the video's content or their English. Speak naturally, one point at a time — don't recite the whole transcript back at them.`;
  } else {
    const scenarios = await query<{ system_prompt: string; name: string }[]>(
      "SELECT system_prompt, name FROM scenarios WHERE id = ?",
      [scenarioId]
    );
    const scenario = scenarios[0];
    if (!scenario) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
    systemPrompt = scenario.system_prompt;
  }

  systemPrompt = `${systemPrompt}\n\n${CALL_GLOBAL_INSTRUCTIONS}`;

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const token = await createEphemeralLiveToken(apiKey, modelId, systemPrompt);
    return NextResponse.json({ token, modelId });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to mint Live API token", err);
    return NextResponse.json({ error: "RATE_LIMITED_OR_UNAVAILABLE" }, { status: 502 });
  }
}
