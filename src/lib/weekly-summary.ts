import "server-only";
import { generateTextWithFallback } from "@/lib/gemini";

export type WeeklySummaryResult = {
  biggestImprovement: string;
  weakPoint: string;
  focusSuggestion: string;
};

/** Module 6: "Weekly summary: biggest improvement, ongoing weak point, and a focus suggestion." */
export async function generateWeeklySummary(apiKey: string, contextText: string): Promise<WeeklySummaryResult> {
  const response = await generateTextWithFallback(apiKey, () => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Here is a summary of an English learner's practice activity over the last 7 days:\n\n${contextText}\n\nWrite a short weekly summary: their biggest improvement this week, their ongoing weak point, and one concrete focus suggestion for next week. If there isn't enough data for one of these, say so briefly rather than inventing detail.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          biggestImprovement: { type: "string" },
          weakPoint: { type: "string" },
          focusSuggestion: { type: "string" },
        },
        required: ["biggestImprovement", "weakPoint", "focusSuggestion"],
      },
    },
  }));

  const text = response.text;
  if (!text) throw new Error("Gemini returned no weekly summary text.");
  return JSON.parse(text) as WeeklySummaryResult;
}
