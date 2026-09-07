import "server-only";
import { query } from "@/lib/db";
import type { ProficiencyLevel } from "@/lib/constants";
import type { Skill } from "@/lib/tracking";

const SKILLS: Skill[] = ["speaking", "writing", "listening"];

export type LevelHistoryRow = { level: ProficiencyLevel; date: string };

/** Most recent proficiency level per skill (Module 6: "current level per skill"). */
export async function getLatestLevels(userId: string): Promise<Record<Skill, LevelHistoryRow | null>> {
  const rows = await query<{ skill: Skill; level: ProficiencyLevel; date: string }[]>(
    `SELECT lh.skill, lh.level, lh.date
     FROM level_history lh
     INNER JOIN (
       SELECT skill, MAX(date) as max_date FROM level_history WHERE user_id = ? GROUP BY skill
     ) latest ON latest.skill = lh.skill AND latest.max_date = lh.date
     WHERE lh.user_id = ?`,
    [userId, userId]
  );

  const result: Record<Skill, LevelHistoryRow | null> = { speaking: null, writing: null, listening: null };
  for (const row of rows) {
    result[row.skill] = { level: row.level, date: row.date };
  }
  return result;
}

/** Recent level history for a skill, oldest first, for a simple trend display. */
export async function getLevelTrend(userId: string, skill: Skill, limit = 10): Promise<LevelHistoryRow[]> {
  const rows = await query<LevelHistoryRow[]>(
    `SELECT level, date FROM level_history WHERE user_id = ? AND skill = ? ORDER BY date DESC LIMIT ?`,
    [userId, skill, limit]
  );
  return rows.reverse();
}

/** Consecutive days (ending today or yesterday) with any logged practice — Module 6 "streaks". */
export async function getStreakDays(userId: string): Promise<number> {
  const rows = await query<{ date: string }[]>(
    `SELECT DISTINCT date FROM daily_activity WHERE user_id = ? ORDER BY date DESC LIMIT 400`,
    [userId]
  );
  if (rows.length === 0) return 0;

  const dates = rows.map((r) => new Date(r.date + "T00:00:00"));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneDay = 24 * 60 * 60 * 1000;

  const mostRecentGapDays = Math.round((today.getTime() - dates[0].getTime()) / oneDay);
  if (mostRecentGapDays > 1) return 0; // streak broken — no activity today or yesterday

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const gap = Math.round((dates[i - 1].getTime() - dates[i].getTime()) / oneDay);
    if (gap === 1) streak++;
    else break;
  }
  return streak;
}

export type PracticeMinutes = { today: number; thisWeek: number; allTime: number };

/** Total practice time — Module 6 "total practice time". */
export async function getPracticeMinutes(userId: string): Promise<PracticeMinutes> {
  const rows = await query<{ today: number; this_week: number; all_time: number }[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN date = CURDATE() THEN minutes_spent ELSE 0 END), 0) as today,
       COALESCE(SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN minutes_spent ELSE 0 END), 0) as this_week,
       COALESCE(SUM(minutes_spent), 0) as all_time
     FROM daily_activity WHERE user_id = ?`,
    [userId]
  );
  const row = rows[0] ?? { today: 0, this_week: 0, all_time: 0 };
  return { today: row.today, thisWeek: row.this_week, allTime: row.all_time };
}

export { SKILLS };
