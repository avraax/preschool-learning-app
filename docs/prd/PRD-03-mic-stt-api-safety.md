# PRD-03 — Mic safety, STT content filter & API hardening

**Priority:** P1 (privacy + child-safety + billing exposure)
**Scope:** Small–Medium
**Depends on:** none

---

## Context

- **Sig et Ord** (`/ordleg/mic`, `src/components/ordleg/SpeakWordGame.tsx`) is an open-ended mic game:
  the child says any word → captured via `src/hooks/useSpeechInput.ts` (MediaRecorder →
  `POST /api/stt`, Google Speech-to-Text v2) → the app spells the recognized word back. No grading.
- Server functions live in `api/` (Vercel) and are mirrored for local dev in `dev-server.js`
  (port 3001). Shared helpers: `lib/server-utils.ts` (`isAllowedOrigin`, `applyCors`,
  `logServerError`). Endpoints: `api/tts-azure.ts`, `api/stt.ts`, `api/bug-report.ts`
  (writes to Vercel Blob), `api/log-error.ts`, `api/version.ts`.
- Bug reports are triggered from the "Til de voksne" adult menu; a screenshot + diagnostics JSON are
  uploaded to Vercel Blob under `bug-reports/<date>/<ID>/` and identified by a short code.

## Problems (with evidence)

### P1 — The microphone can stay live after leaving the game *(highest priority)*

`useSpeechInput.ts` `start()` (~lines 56–83) has no cancellation token. If the component unmounts
while `getUserMedia` is still pending (child taps the mic, then hits Back — very plausible on the first
use while the OS permission prompt is up), the unmount cleanup in `SpeakWordGame.tsx` (~lines 289–297)
calls `speech.cancel()` **before the stream exists**; `start()` then resolves, assigns
`streamRef.current`, and calls `recorder.start()` — and nothing ever stops it. The microphone records
indefinitely (the browser/iOS mic indicator stays on) until the tab closes.

### P2 — No profanity filter on STT; the app spells back anything verbatim

`api/stt.ts` (~lines 79–86) and its `dev-server.js` mirror build the recognition `config` with only
`autoDecodingConfig`, `languageCodes`, `model` — **no `features.profanityFilter`**. Sig et Ord then
shows the recognized word in giant letters and speaks + spells it out letter-by-letter
(`SpeakWordGame.tsx` ~441–473). An older sibling shouting a profanity gets it celebrated and spelled
aloud. Google STT v2 masks with the filter on.

### P3 — Endpoints are effectively open; bug-report reads are public

- `isAllowedOrigin` (`lib/server-utils.ts` ~9–21) **allows requests with no Origin header** (any
  curl/script) and **any `*.vercel.app` origin** (anyone can deploy there). No rate limiting; no
  payload cap in `api/stt.ts` beyond the platform default. Result: unauthenticated proxies to paid
  Google STT and Azure TTS.
- `api/bug-report.ts` writes blobs `access: 'public'` and the **GET (list + fetch) is open by
  default** — `BUG_REPORT_READ_KEY` is *optional* and GET doesn't even call `isAllowedOrigin`. Anyone
  can enumerate every report and download **screenshots of a child's screen**, device fingerprint,
  timezone, progress, route history, and console rings.
- `vercel.json` sets a blanket `Access-Control-Allow-Origin: *` on `/api/(.*)`, contradicting the
  scoped CORS in `applyCors`.
- `api/stt.ts` (~97–101) returns internal `error.message` to the client as `details` (info leak).

## Goals / Non-goals

**Goals:** mic guaranteed to stop when the game unmounts; profanity masked in the read-back; bug-report
reads gated; a basic abuse/billing guard on the paid endpoints; no internal error text leaked.

**Non-goals:** full auth system; changing the open-ended (no-grading) design of Sig et Ord.

## Implementation plan

1. **Mic cancellation token (P1).** In `useSpeechInput.ts`, add a generation counter (or
   `cancelled` ref) captured at the top of `start()`. After each `await` (`getUserMedia`, recorder
   setup), if the generation is stale, immediately stop all tracks (`stream.getTracks().forEach(t =>
   t.stop())`), don't start the recorder, and bail. `stop()`/`cancel()` must bump the generation so an
   in-flight `start()` self-aborts. Ensure `SpeakWordGame`'s unmount path bumps it.

2. **Profanity filter (P2).** In `api/stt.ts` and the `dev-server.js` mirror, add
   `features: { profanityFilter: true }` to the recognition config. (Masked words come back like
   `f****`; the existing `extractFirstWord` will then drop/soften them.)

3. **Gate bug-report reads (P3, do the zero-code part first).** Set `BUG_REPORT_READ_KEY` in the
   Vercel project env **today**. Then in code: make GET require the key (return 401 without it), have
   GET call `isAllowedOrigin`, and prefer `access: 'private'` blobs with a short-lived
   signed/ proxied URL for the screenshot instead of a public URL. (If private blobs are too invasive
   now, at minimum require the read key.)

4. **Tighten origins & error surface (P3).** Remove the blanket `Access-Control-Allow-Origin: *` from
   `vercel.json` (the functions already set scoped CORS via `applyCors`). Decide the no-Origin policy —
   for a browser-only app, reject requests with neither an allowed Origin nor a same-site referer.
   Drop `details: error.message` from client responses (keep it in `logServerError`).

5. **Cheap billing guard.** Add an explicit base64/body size cap to `api/stt.ts` (e.g. ~1.5MB, matching
   the ≤5s clip design) and a trivial per-IP token-bucket / fixed-window limiter on `tts-azure`, `stt`,
   and `bug-report` (in-memory is fine given Fluid Compute instance reuse; it's a guard, not a wall).

## Acceptance criteria

- [ ] Starting the mic and immediately navigating away stops the OS mic indicator within ~1s (no
      indefinite recording). Verify on a real device or via the browser mic indicator.
- [ ] A recognized profanity comes back masked and is not spelled aloud in the clear.
- [ ] `GET /api/bug-report?list=…` returns 401/403 without the read key once set.
- [ ] `curl` with no Origin to `/api/stt` and `/api/tts-azure` is rejected (or rate-limited), while the
      app itself still works from `localhost:5173` and the production origin.
- [ ] 500 responses no longer include internal `details` text.

## How to verify

- Mic: with the `ui-screenshot` harness (launch flags include fake media stream), start capture then
  navigate; assert no lingering `getUserMedia`/recording (add a temporary console log in the stale-guard
  path and confirm it fires). Best final check is a real iPad — watch the orange mic dot.
- STT/API: `curl` the local dev endpoints (base `http://127.0.0.1:3001`) with and without an Origin
  header and with an oversized body; confirm the new limits.
- Bug-report: `curl "http://127.0.0.1:3001/api/bug-report?list=10"` with/without `&key=`.

## Risks / notes

- Keep the local dev flow working — `dev-server.js` mirrors these endpoints into a gitignored
  `.bug-reports/` folder; don't break offline bug reporting.
- The Danish STT recognizer config (`da-DK`, `short` model, `eu` endpoint) should be unchanged apart
  from the added `features`.
- Rate-limit state resets on cold starts — that's acceptable for a billing guard.
