import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { GrammarTracker } from "@/components/GrammarTracker";

export default async function GrammarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await query<{ encrypted_api_key: string | null }[]>(
    "SELECT encrypted_api_key FROM user_settings WHERE user_id = ?",
    [session.sub]
  );
  const hasApiKey = Boolean(rows[0]?.encrypted_api_key);

  return <GrammarTracker hasApiKey={hasApiKey} />;
}
