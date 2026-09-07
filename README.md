# Communication Coach — Phases 1–9

Personal Communication & English Coach: a mobile-first Next.js app with live AI voice practice,
backed by MySQL and the Gemini API. Covers Phases 1–9 of the implementation plan: project skeleton,
full DB schema, Auth/Admin foundation, mobile nav shell, the Speaking, Writing, Listening, Vocabulary
Bank, and Grammar Tracker modules, the Level Estimator + Progress Dashboard, the Client Communication
Track, a reliability/QA pass across all of it, and YouTube Context Learning.

## What's built

- **Auth & Admin** — login, JWT session cookie, admin/user roles, User Management (create/deactivate),
  read-only admin profile views.
- **Settings** — per-user Gemini API key, AES-256-GCM encrypted at rest, decrypted only in-memory on
  the server at the moment of a Gemini call. Preferred Live model selection.
- **Speaking Practice** — 8 scenarios (casual, 4 client-call variants, difficult conversation,
  interview, custom), live voice call via the Gemini Live API using per-user ephemeral tokens (your
  real API key is never sent to the browser), real-time transcript capture, automatic fallback across
  3 models on rate limits, after-call AI feedback (fluency, grammar, vocabulary, corrected examples,
  score).
- **Writing Practice** — 6 categories (journal, professional email, opinion/essay, summary, client
  message, free write), AI-generated prompts, structured feedback (grammar corrections with
  explanations, tone check, sentence/vocabulary suggestions, clarity score, rewritten "professional
  version").
- **Listening Practice** — AI-generated dialogues/news-summaries/monologues on any topic you type,
  played aloud via the browser's built-in text-to-speech, one-at-a-time multiple-choice comprehension
  check, AI review of what was misunderstood, new vocabulary auto-added to the Vocabulary Bank table,
  plus an optional shadowing mode (play a line, repeat it, compare against what speech recognition
  heard — a wording check, not real pronunciation analysis).
- **Vocabulary Bank** — auto-collected from Speaking, Writing, and Listening feedback (each module's
  Gemini call now also extracts useful/advanced words), plus manual add. Spaced repetition via a simple
  Leitner-style scheduler (6 levels, 1–30 day intervals: a correct review moves a word up a level and
  further out; a miss drops it back to daily review). Daily review queue (up to 10 words), flashcard
  swipe interface.
- **Grammar Tracker** — every Speaking and Writing feedback call now also classifies each mistake by
  error type (tense, articles, prepositions, etc.), logged per session. A tracker page aggregates these
  into recurring patterns sorted by frequency, with an on-demand AI-generated micro-lesson (explanation
  + practice items) targeting each weak point.
- **Level Estimator + Progress Dashboard** — every Speaking/Writing/Listening feedback call now also
  estimates a per-skill proficiency level (Beginner → Intermediate → Advanced → Professional). A
  `/progress` page shows this as mobile-first swipeable cards (current level + trend per skill, streak,
  practice-time totals), plus an on-demand AI weekly summary (biggest improvement, ongoing weak point,
  focus for next week) drawn from that week's real level/score/grammar-error data. Same shape is
  available read-only per user from the admin User Management screen.
- **Client Communication Track** — built on top of Speaking and Writing rather than as a separate
  module, per the plan: 4 client-call scenarios (handling objections, delivering bad news, negotiating,
  status updates) and a "client" Writing category that cycles through emails/proposals/follow-ups. Both
  modules' Gemini feedback calls detect the client context and shift their tone/structure/persuasiveness
  emphasis toward professional business communication instead of general fluency notes — verified live:
  a deliberately casual client email ("hey! so the launch went great lol...") got called out specifically
  for slang and unassertive phrasing, with a genuinely professional rewrite. A `/client-track` page
  brings the scenario picker and combined Speaking+Writing history into one place.
- **YouTube Context Learning** — paste a YouTube URL and its transcript to start a live voice
  discussion about that video: Gemini asks comprehension questions, challenges you to summarize
  sections, and corrects misunderstandings, using the transcript as context (via the same ephemeral
  Live-token mechanism as Speaking, not a separate call type). **Automatic caption fetching doesn't
  work** — verified this directly: YouTube now blocks server-side scraping of captions (tested watch-page
  HTML scraping and several InnerTube API client spoofs; all blocked or return decoy data), so you paste
  the transcript yourself (from YouTube's own "Show transcript" feature) — the video title is still
  fetched automatically via YouTube's official oEmbed endpoint. After-call feedback is tuned toward
  comprehension of the video's content, not just general fluency — verified live: a vague summary of a
  video's content was correctly flagged as accurate-but-grammatically-weak with specific corrections.
  A `/youtube` page handles adding videos and revisiting past ones.
- **Unified dashboard** — recent activity across all three practice modules in one feed, a streak/time
  teaser linking to Progress, plus quick links to every module.
- **Mobile-first shell** — collapsible sidebar (hidden by default, overlay + backdrop), full-screen
  call UI with the sidebar bypassed entirely.
- **Full DB schema** for all 10 modules from the plan (Section 3), so later phases need no migrations.

Not built yet: the Hostinger migration (Phase 10) — needs live Hostinger credentials to execute.

## Setup

Prerequisites: Node.js, a local MySQL server running.

```bash
npm install
npm run db:init   # creates the database, applies schema.sql, seeds scenarios + an admin account
npm run dev
```

Connection settings live in `.env.local` (already created for this machine, pointed at
`root`/`root`@`localhost:3306`, database `voice_eng`). `.env.example` documents the shape for another
machine.

The first admin login is printed by `db:init` — by default:

- Email: `admin@local.test`
- Password: `ChangeMe123!`

Change that password by creating a new admin manually in MySQL, or by extending the admin UI later —
there's no self-service password change yet.

## Using it

1. Log in as the seeded admin.
2. **User Management** → create a real user account for yourself (or use the admin account directly).
3. **Settings** → paste a real Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey)).
   This is what unlocks every AI-powered module.
4. **Speaking Practice** → pick a scenario → **Start Call**. Allow microphone access when the browser
   prompts. Speak naturally; the AI partner responds with voice. **End Call** saves the transcript and
   generates feedback.
5. **Writing Practice** → pick a category (or free-write) → write → **Submit** for feedback.
6. **Listening Practice** → type a topic → **Generate** → **Play** to hear it (browser TTS) → answer the
   comprehension questions → **Submit** for a score and review. Shadowing mode needs Chrome or Edge
   (uses `SpeechRecognition`, which Firefox/Safari don't support).
7. **Vocabulary Bank** → words show up automatically as you use the other modules; **Start review** when
   words are due, or add your own anytime.
8. **Grammar Tracker** → recurring mistakes appear automatically; tap **Get a micro-lesson** on any
   pattern for a targeted explanation and practice items.
9. **Progress** → swipe through your per-skill level cards and overview (streak, practice time); tap
   **Generate** under Weekly summary for an AI recap of the last 7 days.
10. **Client Track** → one place for all 4 client-call scenarios and the client Writing category, plus
    their combined history. Feedback here is tuned for business tone/structure rather than general
    fluency.
11. **YouTube Learning** → paste a video URL, then paste its transcript (see the in-app instructions
    for getting it from YouTube's "Show transcript" feature) → **Add video & start discussion** jumps
    straight into a live call about it.

## Notes on the Live API integration

- Ephemeral tokens (`src/lib/gemini.ts` → `createEphemeralLiveToken`) are minted server-side per call,
  scoped to one scenario's system prompt and single-use, so the browser never sees your real API key —
  only a short-lived token.
- Audio capture/playback (`src/lib/audio/`) uses raw PCM16 at 16kHz in / 24kHz out per the Live API spec,
  via `ScriptProcessorNode` (deprecated but dependency-free — no separate AudioWorklet file needed).
- The model IDs in `src/lib/models.ts` are best-effort and Gemini's lineup moves fast. If any Gemini call
  fails with a "model not found"/"no longer available" error, the error message usually names the exact
  replacement — update that one file.
- If every model in the Speaking fallback chain fails (bad key, all rate-limited), the call screen shows
  a clear "Couldn't connect" message with a retry button rather than freezing.

## Reliability: automatic model fallback

Both the Live voice models (Speaking) and the text model (Writing, Listening, and Speaking's after-call
feedback) have their own fallback chain in `src/lib/models.ts`, and both were verified against the real
API, not just written to spec:

- **Live models** (`LIVE_MODEL_FALLBACK_CHAIN`): handled client-side in `LiveCallClient.tsx` — on a
  failed connection it mints a token for the next model and retries, up to 3 models.
- **Text models** (`TEXT_MODEL_FALLBACK_CHAIN`): handled server-side by `generateTextWithFallback()` in
  `src/lib/gemini.ts`, used by every Writing/Listening/Speaking-feedback call. It retries on 429 (rate
  limit), 404 (retired/unavailable model), 500, and 503 (server overload — confirmed to happen in
  practice under real load, not just a hypothetical) — and fails fast on 400/401/403 since a bad API key
  fails identically on every model. Each attempt logs a `console.warn` naming the model and status, so a
  slow response in the dev console (occasionally 30–50s if multiple models are under load) is visible as
  a real retry sequence, not a hang.

Trade-off worth knowing: falling through 2-3 models sequentially when the API is under broad load can
take tens of seconds before either succeeding or giving up. The UI already covers this with a loading
state ("Generating…"), so it reads as "slow" rather than "broken," but it's not instant.

## Project structure

```
db/schema.sql              full MySQL schema (all 10 modules' tables)
scripts/init-db.mjs        creates DB, applies schema, seeds scenarios + admin
src/lib/db.ts              mysql2 pool
src/lib/auth.ts            JWT session + password hashing
src/lib/crypto.ts          AES-256-GCM for the per-user API key
src/lib/gemini.ts          ephemeral token minting + speaking feedback (server-only)
src/lib/writing.ts         writing prompt + feedback generation (server-only)
src/lib/listening.ts       listening content + review generation (server-only)
src/lib/grammar.ts         micro-lesson generation (server-only)
src/lib/weekly-summary.ts  weekly progress summary generation (server-only)
src/lib/progress.ts        level/streak/practice-time queries (server-only)
src/lib/tracking.ts        shared grammar-error/vocabulary/level/activity insert helpers
src/lib/youtube.ts         video ID parsing + oEmbed title lookup (server-only)
src/lib/models.ts          Gemini model IDs (Live fallback chain + text model)
src/lib/constants.ts       client-safe category/difficulty lists
src/lib/speech.ts          browser TTS/STT wrappers (Listening playback + shadowing)
src/lib/audio/             mic capture + playback (PCM16 <-> Gemini Live, Speaking + YouTube)
src/middleware.ts          route protection (session + admin-only routes)
src/app/(app)/             authenticated pages behind the sidebar shell
src/app/speaking/call/     full-screen live call page (no sidebar)
src/app/youtube/call/      full-screen YouTube-context call page (no sidebar)
src/app/api/               route handlers
```

## Phase 8: reliability/QA pass

Per the plan's QA/Integration role ("confirms all modules share the same DB schema, user_id scoping,
and API conventions"), audited every route rather than skipping to the next feature:

- **Fixed one real gap**: `POST /api/vocabulary/[id]/review`'s `UPDATE` wasn't scoped by `user_id` —
  safe in practice only because the preceding `SELECT` already gated it, but fragile. Now scoped like
  every other mutation.
- **Verified no IDOR exists**, empirically, not just by reading the code: created a second real user
  account and confirmed it gets 404s (not data) when requesting another user's writing entries,
  listening exercises, and speaking sessions by ID, that deleting another user's vocabulary word is a
  silent no-op (confirmed the row survives), and that admin routes/pages 403/redirect for non-admins.
- **Confirmed every mutating API route requires auth** (grepped for `requireSession`/`requireAdmin`
  across all 23 route files) and every page sits under the `(app)` layout's own session check —
  triple-layered with middleware and the API routes themselves.
- **Verified the full Live model fallback chain**, not just the primary model: all 3 models
  (`LIVE_MODEL_FALLBACK_CHAIN`) successfully mint ephemeral tokens against the real API.
- **Confirmed consistent daily-activity recording**: all three practice modules log practice time
  before attempting Gemini feedback, so a rate-limited/failed feedback call never silently drops a
  streak day.

## Phase 9: YouTube Context Learning — a scope change worth knowing

The plan specified automatic caption extraction ("not audio re-transcription, to keep this simple and
within YouTube's terms"). Verified directly that this is no longer viable server-side: YouTube's
watch-page HTML no longer returns usable caption URLs to non-browser requests (returns 200 with an
empty body, or a decoy `captionTracks` array), and InnerTube API client-spoofing (ANDROID, WEB, MWEB,
IOS, TVHTML5) is likewise blocked or rejected. The only remaining reliable options were: (a) shell out
to `yt-dlp`, adding Python as a hard runtime dependency of uncertain Hostinger compatibility, or (b)
have the user paste the transcript themselves. Went with (b), per direction — zero new dependencies,
deploys anywhere, and the module still does everything else the plan describes once it has the text.
The video title is still fetched automatically via YouTube's official, documented oEmbed endpoint.

## Next steps (per the plan's execution order)

Phase 10: export local MySQL data, provision a MySQL database on Hostinger, deploy the app there,
re-verify end-to-end. This needs live Hostinger credentials from you to execute.
