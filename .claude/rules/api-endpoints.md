---
paths:
  - "api/*.ts"
  - "dev-server.js"
  - "lib/server-utils.ts"
  - "vercel.json"
---

# Serverless API endpoints (`api/*.ts`)

The Vercel functions in `api/` proxy paid services (Azure TTS, Google STT) and store bug reports.
Treat them as a trust boundary. Shared helpers live in `lib/server-utils.ts`.

## Mandatory for every endpoint

- Route through `lib/server-utils.ts`: `applyCors` + `isAllowedOrigin` (origin allow-list =
  localhost or the request's **own host** — there is **no** blanket `*.vercel.app` allow),
  `rateLimit` (in-memory per-IP guard; state resets on a cold start — it's a billing guard, not a
  wall), and `logServerError`.
- **Never leak internals**: 500s return a generic message only. Full detail (message/stack) goes to
  `logServerError` — never in the client response body (no `details: error.message`).
- **CORS lives in the functions, not `vercel.json`.** The blanket `Access-Control-Allow-Origin: *`
  was removed; `applyCors` sets a scoped origin. Don't reintroduce a `/api` header block.

## Two sources that MUST stay in sync

Each `api/*.ts` is mirrored in `dev-server.js` (Express, port 3001) for local dev. Change one →
change both, or dev and prod drift. `dev-server.js` reads a bit looser (e.g. bug-report GET is open
unless `BUG_REPORT_READ_KEY` is set locally; prod is fail-closed).

## Per-endpoint specifics

- `bug-report` GET is **fail-closed** on `BUG_REPORT_READ_KEY` (prod: 403 until the env is set,
  since reports contain child screenshots; then every GET needs `&key=`).
- `stt` sets `features.profanityFilter` on the recognizer + caps the base64 audio size.

## Verify locally

Curl `http://127.0.0.1:3001` with/without an `Origin` header, an oversized body, and `&key=`. To
test without disturbing a running dev-server, launch a throwaway instance on another port:
`PORT=3009 node dev-server.js`.
