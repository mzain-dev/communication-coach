import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { LiveCallClient } from "@/components/LiveCallClient";

export default async function YouTubeCallPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const videos = await query<{ id: number; title: string }[]>(
    "SELECT id, title FROM youtube_sessions WHERE id = ? AND user_id = ?",
    [id, session.sub]
  );
  const video = videos[0];
  if (!video) notFound();

  const settingsRows = await query<{ encrypted_api_key: string | null; preferred_model: string | null }[]>(
    "SELECT encrypted_api_key, preferred_model FROM user_settings WHERE user_id = ?",
    [session.sub]
  );
  const hasApiKey = Boolean(settingsRows[0]?.encrypted_api_key);
  const preferredModel = settingsRows[0]?.preferred_model ?? null;

  return (
    <LiveCallClient
      scenario={{ id: video.id, name: video.title, difficulty: "Video" }}
      youtubeSessionId={video.id}
      hasApiKey={hasApiKey}
      preferredModel={preferredModel}
      backHref="/youtube"
      backLabel="Back to videos"
    />
  );
}
