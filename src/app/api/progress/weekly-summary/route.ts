import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDecryptedApiKeyForUser, MissingApiKeyError } from "@/lib/gemini";
import { generateWeeklySummary } from "@/lib/weekly-summary";

export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const levels = await query<{ skill: string; level: string; date: string }[]>(
    `SELECT skill, level, date FROM level_history WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY date ASC`,
    [session.sub]
  );
  const scores = await query<{ session_type: string; score: number | null; date: string }[]>(
    `SELECT session_type, score, date FROM summaries WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY date ASC`,
    [session.sub]
  );
  const grammarPatterns = await query<{ error_type: string; frequency: number }[]>(
    `SELECT error_type, COUNT(*) as frequency FROM grammar_errors WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY error_type ORDER BY frequency DESC LIMIT 5`,
    [session.sub]
  );
  const minutes = await query<{ total: number }[]>(
    `SELECT COALESCE(SUM(minutes_spent), 0) as total FROM daily_activity WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
    [session.sub]
  );

  if (levels.length === 0 && scores.length === 0) {
    return NextResponse.json({ error: "NOT_ENOUGH_DATA" }, { status: 200 });
  }

  const contextText = [
    `Total practice time this week: ${minutes[0]?.total ?? 0} minutes.`,
    `Proficiency level estimates logged: ${levels.map((l) => `${l.skill}=${l.level} (${l.date})`).join(", ") || "none"}.`,
    `Session scores: ${scores.map((s) => `${s.session_type}=${s.score ?? "n/a"} (${s.date})`).join(", ") || "none"}.`,
    `Most frequent grammar mistakes: ${grammarPatterns.map((g) => `${g.error_type} (${g.frequency}x)`).join(", ") || "none logged"}.`,
  ].join("\n");

  try {
    const apiKey = await getDecryptedApiKeyForUser(session.sub);
    const summary = await generateWeeklySummary(apiKey, contextText);
    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: "NO_API_KEY" }, { status: 412 });
    }
    console.error("Failed to generate weekly summary", err);
    return NextResponse.json({ error: "GENERATION_FAILED" }, { status: 502 });
  }
}
