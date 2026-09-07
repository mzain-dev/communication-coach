import "server-only";

/** Accepts youtube.com/watch, youtu.be, youtube.com/shorts, and embed URL forms. */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

export class InvalidYouTubeUrlError extends Error {
  constructor() {
    super("That doesn't look like a valid YouTube video URL.");
    this.name = "InvalidYouTubeUrlError";
  }
}

/**
 * Title via YouTube's official, public oEmbed endpoint — no scraping, no API key needed.
 * (Automatic transcript/caption extraction is NOT done here: YouTube actively blocks
 * server-side scraping of captions now, so the user pastes the transcript themselves —
 * see the "Show transcript" feature on the video page.)
 */
export async function fetchYouTubeTitle(url: string): Promise<string> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) throw new InvalidYouTubeUrlError();

  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;
  const res = await fetch(oEmbedUrl);
  if (!res.ok) throw new InvalidYouTubeUrlError();
  const data = (await res.json()) as { title?: string };
  if (!data.title) throw new InvalidYouTubeUrlError();
  return data.title;
}
