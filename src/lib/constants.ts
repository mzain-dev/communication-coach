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
