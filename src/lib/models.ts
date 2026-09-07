// Central place for Gemini model IDs so the fallback chain (Section 2.2 / Module 8 of the
// implementation plan) can be updated without touching call sites. Model availability and IDs
// change over time — verify against https://ai.google.dev/gemini-api/docs/models before relying
// on this in production.
export type LiveModelOption = {
  id: string;
  label: string;
  approxTpm: string;
};

export const LIVE_MODEL_FALLBACK_CHAIN: LiveModelOption[] = [
  { id: "gemini-2.5-flash-native-audio-preview-09-2025", label: "Gemini 2.5 Flash Native Audio Dialog", approxTpm: "1M TPM" },
  { id: "gemini-live-2.5-flash-preview", label: "Gemini 3 Flash Live", approxTpm: "65K TPM" },
  { id: "gemini-2.0-flash-live-001", label: "Gemini 3.5 Live Translate", approxTpm: "20K TPM" },
];

export const DEFAULT_LIVE_MODEL_ID = LIVE_MODEL_FALLBACK_CHAIN[0].id;

/**
 * Text models used for prompt generation, feedback, and reviews (Writing, Listening, and
 * Speaking's after-call feedback) — tried in order, falling back on rate limits (429), a
 * retired/unavailable model (404), or a server error/overload (500/503, see
 * generateTextWithFallback in gemini.ts), same pattern as the Live fallback chain above.
 * All three were verified against the real API on 2026-09-07:
 * - gemini-2.5-flash was retired for new users; Google's own 404 pointed at gemini-3.6-flash.
 * - gemini-3.5-flash-lite is a distinct model/tier (separate quota) as a genuine second option.
 * - gemini-flash-latest is Google's rolling alias, kept as a last resort so this list doesn't
 *   need updating every time a model is deprecated.
 */
export const TEXT_MODEL_FALLBACK_CHAIN: string[] = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];

export const TEXT_MODEL_ID = TEXT_MODEL_FALLBACK_CHAIN[0];
