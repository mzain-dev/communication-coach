import Link from "next/link";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { WRITING_CATEGORIES } from "@/lib/constants";
import { getStreakDays, getPracticeMinutes } from "@/lib/progress";

type RecentActivity = {
  type: "speaking" | "writing" | "listening";
  id: number;
  title: string;
  score: number | null;
  date: string;
};

const MODULE_LINKS: { href: string; title: string; description: string }[] = [
  { href: "/speaking", title: "Speaking Practice", description: "Live voice conversation with an AI partner" },
  { href: "/writing", title: "Writing Practice", description: "Get structured feedback on your writing" },
  { href: "/listening", title: "Listening Practice", description: "AI-generated audio comprehension drills" },
  { href: "/client-track", title: "Client Track", description: "Professional client calls and messages" },
  { href: "/youtube", title: "YouTube Learning", description: "Discuss a video you've watched" },
  { href: "/vocabulary", title: "Vocabulary Bank", description: "Review words with spaced repetition" },
  { href: "/grammar", title: "Grammar Tracker", description: "See your recurring mistakes and fix them" },
];

function activityHref(a: RecentActivity) {
  if (a.type === "speaking") return `/speaking/sessions/${a.id}`;
  if (a.type === "writing") return `/writing/entries/${a.id}`;
  return `/listening/exercises/${a.id}`;
}

function activityTitle(a: RecentActivity) {
  if (a.type === "writing") return WRITING_CATEGORIES.find((c) => c.id === a.title)?.label ?? a.title;
  return a.title;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const settingsRows = await query<{ encrypted_api_key: string | null }[]>(
    "SELECT encrypted_api_key FROM user_settings WHERE user_id = ?",
    [session.sub]
  );
  const hasApiKey = Boolean(settingsRows[0]?.encrypted_api_key);
  const [streak, minutes] = await Promise.all([getStreakDays(session.sub), getPracticeMinutes(session.sub)]);

  const recentActivity = await query<RecentActivity[]>(
    `SELECT * FROM (
       SELECT 'speaking' as type, ss.id, COALESCE(yt.title, sc.name) as title, sm.score, ss.date
       FROM speaking_sessions ss
       JOIN scenarios sc ON sc.id = ss.scenario_id
       LEFT JOIN youtube_sessions yt ON yt.linked_speaking_session_id = ss.id
       LEFT JOIN summaries sm ON sm.session_id = ss.id AND sm.session_type = 'speaking'
       WHERE ss.user_id = ?
       UNION ALL
       SELECT 'writing' as type, we.id, we.category as title, sm.score, we.date
       FROM writing_entries we
       LEFT JOIN summaries sm ON sm.session_id = we.id AND sm.session_type = 'writing'
       WHERE we.user_id = ?
       UNION ALL
       SELECT 'listening' as type, le.id, le.topic as title, le.score, le.date
       FROM listening_exercises le
       WHERE le.user_id = ?
     ) combined
     ORDER BY date DESC
     LIMIT 5`,
    [session.sub, session.sub, session.sub]
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Welcome back, {session.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted">Let&apos;s keep your English communication skills moving.</p>
      </div>

      {!hasApiKey && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Add your Gemini API key to unlock practice</p>
          <p className="mt-1 text-sm text-muted">
            Every AI-powered module needs your own Gemini API key. It&apos;s encrypted before it&apos;s stored.
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Go to Settings
          </Link>
        </div>
      )}

      <Link
        href="/progress"
        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 active:bg-border"
      >
        <div>
          <p className="text-sm font-semibold">
            {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} streak` : "Your progress"}
          </p>
          <p className="text-sm text-muted">{minutes.thisWeek} min practiced this week · view levels &amp; trends</p>
        </div>
        <span aria-hidden="true">→</span>
      </Link>

      <div className="flex flex-col gap-2">
        {MODULE_LINKS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 active:bg-border"
          >
            <div>
              <p className="text-sm font-semibold">{m.title}</p>
              <p className="text-sm text-muted">{m.description}</p>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            No sessions yet — start with one of the modules above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentActivity.map((a) => (
              <li key={`${a.type}-${a.id}`}>
                <Link
                  href={activityHref(a)}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3 active:bg-border"
                >
                  <div>
                    <p className="text-sm font-medium">{activityTitle(a)}</p>
                    <p className="text-xs capitalize text-muted">
                      {a.type} · {new Date(a.date).toLocaleDateString()}
                    </p>
                  </div>
                  {a.score != null && (
                    <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                      {a.score}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
