import "server-only";
import { generateTextWithFallback } from "@/lib/gemini";
import { WRITING_CATEGORIES, PROFICIENCY_LEVELS, type WritingCategory, type ProficiencyLevel } from "@/lib/constants";

export { WRITING_CATEGORIES, type WritingCategory };

// Module 7 (Client Track): the "client" category cycles through the writing types the plan
// specifically calls out, rather than always producing the same kind of client message.
const CLIENT_WRITING_SUBTYPES = ["a client email", "a short client proposal", "a client follow-up message"];

export async function generateWritingPrompt(
  apiKey: string,
  category: WritingCategory,
  difficulty: string
): Promise<string> {
  const categoryLabel = WRITING_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const subject =
    category === "client"
      ? CLIENT_WRITING_SUBTYPES[Math.floor(Math.random() * CLIENT_WRITING_SUBTYPES.length)]
      : `"${categoryLabel}"`;
  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Give one short writing prompt for an English learner practicing ${subject} at ${difficulty} difficulty. Return only the prompt itself, 1-3 sentences, no preamble, no quotation marks.`,
          },
        ],
      },
    ],
  }));
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned no prompt text.");
  return text;
}

export type WritingFeedbackResult = {
  correctedText: string;
  grammarCorrections: { original: string; corrected: string; explanation: string; errorType: string }[];
  tone: string;
  sentenceSuggestions: string;
  vocabularySuggestions: string;
  newVocabulary: { word: string; definition: string; example: string }[];
  clarityScore: number;
  professionalVersion: string;
  strengths: string;
  weaknesses: string;
  actionItem: string;
  estimatedLevel: ProficiencyLevel;
};

export async function generateWritingFeedback(
  apiKey: string,
  originalText: string,
  category: WritingCategory
): Promise<WritingFeedbackResult> {
  const categoryLabel = WRITING_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const clientFocus =
    category === "client"
      ? " This is a client-facing business message (Module 7 — Client Communication Track), so weight your tone and sentenceSuggestions feedback toward professional business writing: is the tone appropriate for a client (not too casual, not stiff), is it well-structured (clear ask/point, reasoning, next step), and is it persuasive and credible — rather than general fluency notes."
      : "";
  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an English writing coach. A student submitted this "${categoryLabel}" piece:\n\n"""\n${originalText}\n"""\n\nAnalyze it and return feedback.${clientFocus} correctedText should be the same piece with grammar/spelling errors fixed but the student's own voice kept. professionalVersion should be a more polished, natural-sounding rewrite for comparison. Classify each grammar correction by error type (e.g. "tense", "articles", "prepositions", "subject-verb agreement"). Also list 2-5 useful or advanced words to add to the student's vocabulary bank (from the piece, or ones that would upgrade it), each with a definition and an example sentence, and estimate their overall writing proficiency level (${PROFICIENCY_LEVELS.join(" / ")}) based on grammar accuracy, vocabulary range, and idea complexity.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          correctedText: { type: "string" },
          grammarCorrections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original: { type: "string" },
                corrected: { type: "string" },
                explanation: { type: "string", description: "Why this correction is needed, not just a flag." },
                errorType: { type: "string", description: "e.g. tense, articles, prepositions." },
              },
              required: ["original", "corrected", "explanation", "errorType"],
            },
          },
          tone: { type: "string", description: "e.g. too casual / too stiff / appropriate, with a short reason." },
          sentenceSuggestions: { type: "string", description: "Sentence structure / natural-phrasing suggestions." },
          vocabularySuggestions: { type: "string" },
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
          clarityScore: { type: "integer", description: "0-100 clarity score." },
          professionalVersion: { type: "string" },
          strengths: { type: "string" },
          weaknesses: { type: "string" },
          actionItem: { type: "string" },
          estimatedLevel: { type: "string", enum: [...PROFICIENCY_LEVELS] },
        },
        required: [
          "correctedText",
          "grammarCorrections",
          "tone",
          "sentenceSuggestions",
          "vocabularySuggestions",
          "newVocabulary",
          "clarityScore",
          "professionalVersion",
          "strengths",
          "weaknesses",
          "actionItem",
          "estimatedLevel",
        ],
      },
    },
  }));

  const text = response.text;
  if (!text) throw new Error("Gemini returned no feedback text.");
  return JSON.parse(text) as WritingFeedbackResult;
}
