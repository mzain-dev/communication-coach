"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { LIVE_MODEL_FALLBACK_CHAIN } from "@/lib/models";
import { MicStreamer } from "@/lib/audio/MicStreamer";
import { AudioPlayer } from "@/lib/audio/AudioPlayer";
import type { FeedbackResult } from "@/lib/gemini";
import { FeedbackCard } from "@/components/FeedbackCard";

type Scenario = { id: number; name: string; difficulty: string };
type TranscriptLine = { speaker: "user" | "ai"; text: string };
type Status = "idle" | "connecting" | "reconnecting" | "live" | "ended" | "failed" | "no-key";

export function LiveCallClient({
  scenario,
  hasApiKey,
  preferredModel,
  youtubeSessionId,
  backHref = "/speaking",
  backLabel = "Back to scenarios",
}: {
  scenario: Scenario;
  hasApiKey: boolean;
  preferredModel: string | null;
  /** Module 9: when set, the call is a YouTube-context discussion instead of a fixed scenario —
   * the token/session endpoints build context from this video's transcript instead of scenario.id. */
  youtubeSessionId?: number;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(hasApiKey ? "idle" : "no-key");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [muted, setMuted] = useState(false);
  // Whether the model is currently streaming audio back — the signal that lets the call screen
  // show "AI is speaking" instead of a static "Live" the whole time (Section: perceived latency).
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const micRef = useRef<MicStreamer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelUsedRef = useRef<string | null>(null);
  const endedByUserRef = useRef(false);
  const bufferRef = useRef<{ speaker: "user" | "ai" | null; text: string }>({ speaker: null, text: "" });
  // Mic level is written directly to the DOM (not via setState) — it fires ~20x/sec and this is
  // a purely cosmetic ring, so avoid adding that many React re-renders to the same main thread
  // that's already resampling/encoding/sending every audio chunk.
  const levelRingRef = useRef<HTMLDivElement | null>(null);

  const flushBuffer = useCallback(() => {
    const { speaker, text } = bufferRef.current;
    if (speaker && text.trim()) {
      setLines((prev) => [...prev, { speaker, text: text.trim() }]);
    }
    bufferRef.current = { speaker: null, text: "" };
  }, []);

  const pushTranscriptText = useCallback(
    (speaker: "user" | "ai", text: string, finished?: boolean) => {
      if (bufferRef.current.speaker && bufferRef.current.speaker !== speaker) flushBuffer();
      bufferRef.current.speaker = speaker;
      bufferRef.current.text += text;
      if (finished) flushBuffer();
    },
    [flushBuffer]
  );

  const startingIndex = Math.max(
    0,
    LIVE_MODEL_FALLBACK_CHAIN.findIndex((m) => m.id === preferredModel)
  );

  const cleanupConnection = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    try {
      sessionRef.current?.close();
    } catch {
      // ignore
    }
    sessionRef.current = null;
    setAiSpeaking(false);
    setMuted(false);
  }, []);

  // Held in a ref (rather than referencing `connectWithModel` by name) so the fallback chain
  // can recurse into "try the next model" without a self-referential useCallback.
  const connectWithModelRef = useRef<(index: number) => Promise<void>>(async () => {});

  const connectWithModel = useCallback(
    async (index: number) => {
      if (index >= LIVE_MODEL_FALLBACK_CHAIN.length) {
        setStatus("failed");
        return;
      }
      const model = LIVE_MODEL_FALLBACK_CHAIN[index];
      setStatus(index === 0 ? "connecting" : "reconnecting");

      const tokenRes = await fetch("/api/speaking/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          youtubeSessionId ? { youtubeSessionId, modelId: model.id } : { scenarioId: scenario.id, modelId: model.id }
        ),
      });

      if (!tokenRes.ok) {
        if (tokenRes.status === 412) {
          setStatus("no-key");
          return;
        }
        // Rate-limited or unavailable — fall back to the next model.
        connectWithModelRef.current(index + 1);
        return;
      }

      const { token } = await tokenRes.json();
      const client = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });

      try {
        const session = await client.live.connect({
          model: model.id,
          config: {
            responseModalities: [Modality.AUDIO],
            realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 500 } },
          },
          callbacks: {
            onopen: () => {
              modelUsedRef.current = model.id;
              setModelLabel(model.label);
              setStatus("live");
              if (!startTimeRef.current) startTimeRef.current = Date.now();

              const player = new AudioPlayer((playing) => setAiSpeaking(playing));
              playerRef.current = player;

              const mic = new MicStreamer();
              micRef.current = mic;
              mic.start(
                (base64Pcm) => {
                  try {
                    session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: "audio/pcm;rate=16000" } });
                  } catch {
                    // session may already be closing
                  }
                },
                (level) => {
                  const ring = levelRingRef.current;
                  if (!ring) return;
                  const clamped = Math.min(1, level * 4);
                  ring.style.transform = `scale(${1 + clamped * 0.6})`;
                  ring.style.opacity = `${0.25 + clamped * 0.5}`;
                }
              );
            },
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (!content) return;

              if (content.interrupted) playerRef.current?.clear();

              const audioData = message.data;
              if (audioData) playerRef.current?.enqueue(audioData);

              if (content.inputTranscription?.text) {
                pushTranscriptText("user", content.inputTranscription.text, content.inputTranscription.finished);
              }
              if (content.outputTranscription?.text) {
                pushTranscriptText("ai", content.outputTranscription.text, content.outputTranscription.finished);
              }
            },
            onerror: () => {
              if (endedByUserRef.current) return;
              // Whether this failed before or during the call, fall back to the next model
              // rather than leaving the user with a dead/stuck call (Section 2.2).
              cleanupConnection();
              connectWithModelRef.current(index + 1);
            },
            onclose: () => {
              if (endedByUserRef.current || status === "ended") return;
            },
          },
        });
        sessionRef.current = session;
      } catch {
        connectWithModelRef.current(index + 1);
      }
    },
    [cleanupConnection, pushTranscriptText, scenario.id, youtubeSessionId, status]
  );

  useEffect(() => {
    connectWithModelRef.current = connectWithModel;
  }, [connectWithModel]);

  const startCall = useCallback(() => {
    endedByUserRef.current = false;
    connectWithModelRef.current(startingIndex);
  }, [startingIndex]);

  useEffect(() => {
    if (status === "live" && !timerRef.current) {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    if (status !== "live" && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      micRef.current?.setMuted(next);
      return next;
    });
  }

  async function endCall() {
    endedByUserRef.current = true;
    flushBuffer();
    cleanupConnection();
    setStatus("ended");
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : elapsed;
    const transcriptText = lines
      .concat(bufferRef.current.speaker ? [{ speaker: bufferRef.current.speaker, text: bufferRef.current.text }] : [])
      .map((l) => `${l.speaker === "user" ? "User" : "AI"}: ${l.text}`)
      .join("\n");

    if (!transcriptText.trim()) {
      setFeedbackError("The call ended before any speech was captured, so no feedback could be generated.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/speaking/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(youtubeSessionId ? { youtubeSessionId } : { scenarioId: scenario.id }),
          transcript: transcriptText,
          durationSeconds: duration,
          modelUsed: modelUsedRef.current,
        }),
      });
      const data = await res.json();
      if (data.feedback) {
        setFeedback(data.feedback);
      } else if (data.error === "NO_API_KEY") {
        setFeedbackError("Add your Gemini API key in Settings to get feedback on past sessions.");
      } else if (data.error) {
        setFeedbackError("We saved your session, but couldn't generate feedback right now.");
      }
    } catch {
      setFeedbackError("We saved your session, but couldn't generate feedback right now.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "no-key") {
    return (
      <FullScreenMessage title="Add your API key first">
        <p className="text-sm text-muted">
          You need a Gemini API key on file before starting a live call.
        </p>
        <Link href="/settings" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          Go to Settings
        </Link>
        <Link href={backHref} className="text-sm text-muted underline">
          {backLabel}
        </Link>
      </FullScreenMessage>
    );
  }

  if (status === "failed") {
    return (
      <FullScreenMessage title="Couldn't connect">
        <p className="text-sm text-muted">
          We tried all available voice models but couldn&apos;t start the call. This usually means your API key is
          invalid or every model is currently rate-limited. Please try again in a moment.
        </p>
        <button
          onClick={startCall}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Try again
        </button>
        <Link href={backHref} className="text-sm text-muted underline">
          {backLabel}
        </Link>
      </FullScreenMessage>
    );
  }

  if (status === "ended") {
    return (
      <FullScreenMessage title="Session complete">
        <p className="text-sm text-muted">{scenario.name} · {Math.round(elapsed / 60) || 1} min</p>
        {saving && <p className="text-sm text-muted">Generating feedback…</p>}
        {feedbackError && <p className="text-sm text-danger">{feedbackError}</p>}
        {feedback && <FeedbackCard feedback={feedback} />}
        <button
          onClick={() => router.push(backHref)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          {backLabel}
        </button>
      </FullScreenMessage>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0f19] text-white">
      <div className="flex items-center justify-between px-4 pt-6">
        <Link href={backHref} className="text-sm text-white/60">
          ← Cancel
        </Link>
        <span className="text-xs uppercase tracking-wide text-white/40">{scenario.difficulty}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">{scenario.name}</h1>
        {status !== "idle" && (
          <CallOrb
            aiSpeaking={aiSpeaking}
            muted={muted}
            connecting={status === "connecting" || status === "reconnecting"}
            levelRingRef={levelRingRef}
          />
        )}
        <StatusBadge status={status} modelLabel={modelLabel} aiSpeaking={aiSpeaking} muted={muted} />
        {status === "live" && <p className="font-mono text-3xl tabular-nums">{formatTime(elapsed)}</p>}
      </div>

      <div className="mx-4 mb-4 max-h-40 overflow-y-auto rounded-xl bg-white/5 p-3">
        {lines.length === 0 ? (
          <p className="text-center text-sm text-white/40">Transcript will appear here as you speak.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {lines.slice(-8).map((l, i) => (
              <li key={i} className={l.speaker === "user" ? "text-white" : "text-white/60"}>
                <span className="font-medium">{l.speaker === "user" ? "You: " : "AI: "}</span>
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 px-6 pb-10">
        {status === "idle" ? (
          <button
            onClick={startCall}
            className="w-full rounded-2xl bg-accent py-4 text-base font-semibold text-accent-foreground"
          >
            Start Call
          </button>
        ) : (
          <>
            {status === "live" && (
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                aria-pressed={muted}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${
                  muted ? "border-white/40 bg-white/15" : "border-white/20"
                }`}
              >
                {muted ? <MicOffIcon /> : <MicIcon />}
              </button>
            )}
            <button
              onClick={endCall}
              disabled={status === "connecting" || status === "reconnecting"}
              className="flex-1 rounded-2xl bg-danger py-4 text-base font-semibold text-white disabled:opacity-50"
            >
              End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  modelLabel,
  aiSpeaking,
  muted,
}: {
  status: Status;
  modelLabel: string | null;
  aiSpeaking: boolean;
  muted: boolean;
}) {
  if (status === "connecting") return <p className="text-sm text-white/60">Connecting…</p>;
  if (status === "reconnecting") return <p className="text-sm text-white/60">Reconnecting…</p>;
  if (status !== "live") return <p className="text-sm text-white/60">Ready</p>;

  const text = muted ? "Muted" : aiSpeaking ? "AI is speaking" : "Listening…";
  const color = muted ? "text-white/40" : aiSpeaking ? "text-emerald-400" : "text-accent";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className={`text-sm font-medium ${color}`}>{text}</p>
      {modelLabel && <p className="text-xs text-white/30">{modelLabel}</p>}
    </div>
  );
}

/**
 * Visual center of the call screen: a ring that scales with live mic amplitude while the user
 * is expected to talk, a pulsing green ring while the model is speaking, and a static muted
 * state. Replaces the old static "Live" badge, which gave no indication anything was happening
 * turn-to-turn — the actual UX complaint behind the reported "too much delay."
 */
function CallOrb({
  aiSpeaking,
  muted,
  connecting,
  levelRingRef,
}: {
  aiSpeaking: boolean;
  muted: boolean;
  connecting: boolean;
  levelRingRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      {connecting && <div className="absolute inset-0 animate-ping rounded-full bg-white/10" />}
      {aiSpeaking && (
        <>
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/25" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-emerald-400/15" />
        </>
      )}
      {!connecting && !aiSpeaking && !muted && (
        <div
          ref={levelRingRef}
          className="absolute inset-0 rounded-full bg-accent/25"
          style={{ transform: "scale(1)", opacity: 0.25, transition: "transform 60ms linear, opacity 60ms linear" }}
        />
      )}
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
          muted ? "bg-white/15" : aiSpeaking ? "bg-emerald-500" : "bg-accent"
        }`}
      >
        {muted ? <MicOffIcon /> : aiSpeaking ? <SpeakerWaveIcon /> : <MicIcon />}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
      <path d="M3 3l18 18" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerWaveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M4 10v4h3l4 4V6l-4 4H4z" strokeLinejoin="round" />
      <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" strokeLinecap="round" />
    </svg>
  );
}

function FullScreenMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
