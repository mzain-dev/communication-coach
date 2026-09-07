import Link from "next/link";
import { query } from "@/lib/db";

type Scenario = {
  id: number;
  name: string;
  type: string;
  difficulty: string;
  is_client_track: number;
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  casual: "Everyday spoken conversation practice.",
  client: "Roleplay a professional client call.",
  difficult: "Practice staying calm and clear under pressure.",
  interview: "Answer common interview questions live.",
  custom: "Describe your own scenario when the call starts.",
};

export default async function SpeakingPage() {
  // Excludes the "youtube" scenario type — that's an internal FK placeholder for YouTube-context
  // calls (Module 9), which get their real system prompt from the video's transcript, not this row.
  const scenarios = await query<Scenario[]>(
    "SELECT id, name, type, difficulty, is_client_track FROM scenarios WHERE type != 'youtube' ORDER BY id ASC"
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Speaking Practice</h1>
          <p className="text-sm text-muted">Pick a scenario to start a live voice conversation.</p>
        </div>
        <Link href="/speaking/history" className="shrink-0 text-sm text-accent">
          History
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {scenarios.map((s) => (
          <li key={s.id}>
            <Link
              href={`/speaking/call/${s.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 active:bg-border"
            >
              <div>
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="mt-0.5 text-sm text-muted">{TYPE_DESCRIPTIONS[s.type] ?? ""}</p>
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
  );
}
