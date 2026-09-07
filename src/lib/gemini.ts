import "server-only";
import { GoogleGenAI, Modality, ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { query } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { TEXT_MODEL_FALLBACK_CHAIN } from "@/lib/models";
import { PROFICIENCY_LEVELS, type ProficiencyLevel } from "@/lib/constants";

export class MissingApiKeyError extends Error {
  constructor() {
    super("No Gemini API key on file for this user.");
    this.name = "MissingApiKeyError";
  }
}

/**
 * Decrypts the current user's Gemini API key in-memory, for the duration of a single call.
 * Nothing here is ever sent to the client — this is the "shared per-user key helper" every
 * module is required to go through (Section 2.4 / Module 0).
 */
export async function getDecryptedApiKeyForUser(userId: string): Promise<string> {
  const rows = await query<{ encrypted_api_key: string | null }[]>(
    "SELECT encrypted_api_key FROM user_settings WHERE user_id = ?",
    [userId]
  );
  const encrypted = rows[0]?.encrypted_api_key;
  if (!encrypted) throw new MissingApiKeyError();
  return decrypt(encrypted);
}

/** Mints a short-lived, single-use token so the browser can open a Live API session directly
 * without ever seeing the user's real API key. */
export async function createEphemeralLiveToken(apiKey: string, modelId: string, systemPrompt: string) {
  const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: modelId,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: systemPrompt,
        },
      },
    },
  });
  if (!token.name) throw new Error("Gemini did not return an ephemeral token.");
  return token.name;
}

/**
 * Calls Gemini's text model with automatic fallback across TEXT_MODEL_FALLBACK_CHAIN. Used by
 * every text-generation call (Writing, Listening, Speaking's after-call feedback) so a rate
 * limit or a retired model on the primary model doesn't fail the whole request — same
 * reliability pattern as the Live API fallback chain (Section 2.2), extended to text calls.
 */
export async function generateTextWithFallback(
  apiKey: string,
  buildParams: (model: string) => Omit<GenerateContentParameters, "model">
): Promise<GenerateContentResponse> {
  const client = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (const model of TEXT_MODEL_FALLBACK_CHAIN) {
    try {
      return await client.models.generateContent({ model, ...buildParams(model) });
    } catch (err) {
      lastError = err;
      // Fall back on anything that isn't the client's fault: rate limits (429), a
      // retired/unavailable model (404), server overload (503, confirmed to happen in
      // practice — Gemini returns this under real load), or a transient server error (500).
      // A genuinely bad API key (400/401/403) fails identically on every model, so don't
      // waste the rest of the chain on it.
      const retryable = err instanceof ApiError && [404, 429, 500, 503].includes(err.status);
      const status = err instanceof ApiError ? err.status : "unknown";
      console.warn(`Gemini text model "${model}" failed (status ${status}) — ${retryable ? "trying next model" : "not retrying"}.`);
      if (!retryable) throw err;
    }
  }
  throw lastError;
}

export type GrammarErrorItem = { errorType: string; example: string };
export type NewVocabWord = { word: string; definition: string; example: string };

export type FeedbackResult = {
  fluency: string;
  grammarAccuracy: string;
  vocabularyLevel: string;
  confidenceTone: string;
  correctedExamples: { original: string; corrected: string }[];
  overallScore: number;
  strengths: string;
  weaknesses: string;
  actionItem: string;
  grammarErrors: GrammarErrorItem[];
  newVocabulary: NewVocabWord[];
  estimatedLevel: ProficiencyLevel;
};

export type SpeakingFocusMode = "default" | "client" | "youtube";

/** Generates structured after-call feedback from a transcript (Module 1 requirement). */
export async function generateSpeakingFeedback(
  apiKey: string,
  transcript: string,
  scenarioName: string,
  focusMode: SpeakingFocusMode = "default"
): Promise<FeedbackResult> {
  const focusInstruction =
    focusMode === "client"
      ? `This was a "${scenarioName}" client roleplay (Module 7 — Client Communication Track). Weight your feedback toward professional/business communication: was their tone appropriate for a client (not too casual, not stiff), was their response well-structured (clear point, reasoning, next step), and were they persuasive/credible — rather than general beginner-level fluency notes.`
      : focusMode === "youtube"
        ? `This was a conversation discussing the YouTube video "${scenarioName}" (Module 9 — YouTube Context Learning). Weight your feedback toward how well the student understood and discussed the video's actual content — comprehension accuracy, ability to summarize sections in their own words, specific gaps in understanding — alongside their speaking quality and any vocabulary drawn from the video, not just generic fluency notes.`
        : `A student just finished a "${scenarioName}" spoken practice session.`;

  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an English communication coach. ${focusInstruction} Here is the transcript (their turns and the AI partner's turns):\n\n${transcript}\n\nAnalyze the student's spoken English only (ignore the AI partner's lines) and return feedback. Also classify each recurring grammar mistake by type (e.g. "tense", "articles", "prepositions", "subject-verb agreement") with one example, list 2-5 useful or advanced words the student used or should learn from this session, and estimate their overall speaking proficiency level (${PROFICIENCY_LEVELS.join(" / ")}) based on grammar accuracy, vocabulary range, fluency, and idea complexity.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          fluency: { type: "string", description: "Notes on pauses, hesitation, filler words." },
          grammarAccuracy: { type: "string" },
          vocabularyLevel: { type: "string" },
          confidenceTone: { type: "string" },
          correctedExamples: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original: { type: "string" },
                corrected: { type: "string" },
              },
              required: ["original", "corrected"],
            },
          },
          overallScore: { type: "integer", description: "0-100 overall speaking score." },
          strengths: { type: "string" },
          weaknesses: { type: "string" },
          actionItem: { type: "string", description: "One concrete focus suggestion for next time." },
          grammarErrors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                errorType: { type: "string", description: "e.g. tense, articles, prepositions." },
                example: { type: "string" },
              },
              required: ["errorType", "example"],
            },
          },
          newVocabulary: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                definition: { type: "string" },
                example: { type: "string" },
              },
              required: ["word", "definition", "example"],
            },
          },
          estimatedLevel: { type: "string", enum: [...PROFICIENCY_LEVELS] },
        },
        required: [
          "fluency",
          "grammarAccuracy",
          "vocabularyLevel",
          "confidenceTone",
          "correctedExamples",
          "overallScore",
          "strengths",
          "weaknesses",
          "actionItem",
          "grammarErrors",
          "newVocabulary",
          "estimatedLevel",
        ],
      },
    },
  }));

  const text = response.text;
  if (!text) throw new Error("Gemini returned no feedback text.");
  return JSON.parse(text) as FeedbackResult;
}
