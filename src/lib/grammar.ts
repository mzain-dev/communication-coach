import "server-only";
import { generateTextWithFallback } from "@/lib/gemini";

export type MicroLesson = {
  explanation: string;
  practiceItems: { prompt: string; answer: string }[];
};

/** Generates a short targeted lesson for one recurring grammar weak point (Module 5 spec). */
export async function generateMicroLesson(
  apiKey: string,
  errorType: string,
  exampleInstances: string[]
): Promise<MicroLesson> {
  const examplesText = exampleInstances.slice(0, 5).join("\n");
  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `An English learner keeps making "${errorType}" mistakes. Here are real examples from their sessions:\n\n${examplesText}\n\nWrite a short, clear micro-lesson: a 2-4 sentence explanation of the rule, then 3 short fill-in-the-blank or correction practice items (with the answer) targeting this exact weak point.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          explanation: { type: "string" },
          practiceItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                answer: { type: "string" },
              },
              required: ["prompt", "answer"],
            },
          },
        },
        required: ["explanation", "practiceItems"],
      },
    },
  }));

  const text = response.text;
  if (!text) throw new Error("Gemini returned no micro-lesson text.");
  return JSON.parse(text) as MicroLesson;
}
