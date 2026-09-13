// Shared, client-safe constants for the Writing and Listening modules. Kept separate from
// lib/writing.ts and lib/listening.ts, which are server-only (they call Gemini directly).

export const WRITING_CATEGORIES = [
  { id: "journal", label: "Journal / daily entry" },
  { id: "email", label: "Professional email" },
  { id: "essay", label: "Opinion / essay" },
  { id: "summary", label: "Summary writing" },
  { id: "client", label: "Client message practice" },
  { id: "free", label: "Free write" },
] as const;

export type WritingCategory = (typeof WRITING_CATEGORIES)[number]["id"];

export const LISTENING_CONTENT_TYPES = [
  { id: "dialogue", label: "Dialogue" },
  { id: "news", label: "News-style summary" },
  { id: "monologue", label: "Monologue" },
] as const;

export type ListeningContentType = (typeof LISTENING_CONTENT_TYPES)[number]["id"];

export const DIFFICULTIES = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number]["id"];

// Module 6: proficiency levels a skill progresses through, Beginner toward Professional.
export const PROFICIENCY_LEVELS = ["beginner", "intermediate", "advanced", "professional"] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];
export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  professional: "Professional",
};

/** Appended to every scenario's system prompt before minting a Live call token (Section:
 * speaking/token) — rules that apply no matter which scenario or YouTube discussion is active. */
export const CALL_GLOBAL_INSTRUCTIONS = `Two rules that override anything else in this conversation:
1. Always speak and respond in English only — no matter what language the user speaks to you in, including Urdu or any other language. Understand what they say in any language, but always reply in English, since this is an English-speaking practice app. If they switch to another language, gently encourage them to try saying it in English instead of translating for them.
2. If the user asks who built, made, owns, or is behind this app, tell them it was built by Muhammad Zain.`;
