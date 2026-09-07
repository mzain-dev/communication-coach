import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getLatestLevels, getLevelTrend, getStreakDays, getPracticeMinutes } from "@/lib/progress";
import { PROFICIENCY_LEVELS, PROFICIENCY_LABELS } from "@/lib/constants";
import type { Skill } from "@/lib/tracking";
import { WeeklySummaryCard } from "@/components/WeeklySummaryCard";

const SKILL_META: Record<Skill, { label: string; href: string }> = {
  speaking: { label: "Speaking", href: "/speaking" },
  writing: { label: "Writing", href: "/writing" },
  listening: { label: "Listening", href: "/listening" },
};

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [levels, streak, minutes, apiKeyRows] = await Promise.all([
    getLatestLevels(session.sub),
    getStreakDays(session.sub),
    getPracticeMinutes(session.sub),
    query<{ encrypted_api_key: string | null }[]>("SELECT encrypted_api_key FROM user_settings WHERE user_id = ?", [
      session.sub,
    ]),
  ]);
  const hasApiKey = Boolean(apiKeyRows[0]?.encrypted_api_key);

  const trends = await Promise.all(
    (Object.keys(SKILL_META) as Skill[]).map((skill) => getLevelTrend(session.sub, skill, 6))
  );
  const trendBySkill: Record<Skill, Awaited<ReturnType<typeof getLevelTrend>>> = {
    speaking: trends[0],
    writing: trends[1],
    listening: trends[2],
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-xl font-semibold">Progress</h1>
        <p className="text-sm text-muted">Your level per skill, streaks, and practice time.</p>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <OverviewCard streak={streak} minutes={minutes} />
        {(Object.keys(SKILL_META) as Skill[]).map((skill) => (
          <SkillCard key={skill} skill={skill} level={levels[skill]} trend={trendBySkill[skill]} />
        ))}
      </div>

      <div className="mx-auto w-full max-w-lg">
        <WeeklySummaryCard hasApiKey={hasApiKey} />
      </div>
    </div>
  );
}

function OverviewCard({ streak, minutes }: { streak: number; minutes: { today: number; thisWeek: number; allTime: number } }) {
  return (
    <div className="w-[85%] shrink-0 snap-center rounded-2xl border border-border bg-card p-5 sm:w-80">
      <p className="text-xs font-semibold text-muted">Overview</p>
      <p className="mt-2 text-3xl font-semibold">
        {streak} <span className="text-base font-normal text-muted">day{streak === 1 ? "" : "s"} streak</span>
      </p>
      <div className="mt-4 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Today</span>
          <span>{minutes.today} min</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">This week</span>
          <span>{minutes.thisWeek} min</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">All time</span>
          <span>{minutes.allTime} min</span>
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  level,
  trend,
}: {
  skill: Skill;
  level: { level: (typeof PROFICIENCY_LEVELS)[number]; date: string } | null;
  trend: { level: (typeof PROFICIENCY_LEVELS)[number]; date: string }[];
}) {
  const meta = SKILL_META[skill];
  const improved =
    trend.length >= 2 && PROFICIENCY_LEVELS.indexOf(trend[trend.length - 1].level) > PROFICIENCY_LEVELS.indexOf(trend[0].level);

  return (
    <Link
      href={meta.href}
      className="w-[85%] shrink-0 snap-center rounded-2xl border border-border bg-card p-5 sm:w-80"
    >
      <p className="text-xs font-semibold text-muted">{meta.label}</p>
      {level ? (
        <>
          <p className="mt-2 text-2xl font-semibold">{PROFICIENCY_LABELS[level.level]}</p>
          {improved && <p className="mt-1 text-xs font-medium text-accent">↑ Improved this stretch</p>}
          <div className="mt-3 flex gap-1">
            {trend.map((t, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full bg-accent"
                style={{ opacity: 0.3 + (0.7 * (PROFICIENCY_LEVELS.indexOf(t.level) + 1)) / PROFICIENCY_LEVELS.length }}
                title={`${PROFICIENCY_LABELS[t.level]} · ${new Date(t.date).toLocaleDateString()}`}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Complete a session to see your level.</p>
      )}
    </Link>
  );
}
