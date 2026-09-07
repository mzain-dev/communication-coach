"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type VideoHistoryItem = {
  id: number;
  url: string;
  title: string;
  date_added: string;
  linked_speaking_session_id: number | null;
};

export function YouTubeLearning({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetch("/api/youtube/videos")
      .then((res) => res.json())
      .then((data) => setHistory(data.videos ?? []))
      .finally(() => setLoadingHistory(false));
  }, []);

  if (!hasApiKey) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-4 pt-16 text-center">
        <h1 className="text-lg font-semibold">Add your API key first</h1>
        <p className="text-sm text-muted">You need a Gemini API key on file to discuss a video.</p>
        <Link href="/settings" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          Go to Settings
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not add this video.");
        return;
      }
      router.push(`/youtube/call/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">YouTube Context Learning</h1>
        <p className="text-sm text-muted">
          Turn a video you&apos;ve watched into a live discussion — comprehension questions, summarizing,
          corrections.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          YouTube URL
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
          />
        </label>

        <div className="rounded-lg bg-background p-3 text-xs text-muted">
          We can&apos;t auto-fetch captions (YouTube blocks that), so paste the transcript yourself: on the
          video page, open the <strong>&hellip;</strong> menu below the video (or the description) →{" "}
          <strong>Show transcript</strong> → select all → copy → paste below.
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Transcript
          <textarea
            required
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            placeholder="Paste the video's transcript here…"
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !url.trim() || !transcript.trim()}
          className="rounded-xl bg-accent py-3.5 text-base font-semibold text-accent-foreground disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add video & start discussion"}
        </button>
      </form>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">Past videos</h2>
        {loadingHistory ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            No videos yet — paste one above to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                  <p className="text-xs text-muted">{new Date(v.date_added).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {v.linked_speaking_session_id && (
                    <Link
                      href={`/speaking/sessions/${v.linked_speaking_session_id}`}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium"
                    >
                      Last feedback
                    </Link>
                  )}
                  <Link
                    href={`/youtube/call/${v.id}`}
                    className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    Discuss
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
