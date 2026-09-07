import "server-only";
import { generateTextWithFallback } from "@/lib/gemini";
import { LISTENING_CONTENT_TYPES, PROFICIENCY_LEVELS, type ListeningContentType, type ProficiencyLevel } from "@/lib/constants";

export { LISTENING_CONTENT_TYPES, type ListeningContentType };

export type ListeningLine = { speaker: string; text: string };
export type ListeningQuestion = { question: string; choices: string[]; correctIndex: number };
export type ListeningVocabWord = { word: string; definition: string; example: string };

export type GeneratedListeningContent = {
  title: string;
  lines: ListeningLine[];
  questions: ListeningQuestion[];
  vocabulary: ListeningVocabWord[];
};

export async function generateListeningContent(
  apiKey: string,
  topic: string,
  difficulty: string,
  contentType: ListeningContentType
): Promise<GeneratedListeningContent> {
  const typeLabel = LISTENING_CONTENT_TYPES.find((t) => t.id === contentType)?.label ?? contentType;

  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Write a short ${typeLabel.toLowerCase()} (6-10 lines) in English about "${topic}", at ${difficulty} difficulty, for a language learner's listening practice. If it's a dialogue, alternate between two named speakers. If it's a news summary or monologue, use a single speaker named "Narrator". Then write 4 multiple-choice comprehension questions (4 choices each, one correct) based only on the content. Also list 3-6 useful vocabulary words that appeared in the content, each with a simple definition and an example sentence (can reuse the content's sentence).`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                speaker: { type: "string" },
                text: { type: "string" },
              },
              required: ["speaker", "text"],
            },
          },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                choices: { type: "array", items: { type: "string" } },
                correctIndex: { type: "integer" },
              },
              required: ["question", "choices", "correctIndex"],
            },
          },
          vocabulary: {
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
        },
        required: ["title", "lines", "questions", "vocabulary"],
      },
    },
  }));

  const text = response.text;
  if (!text) throw new Error("Gemini returned no listening content.");
  return JSON.parse(text) as GeneratedListeningContent;
}

export type ListeningReviewResult = {
  score: number;
  misunderstood: string;
  strengths: string;
  actionItem: string;
  estimatedLevel: ProficiencyLevel;
};

export async function generateListeningReview(
  apiKey: string,
  transcript: string,
  questions: ListeningQuestion[],
  userAnswers: number[]
): Promise<ListeningReviewResult> {
  const correctCount = questions.reduce((acc, q, i) => acc + (userAnswers[i] === q.correctIndex ? 1 : 0), 0);
  const score = Math.round((correctCount / Math.max(questions.length, 1)) * 100);

  const qa = questions
    .map(
      (q, i) =>
        `Q: ${q.question}\nCorrect: ${q.choices[q.correctIndex]}\nStudent answered: ${
          q.choices[userAnswers[i]] ?? "(no answer)"
        }`
    )
    .join("\n\n");

  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `A student listened to this content:\n\n"""\n${transcript}\n"""\n\nThen answered these comprehension questions:\n\n${qa}\n\nBriefly explain what the student misunderstood and why (reference the content), note what they understood well, and give one focus suggestion for next time. If they got everything right, say so and focus on encouragement plus one refinement tip. Also estimate their overall listening proficiency level (${PROFICIENCY_LEVELS.join(" / ")}) based on their comprehension accuracy and how complex the content they handled was.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          misunderstood: { type: "string" },
          strengths: { type: "string" },
          actionItem: { type: "string" },
          estimatedLevel: { type: "string", enum: [...PROFICIENCY_LEVELS] },
        },
        required: ["misunderstood", "strengths", "actionItem", "estimatedLevel"],
      },
    },
  }));

  const text = response.text;
  if (!text) throw new Error("Gemini returned no review text.");
  const parsed = JSON.parse(text) as Omit<ListeningReviewResult, "score">;
  return { score, ...parsed };
}
