import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { LiveCallClient } from "@/components/LiveCallClient";

export default async function CallPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { scenarioId } = await params;
  const scenarios = await query<{ id: number; name: string; difficulty: string }[]>(
    "SELECT id, name, difficulty FROM scenarios WHERE id = ?",
    [scenarioId]
  );
  const scenario = scenarios[0];
  if (!scenario) notFound();

  const settingsRows = await query<{ encrypted_api_key: string | null; preferred_model: string | null }[]>(
    "SELECT encrypted_api_key, preferred_model FROM user_settings WHERE user_id = ?",
    [session.sub]
  );
  const hasApiKey = Boolean(settingsRows[0]?.encrypted_api_key);
  const preferredModel = settingsRows[0]?.preferred_model ?? null;

  return (
    <LiveCallClient
      scenario={{ id: scenario.id, name: scenario.name, difficulty: scenario.difficulty }}
      hasApiKey={hasApiKey}
      preferredModel={preferredModel}
    />
  );
}
