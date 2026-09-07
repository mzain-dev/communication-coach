import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { WRITING_CATEGORIES } from "@/lib/constants";

type ClientActivity = {
  type: "speaking" | "writing";
  id: number;
  title: string;
  score: number | null;
  date: string;
};

export default async function ClientTrackPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const clientScenarios = await query<{ id: number; name: string; difficulty: string }[]>(
    "SELECT id, name, difficulty FROM scenarios WHERE is_client_track = 1 ORDER BY id ASC"
  );

  const activity = await query<ClientActivity[]>(
    `SELECT * FROM (
       SELECT 'speaking' as type, ss.id, sc.name as title, sm.score, ss.date
       FROM speaking_sessions ss
       JOIN scenarios sc ON sc.id = ss.scenario_id
       LEFT JOIN summaries sm ON sm.session_id = ss.id AND sm.session_type = 'speaking'
       WHERE ss.user_id = ? AND sc.is_client_track = 1
       UNION ALL
       SELECT 'writing' as type, we.id, we.category as title, sm.score, we.date
       FROM writing_entries we
       LEFT JOIN summaries sm ON sm.session_id = we.id AND sm.session_type = 'writing'
       WHERE we.user_id = ? AND we.category = 'client'
     ) combined
     ORDER BY date DESC
     LIMIT 20`,
    [session.sub, session.sub]
  );

  const writingClientLabel = WRITING_CATEGORIES.find((c) => c.id === "client")?.label ?? "Client message practice";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Client Communication Track</h1>
        <p className="text-sm text-muted">
          Professional, client-facing practice built on Speaking and Writing — objections, bad news,
          negotiation, status updates, and client messages.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">Live call roleplay</h2>
        <ul className="flex flex-col gap-2">
          {clientScenarios.map((s) => (
            <li key={s.id}>
              <Link
                href={`/speaking/call/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 active:bg-border"
              >
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium capitalize text-accent">
                    {s.difficulty}
                  </span>
                </div>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/writing"
        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 active:bg-border"
      >
        <div>
          <p className="text-sm font-semibold">Writing: {writingClientLabel}</p>
          <p className="text-sm text-muted">Client emails, proposals, and follow-ups</p>
        </div>
        <span aria-hidden="true">→</span>
      </Link>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">Client track history</h2>
        {activity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            No client sessions yet — start one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.map((a) => (
              <li key={`${a.type}-${a.id}`}>
                <Link
                  href={a.type === "speaking" ? `/speaking/sessions/${a.id}` : `/writing/entries/${a.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3 active:bg-border"
                >
                  <div>
                    <p className="text-sm font-medium">{a.type === "writing" ? writingClientLabel : a.title}</p>
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
