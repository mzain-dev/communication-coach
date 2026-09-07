import "server-only";
import { query } from "@/lib/db";

// Simple Leitner-style spaced repetition: each level maps to a review interval. A correct
// review moves a word up a level (reviewed less often); a miss drops it back to daily review.
const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 14, 30];
const MAX_MASTERY_LEVEL = REVIEW_INTERVALS_DAYS.length - 1;

export function nextReviewSchedule(currentMasteryLevel: number, gotItRight: boolean) {
  const masteryLevel = gotItRight
    ? Math.min(currentMasteryLevel + 1, MAX_MASTERY_LEVEL)
    : Math.max(currentMasteryLevel - 1, 0);
  return { masteryLevel, intervalDays: REVIEW_INTERVALS_DAYS[masteryLevel] };
}

/** Logs recurring grammar mistakes so the Grammar Tracker can aggregate patterns across
 * sessions (Module 5) — called after Speaking and Writing feedback generation. */
export async function recordGrammarErrors(
  userId: string,
  sessionId: number,
  sessionType: "speaking" | "writing",
  errors: { errorType: string; example: string }[]
) {
  for (const error of errors) {
    await query(
      `INSERT INTO grammar_errors (user_id, error_type, example, session_id, session_type)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, error.errorType, error.example, sessionId, sessionType]
    );
  }
}

/** Auto-collects new/misused words into the Vocabulary Bank (Module 4) — called after
 * Speaking, Writing, and Listening sessions, per that module's own spec. */
export async function recordVocabulary(
  userId: string,
  words: { word: string; definition: string; example: string }[],
  sourceModule: "speaking" | "writing" | "listening"
) {
  for (const word of words) {
    await query(
      `INSERT INTO vocabulary (user_id, word, definition, example, source_module, next_review_date)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [userId, word.word, word.definition, word.example, sourceModule]
    );
  }
}

export type Skill = "speaking" | "writing" | "listening";
export type ProficiencyLevel = "beginner" | "intermediate" | "advanced" | "professional";

/** Logs a per-skill proficiency estimate after each session, so progress toward
 * Professional is visible over time (Module 6). */
export async function recordLevelEstimate(
  userId: string,
  skill: Skill,
  level: ProficiencyLevel,
  sessionId: number
) {
  await query(
    `INSERT INTO level_history (user_id, skill, level, session_id) VALUES (?, ?, ?, ?)`,
    [userId, skill, level, sessionId]
  );
}

/** Upserts today's practice time for a module, for streaks and total-time tracking (Module 6). */
export async function recordDailyActivity(userId: string, module: Skill, minutesSpent: number) {
  if (minutesSpent <= 0) return;
  await query(
    `INSERT INTO daily_activity (user_id, date, module, minutes_spent)
     VALUES (?, CURDATE(), ?, ?)
     ON DUPLICATE KEY UPDATE minutes_spent = minutes_spent + VALUES(minutes_spent)`,
    [userId, module, minutesSpent]
  );
}

/**
 * Deletes everything a practice session generated elsewhere (feedback, grammar log entries,
 * level estimate) — called before deleting the session's own row so "delete" actually removes
 * the data rather than leaving orphaned rows an aggregate view (Grammar Tracker, Progress)
 * would otherwise keep counting.
 */
export async function deleteSessionRelatedData(userId: string, sessionId: number, sessionType: Skill) {
  await query("DELETE FROM summaries WHERE user_id = ? AND session_id = ? AND session_type = ?", [
    userId,
    sessionId,
    sessionType,
  ]);
  if (sessionType !== "listening") {
    await query("DELETE FROM grammar_errors WHERE user_id = ? AND session_id = ? AND session_type = ?", [
      userId,
      sessionId,
      sessionType,
    ]);
  }
  // level_history has no session_type column — `skill` disambiguates which table session_id refers to.
  await query("DELETE FROM level_history WHERE user_id = ? AND session_id = ? AND skill = ?", [
    userId,
    sessionId,
    sessionType,
  ]);
}
