import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { getLatestLevels, getStreakDays, getPracticeMinutes } from "@/lib/progress";
import { PROFICIENCY_LABELS } from "@/lib/constants";
import type { Skill } from "@/lib/tracking";

const SKILL_LABELS: Record<Skill, string> = { speaking: "Speaking", writing: "Writing", listening: "Listening" };

export default async function ManageUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }
  const { id } = await params;

  const users = await query<
    { id: number; name: string; email: string; role: string; is_active: number; created_at: string; last_login_at: string | null }[]
  >("SELECT id, name, email, role, is_active, created_at, last_login_at FROM users WHERE id = ?", [id]);
  const user = users[0];
  if (!user) notFound();

  const sessions = await query<
    { id: number; scenario_name: string; duration_seconds: number; model_used: string | null; date: string; score: number | null }[]
  >(
    `SELECT ss.id, COALESCE(yt.title, sc.name) as scenario_name, ss.duration_seconds, ss.model_used, ss.date, sm.score
     FROM speaking_sessions ss
     JOIN scenarios sc ON sc.id = ss.scenario_id
     LEFT JOIN youtube_sessions yt ON yt.linked_speaking_session_id = ss.id
     LEFT JOIN summaries sm ON sm.session_id = ss.id AND sm.session_type = 'speaking'
     WHERE ss.user_id = ? ORDER BY ss.date DESC LIMIT 50`,
    [id]
  );

  const [levels, streak, minutes] = await Promise.all([
    getLatestLevels(id),
    getStreakDays(id),
    getPracticeMinutes(id),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <Link href="/manage/users" className="text-sm text-muted">
        ← User Management
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{user.name}</h1>
        <p className="text-sm text-muted">{user.email}</p>
        <p className="mt-1 text-xs text-muted">
          {user.role} · {user.is_active ? "Active" : "Deactivated"} · joined{" "}
          {new Date(user.created_at).toLocaleDateString()} ·{" "}
          {user.last_login_at
            ? `last login ${new Date(user.last_login_at).toLocaleDateString()}`
            : "never logged in"}
        </p>
      </div>

      <p className="text-xs text-muted">
        Read-only view: this shows the same activity the user sees on their own dashboard. Their API key is never
        visible here, even encrypted.
      </p>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {streak} day{streak === 1 ? "" : "s"} streak
          </p>
          <p className="text-sm text-muted">{minutes.thisWeek} min this week · {minutes.allTime} min all-time</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(Object.keys(SKILL_LABELS) as Skill[]).map((skill) => {
            const level = levels[skill];
            return (
              <div key={skill} className="rounded-lg bg-background p-2 text-center">
                <p className="text-xs text-muted">{SKILL_LABELS[skill]}</p>
                <p className="text-sm font-semibold">{level ? PROFICIENCY_LABELS[level.level] : "—"}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">Speaking sessions</h2>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">No sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">{s.scenario_name}</p>
                  <p className="text-xs text-muted">
                    {new Date(s.date).toLocaleDateString()} · {Math.round(s.duration_seconds / 60)} min
                    {s.model_used ? ` · ${s.model_used}` : ""}
                  </p>
                </div>
                {s.score != null && (
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                    {s.score}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
