# PRD — Accounts, Login, Child Profiles & Progress Sync

> **Kickoff prompt for the implementation session**
>
> Implement `plans/accounts/tmp-prd-accounts-01-auth-profiles-sync.md` in full — accounts (Google OIDC + passkey), a
> 4-digit PIN replacing AdultGate, child profiles, and local-first progress sync — following its work packages W0–W11
> in order and committing at each boundary.
> Do not bump `progressStore`'s `SCHEMA_VERSION` until the v3→v4 migration test is green, and verify the finished build
> on the iPadOS 17.7 iPad both in Safari and as an installed PWA.

Authored 2026-07-31. Status: **authored, not implemented.**

## 0. Setup state as of 2026-07-31 — read this before starting W0

**Already done — do not redo:**

- **9 env vars are set in Vercel** across production / preview / development, and mirrored into
  `.env.local` (the pre-existing Azure + Google-STT + bug-report keys there were appended to, not replaced):
  `BETTER_AUTH_SECRET`, `ACCESS_TOKEN_SECRET`, `PIN_PEPPER` (32 random bytes each, three distinct values),
  `BETTER_AUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `AUTH_ALLOWED_EMAILS`, plus `AUTH_DEV_BYPASS=1` in
  `.env.local` only.
- `BETTER_AUTH_URL` and `WEBAUTHN_RP_ID` are **deliberately unset on preview** (§4.9).
- `AUTH_ALLOWED_EMAILS` = **`allanvraa@gmail.com`** only. **Never add the owner's work email/domain to this
  project** (§4.10).
- CLI state: Vercel CLI 54.12.2 authenticated as `allanvraa-3250` (team `allan-brink-vraas-projects`), project
  linked. gcloud 572.0.0 authenticated as `allanvraa@gmail.com`, active project
  **`preschool-learning-app-466719`** — the same project as the existing STT credentials, so the OAuth client
  belongs there.

- **Neon Postgres is provisioned and verified.** Free plan (`free_v3`), region **`eu-central-1` (Frankfurt)**,
  Neon's own auth product disabled (`-m auth=false` — we use better-auth). Connected to production / preview /
  development, and Vercel injected `DATABASE_URL` (pooled `-pooler` host) plus `DATABASE_URL_UNPOOLED` and the
  `POSTGRES_*` / `PG*` aliases. **Verified live:** authenticates as `neondb_owner` on PostgreSQL 17, and
  `create table` / `drop table` both succeed, so the schema migration will run. Resource
  `rough-silence-90309729`, installation `icfg_e15xIqlOp5bF9Ldl9A7rxsm8`.
  - **Gotcha for W1:** `node-postgres` now warns that `sslmode=require` (which is what Vercel's injected URL uses)
    is currently treated as `verify-full` but will adopt weaker libpq semantics in pg v9. Pin the intent
    explicitly — either `sslmode=verify-full` or `uselibpqcompat=true&sslmode=require` — rather than inheriting a
    behaviour change on a future dependency bump.
  - Never run a bare `vercel env pull`: it overwrites `.env.local`, and `GOOGLE_CLOUD_PRIVATE_KEY_BASE64`,
    `AZURE_SPEECH_REGION` and `BUG_REPORT_READ_KEY` exist **only** in that local file. Pull to a scratch path and
    copy across.

- **The Google OAuth Web client is created and verified.** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set in
  Vercel across all three environments and in `.env.local`, under Google Cloud project
  `preschool-learning-app-466719`. **Verified live** by exchanging a deliberately malformed code at
  `https://oauth2.googleapis.com/token`: the response is `invalid_grant` ("Malformed auth code"), **not**
  `invalid_client` or `redirect_uri_mismatch` — which proves the client id/secret authenticate and that all four
  redirect URIs from §4.9 are registered. The consent screen is on **Testing** with `allanvraa@gmail.com` as a test
  user (deliberate — avoids app verification, and the 7-day-refresh-token caveat doesn't apply because the design
  uses `access_type=online` and only consumes a one-shot `id_token`).

**Setup is complete. There are no remaining owner blockers — W0 through W11 can all proceed.**

The only thing W0 still has to do is the `tsconfig.server.json` type-checking work; provisioning is finished. Note
that a **`vercel env pull` is now safe to run into a scratch path but never over `.env.local`**.

**What can start before those land:** all of **W2** (every pure module + its `node --test` suite —
`authGatePolicy`, `pinPolicy`, `redact`, `accessToken`, `pinHash`, `progressSchema`, `progressMerge`) needs zero
infrastructure and is the largest independently-testable chunk of the build. The `tsconfig.server.json` half of W0
also needs nothing. **W1 onward needs `DATABASE_URL`.**

---

## 1. Context — why this is being built

Børnelæring has **no identity of any kind**. One device = one anonymous profile, defined implicitly by a single
localStorage key (`bornelaering-progress`, schema v3). There is no user, profile, account, session, cookie, JWT or
database anywhere in the repo. What this fixes:

- **Progress is trapped on one device.** The son's 45-slot reward book lives in one browser's localStorage. A new
  iPad, a cleared cache, or Safari storage eviction loses it, and it cannot follow him to a phone.
- **The deployment is wide open.** `preschool-learning-app.vercel.app` is public and `/api/tts-azure` + `/api/stt`
  are unauthenticated proxies to **paid** Azure Speech and Google STT. Anyone with the URL can spend real money.
- **One child only.** A sibling or visiting friend would overwrite the existing book.
- **The adult area is only child-resistant.** `AdultGate` shows three Danish number-words (`fem · to · fire`); a wrong
  answer closes silently, there is no retry limit, and nothing remembers that an adult passed. It's a reading test.
- **Everything else is device-local too**: chosen theme, difficulty tuning, narration voice override.

Owner's framing: *"in general as much as possible to be attached to the profile and/or account which is now temporary,
sessionStorage, localStorage etc."*

**Intended outcome:** an adult signs in **once per device** and effectively never again; the child opens the app and
plays immediately, never seeing an auth screen; his book, bests, difficulty and world follow him across devices; a
4-digit PIN or Face ID guards the adult surfaces and profile switching.

---

## 2. Locked decisions

Confirmed with the owner during the planning session. **Do not re-litigate these.**

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Self-hosted identity: `better-auth` + Neon Postgres in the EU (Frankfurt)**, provisioned via the Vercel Marketplace. No Clerk/Auth0/Descope. | Child-adjacent data stays in the EU (Clerk is US-only residency). No per-MAU cost. Matches the repo's "own your endpoints" pattern. |
| **D2** | **Sign-in methods v1: Google OIDC (full-page redirect, authorization code + PKCE) and WebAuthn passkey (Face ID / Touch ID).** | Safari has **no FedCM and none planned**, so Google One Tap degrades to a popup that is unreliable in an installed PWA. Passkeys exist from iOS 16, so the 17.7 floor is fine. |
| **D3** | **Email OTP is designed but NOT shipped in v1.** | Since Feb 2024 Gmail/Yahoo/Outlook require SPF+DKIM domain authentication and no provider will authenticate a free Gmail address (Brevo silently rewrites the From). Without a custom domain, codes land in spam. Leave schema + endpoint room behind a flag. |
| **D4** | **4-digit PIN** which (a) **replaces** the Danish-number-word `AdultGate` for the adult corner menu, (b) re-unlocks a locked session, (c) guards switching child profile. `fem · to · fire` is **removed**, not kept. | One real secret instead of a reading test. Face ID is the fast path; PIN always works. |
| **D5** | **Hard gate.** Nothing works before sign-in; `/api/tts-azure` + `/api/stt` require a valid session. | Serves "keep strangers out" and protects paid credits. |
| **D6** | **Local-first sync.** localStorage stays the gameplay source of truth; the server holds a merged mirror. The app stays fully playable offline. | No regression in current offline / no-service-worker behaviour. |
| **D7** | **Multiple child profiles.** Per-child: reward book, XP/bloom, per-game bests, stars, difficulty, theme. Per-account: adult prefs, voice override, PIN, passkeys, profile list. Device-only: TTS cache, update-dismissed, chunk-reload guard, crash dedupe, session id. | Owner asked for "as much as possible" attached to profile/account; the device-only set is plumbing that would be wrong to sync. |
| **D8** | **Domain stays `preschool-learning-app.vercel.app`.** WebAuthn **RP ID is an env-var config constant** with a documented migration path. | Owner's call. Passkeys are bound to the hostname, so this is an explicitly accepted, documented risk. |
| **D9** | **GDPR policy work deferred.** Ship the technical basis: EU-region DB, no child name required, no analytics, working deletion. Privacy page, export, consent capture, retention come later. | Household + friends only today. |
| **D10** | **One PRD, one implementation session.** | Owner overrode a three-phase recommendation. Mitigated by ordered work packages — W0–W4 are independently shippable and the store surgery is gated behind a green migration test. |

---

## 3. Concepts

**"Paid endpoints"** — used throughout this PRD to mean the two API routes that cost real money per call:
`/api/tts-azure` (Azure AI Speech, billed per character synthesized) and `/api/stt` (Google Cloud Speech-to-Text,
billed per second of audio, used by "Sig et Ord"). The other three — `/api/bug-report`, `/api/log-error`,
`/api/version` — are free and are treated differently throughout. Today both metered routes are reachable by anyone
with the URL, guarded only by a per-IP rate limiter that resets on every cold start.

Then three deliberately distinct nouns:

- **Account** — an adult. Created by Google sign-in. Owns credentials (passkeys, PIN), the profile list, adult prefs.
  **The only thing that authenticates.**
- **Child profile** — a playable identity under an account: emoji avatar, optional first name, its own reward book,
  XP/bloom, bests, difficulty, theme. **Never authenticates.** Selected, not logged into.
- **Device** — a browser/PWA install. Holds the cached session, the active-profile pointer, a stable `deviceId`, and
  the device-only plumbing keys. Enrolled once, trusted until revoked.

The child never sees an auth screen. The adult signs in once per device; afterwards the app opens straight into the
active child profile.

---

## 4. Server architecture

### 4.1 New dependencies

`better-auth` (with its in-package `passkey` and `bearer` plugins), `pg` (Neon pooled connection), and `jose` for the
stateless access JWT. **`jose` must be installed explicitly** — it is currently in the lockfile only as a transitive
dep of `@vercel/oidc`. `vite.config.ts` `manualChunks` gains an `auth-vendor` bucket; **do not** co-bundle it with
`media-vendor`, which is deliberately howler-only because `sfxClient` loads it eagerly.

### 4.2 Database (Neon Postgres, `eu-central-1`)

better-auth generates and migrates `user`, `session`, `account`, `verification`, plus `passkey` from the passkey
plugin (`credentialID`, `publicKey`, `counter`, `deviceType`, `backedUp`, `transports`, `aaguid` — Apple reports an
**all-zero AAGUID** by design, so never branch on it). We add:

| Table | Columns of note |
|---|---|
| `child_profile` | `id`, `user_id`, `name` (optional first name only), `avatar_emoji`, `created_at`, `deleted_at` |
| `profile_progress` | `profile_id`, `doc jsonb` (the canonical v4 `PersistedProgress`), `rev bigint`, `epoch int`, `updated_at` |
| `family_pin` | `user_id` PK → `user.id` ON DELETE CASCADE, `hash text`, `updated_at` |
| `pin_attempt` | `user_id` PK, `failed_count int`, `last_failed_at`, `locked_until` |
| `oauth_flow` | `flow_id_hash` PK, `provider`, `state` UNIQUE, `code_verifier`, `session_token` NULL, `created_at`, `expires_at`, `claimed_at` NULL |

Generate the core tables with `npx @better-auth/cli generate --config lib/auth.ts` and apply the SQL in the Neon
console. Declaring our tables in the plugin's `schema` (§4.3) puts them in the same generated migration.

- `pin_attempt` lives in Postgres **specifically because** `lib/server-utils.ts`'s `rateLimit()` is a per-instance
  in-memory map that resets on cold start (§8.2).
- `family_pin.hash` = `scrypt$16384$8$1$<saltB64url>$<hashB64url>` over `HMAC-SHA256(PIN_PEPPER, pin)` — **pepper
  first, so a database dump alone cannot enumerate the 10 000 candidates**. Compare with `crypto.timingSafeEqual`.
  Use **N=16384** (16 MiB): N=32768 needs exactly Node's default 32 MiB `maxmem` and is borderline.
- `oauth_flow.flow_id_hash` = `sha256(flowId)` — the plaintext claim credential is never at rest server-side. `state`
  is a **separate** 32-byte random value, so the value Google echoes back is not the value the client claims with.
  Sweep `WHERE expires_at < now()` at the top of `oauth/start` (cheap; no cron needed).

Also add `"regions": ["fra1"]` to `vercel.json` so functions are co-located with Neon Frankfurt — otherwise every
auth call pays a transatlantic round trip.

### 4.2b better-auth configuration that matters

| Option | Value | Why |
|---|---|---|
| `session` | `expiresIn: 365d`, `updateAge: 7d`, `cookieCache: { enabled: false }` | A family tablet must not log out. Revocation is bounded by the 15-minute access JWT instead. |
| `rateLimit` | `{ enabled: true, storage: 'database', modelName: 'rateLimit', window: 600, max: 60, customRules: {…} }` | **This is the answer to "`rateLimit()` is per-instance in-memory"** — DB-backed and shared across instances. |
| `advanced` | `{ useSecureCookies: runtime() !== 'dev', defaultCookieAttributes: { sameSite: 'lax' } }` | Cookies still exist for the passkey challenge (§9). Safari won't store `Secure` cookies over `http://localhost`. |
| `emailAndPassword` | disabled | No passwords, by decision. |
| `socialProviders.google` | `{ clientId, clientSecret }` | Present **only** so `signInSocial({ idToken })` can verify the token. **We never call `/sign-in/social` from the browser** (§4.5). |
| `databaseHooks.user.create.before` | allowlist check → `throw new APIError('FORBIDDEN')` | §4.8 — mandatory. |
| `telemetry` | `{ enabled: false }` | — |

`customRules` (paths relative to `basePath`): `/family/oauth/start` 10/10 min · `/family/oauth/claim` 240/10 min
(polling: 3 s × 3 min) · `/family/pin/verify` 10/min (the IP layer; `pin_attempt` is authoritative) ·
`/family/access-token` 60/10 min.

### 4.3 Endpoint surface and mounting

The better-auth instance lives in **`lib/auth.ts`** so `api/` and `dev-server.js` import the same object. Our own
endpoints live in **`lib/auth-family-plugin.ts`** as a better-auth plugin (via `createAuthEndpoint`) rather than as
separate Vercel functions — that buys DB-backed rate limiting, session resolution, schema generation and **one** cold
start.

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/family/oauth/start` | none | `{ flowId }` → `{ authorizeUrl }` |
| `GET /api/auth/family/oauth/callback` | none | `?code&state` → an HTML terminal page |
| `POST /api/auth/family/oauth/claim` | none | `{ flowId }` → `{ token, user }` \| `{ status:'pending' }` \| 410 |
| `POST /api/auth/passkey/generate-*-options`, `verify-*` | mixed | better-auth passkey plugin |
| `GET /api/auth/get-session`, `POST /api/auth/sign-out` | bearer | — |
| `POST /api/auth/family/access-token` | bearer | → `{ token, expiresIn: 900 }` |
| `GET /api/auth/family/status` | bearer | → `{ hasPin, pinUpdatedAt, methods, passkeyCount }` |
| `POST /api/auth/family/pin/set` \| `/pin/verify` | bearer | PIN set / verify (§7.2) |
| `/api/profiles` | bearer | Child-profile CRUD |
| `/api/progress` | bearer | GET/PUT the canonical per-profile progress document (§6.4) |
| `POST /api/tts-azure`, `/api/stt` | **access JWT** | unchanged bodies; 401 `{ code:'need_access_token' }` |
| `/api/bug-report`, `/api/log-error`, `/api/version` | unchanged | `bug-report` stays open **deliberately** — a crash *before* sign-in is the report you most need. |

**Mounting on Vercel — use a Web-standard handler.** `@vercel/node@5.8.17` detects a `fetch` export and routes it
through `createWebHandler`, which builds the `Request` with `Readable.toWeb(req)` — i.e. **the raw unconsumed
stream**, so the body-parsing problem does not exist on Vercel:

```ts
// api/auth/[...all].ts
import { auth } from '../../lib/auth.ts'
export const fetch = async (request: Request): Promise<Response> => {
  try { return await auth.handler(request) }
  catch (e) { console.error('[auth] handler error', e)
    return new Response(JSON.stringify({ error: 'Auth error' }), { status: 500, headers: { 'content-type': 'application/json' } }) }
}
export const config = { runtime: 'nodejs', maxDuration: 15 }
```

The `try/catch` is required: the runtime's own catch is a bare **unlogged** 500. Do **not** wire `applyCors` /
`isAllowedOrigin` / `rateLimit` into this route — they are `VercelRequest`-shaped, and better-auth already owns origin
validation (`trustedOrigins`) and DB-backed rate limiting for these paths.

**Four mounting traps, each of which looks fine locally or fine in prod but not both:**

1. **`vercel.json` `functions` keys are globs**, so `api/auth/[...all].ts` parses `[...all]` as a character class
   matching one of `.al` and silently matches nothing — `maxDuration` never applies and you get a mystery 10 s timeout
   under a cold DB connection. Use **`"api/auth/**"`**.
2. **`toNodeHandler(auth)` must be mounted BEFORE `express.json()`** or the client hangs on "pending".
   `dev-server.js` currently `app.use`s `express.json({ limit: '5mb' })` at line ~18, above everything — **that line
   must move down.**
3. **Express 5 rejects bare wildcards.** `app.all('/api/auth/*', …)` throws a path-to-regexp "Missing parameter name"
   error (the repo is on 5.2.1). Use `app.all('/api/auth/*splat', …)`.
4. **New shared modules must use explicit `.ts` extensions in their own relative imports.** That is the only specifier
   form accepted by both Node 22.18 type-stripping (`dev-server.js` importing `./lib/auth.ts`) and Vercel's esbuild.
   Do **not** copy the existing `'../lib/server-utils.js'` style into new shared code — it resolves on Vercel but not
   in plain Node, which is exactly why `dev-server.js` currently hand-duplicates those helpers.

### 4.4 Session transport — bearer, not cookie

Use better-auth's **`bearer` plugin**: the session token arrives in the `set-auth-token` response header, is stored in
localStorage, and the client sends `Authorization: Bearer …`.

Three independent reasons, not one:

1. **An installed iOS PWA has its own storage jar**, separate from Safari, and out-of-scope OAuth navigation runs in an
   in-app browser view — so a `Set-Cookie` during that hop can land in the wrong context.
2. **With bearer transport an OAuth *redirect* has no response body the SPA can read**, so a redirect flow cannot
   deliver a token to localStorage by any means. A handoff artefact is therefore **structurally required**, not a hedge.
3. `@vercel/node`'s web-handler header writer loops `res.appendHeader(key, value)` over `response.headers`, so
   multi-`Set-Cookie` correctness depends entirely on undici's `set-cookie` iterator special case. Not depending on
   cookies removes that whole class of silent failure.

**Accepted trade-off:** a token in localStorage is more XSS-exposed than httpOnly (better-auth's own docs say so).
The app has no user-generated content, no third-party scripts and no analytics, and W11 adds a CSP. The
**access JWT is held in memory only** — one extra mint per reload, one fewer secret at rest.

### 4.5 Google sign-in — our own cookie-free PKCE leg

> **This section replaces the obvious design, which has a real hole. Read the two failure modes before implementing.**

**Failure mode 1 — better-auth's own social redirect cannot work here.** `account.storeStateStrategy` defaults to
`"database"` when a DB is configured, and the database strategy *still* **sets a signed state cookie when starting the
flow and validates the stored state against that cookie on the callback**. So the cookie we distrust is load-bearing
*before any session exists*: if the start request happens in the PWA context and the callback executes in the in-app
browser view, you get `state_mismatch` and never reach the point where a handoff code would help. (better-auth issues
#5871 and #7131 are this class.) The `"cookie"` strategy is worse. **So we do not call `/sign-in/social` from the
browser at all.**

**Failure mode 2 — a one-time code in the return URL is a session-theft hole in exactly the scenario being defended
against.** If the in-app browser view loads `/?code=…` and does *not* hand back to the app, the SPA boots **inside the
in-app browser** and consumes the code there: the token lands in the wrong localStorage, the adult stares at a lock
screen forever, and a live session token now sits in a context we don't control.

**The design that fixes both:** the claim credential is a `flowId` the app generates **in its own context before
navigating** and keeps in **its own** localStorage. The URL then carries no secret at all — only a "flow finished"
signal, in the **fragment** so it never reaches Vercel access logs or a `Referer` header.

1. Adult taps `Fortsæt med Google`. Client generates `flowId = base64url(32 random bytes)`, writes
   `localStorage['bl-oauth-flow'] = { flowId, startedAt }`, calls `registerSecret(flowId)`. **This write happening in
   the app's own storage context is the entire point.**
2. `POST /family/oauth/start { flowId }`. Server sweeps expired rows, generates `state` (32 B) and `code_verifier`,
   inserts `oauth_flow` keyed by `sha256(flowId)`, returns the Google `authorizeUrl` with
   `code_challenge_method=S256`, `redirect_uri=<baseURL>/api/auth/family/oauth/callback`, `scope=openid email profile`,
   `prompt=select_account`, `access_type=online`.
3. Client calls **`window.location.assign(authorizeUrl)`** — never `window.open`, which in standalone mode can escape
   to Safari and lose the return path (and this is popup-blocker-proof as a bonus). Navigation needs no user
   activation, so the preceding `await` is harmless. The lock screen switches to `Venter på Google…` with a
   `Prøv igen` button, and starts polling.
4. Google → `GET /family/oauth/callback?code&state`. Server looks up `state` (single-use, delete-on-read), exchanges
   the code at `https://oauth2.googleapis.com/token` with the `code_verifier`, then **in-process**:
   `await auth.api.signInSocial({ body: { provider: 'google', idToken: { token: id_token, accessToken } }, asResponse: true })`
   — the docs are explicit that **when an ID token is provided no redirection happens**. better-auth verifies it
   against the configured `clientId` and creates/links the user (blocked by the allowlist hook if not permitted). Read
   `set-auth-token` off the response and store it on the flow row with `expires_at = now + 5 min`.
5. Server returns a tiny HTML page: `<script>location.replace('/#bl_auth=1')</script>` plus a visible Danish
   `Tilbage til Børnelæring` button. **No secret in that HTML or URL.**
6. App claims: `POST /family/oauth/claim { flowId }` → `{ token, user }`; the row is deleted. Client stores the token,
   `registerSecret(token)`, clears `bl-oauth-flow`, sets `lastVerifiedAt`, pre-mints the access token, and
   `history.replaceState`s the fragment away.
   - **Fast path:** the fragment triggers an immediate claim on the app's next paint.
   - **Recovery path:** poll every 3 s for ≤3 min, **plus** on every `visibilitychange:visible`, **plus** on the next
     cold boot while a pending flow exists. This is what makes the flow survive iOS *not* handing control back — and
     it is the part that must not be trimmed as "belt and braces".
   - **Wrong-context path:** `#bl_auth=1` present but no local `flowId` ⇒ render `WrongContextNotice`
     (`Vend tilbage til Børnelæring-appen`). The in-app browser **cannot** steal the session because it has no `flowId`.

Two external facts this depends on; verify both on the first preview deploy before building UI on top:
`storeStateStrategy` does set a cookie (`curl -i -X POST /api/auth/sign-in/social` and look for `Set-Cookie`), and
`signInSocial({ idToken })` auto-creates the user and returns `set-auth-token`. If ID-token sign-in refuses to create
users, fall back to `internalAdapter.createUser` + `linkAccount` + `createSession` inside the plugin.

### 4.6 Gating the paid endpoints without a DB round-trip

`lib/access-token.ts` — the only auth code the paid endpoints import:

```ts
export interface AccessClaims { sub: string; sid: string; exp: number }
export async function signAccessToken(userId: string, sessionId: string): Promise<{ token: string; expiresIn: number }>
export async function verifyAccessToken(authorizationHeader: string | undefined): Promise<AccessClaims | null>
```

`jose` HS256 with **`ACCESS_TOKEN_SECRET`, deliberately separate from `BETTER_AUTH_SECRET`** — key separation, so a
leaked signing key can't forge sessions and vice versa. Claims `sub`, `sid`, `aud: 'bl-paid'`, `iss: baseURL()`,
`exp = iat + 900`. **No `nbf`, and never validate `iat`** — an old iPad's clock skew must not matter; verify with
`clockTolerance: 120`. `expiresIn` is returned as a **relative** number of seconds so the client never compares server
absolute time against its own clock. Returns `null` on every failure; never throws into the hot path.

*Why not better-auth's `jwt` plugin:* it issues asymmetric tokens verified against a JWKS endpoint, putting a network
fetch (or a JWKS cache) and a much larger dependency graph inside `tts-azure`. HS256 with a shared secret is a local
constant-time check and keeps the hot function's import graph at `jose` alone.

`lib/paid-guard.ts` → `requirePaidAccess(req, res)`. On failure it writes
`401 { error: 'Unauthorized', code: 'need_access_token' }` + `WWW-Authenticate: Bearer`. The distinct `code` is what
tells the client to mint-and-retry-once rather than log the adult out. Honours the dev bypass.

In `api/tts-azure.ts` and `api/stt.ts`, insert after `isAllowedOrigin`, before `rateLimit`:

```ts
const access = await requirePaidAccess(req, res)
if (!access) return
if (!rateLimit(req, res, { scope: 'tts', subject: access.sub, limit: 200, windowMs: 60_000 })) return
```

Adding an optional `subject` to `rateLimit` and keying on `sub` instead of IP is a real improvement: two iPads behind
one CGNAT no longer share a bucket, and the limit finally means something per account. Mirror in `dev-server.js`.

Note most narration is served from immutable static files under `/sounds/tts/`, which stay public and ungated; only
the live Azure fallback and STT are gated.

**Client side: do not monkey-patch `fetch`.** `diagnosticsBuffer` and `remoteConsole` already patch it and a third
layer makes the ordering unauditable. Add an explicit `authorizedFetch` and convert the five call sites:
`src/services/ttsClient.ts:269`, `src/hooks/useSpeechInput.ts:151`, `src/components/audit/AuditHarness.tsx:218`, and
`src/components/voicelab/VoiceLab.tsx:99` and `:170`. `boot()` should pre-mint the access token in parallel with
`validate()` so the token is warm before the child's first tap — otherwise the first narration eats an extra RTT.

### 4.7 Offline behaviour — and an honest correction

> **"The app must stay playable on a plane" is currently FALSE, independent of auth.** There is no service worker
> (`main.tsx` runs `sweepLegacyServiceWorkers()`, `vite.config.ts` has no `vite-plugin-pwa`), and `vercel.json` puts
> `no-store` on `/(.*)`, so `index.html` is uncacheable. **A cold standalone launch with no network already fails at
> the document fetch today.** The genuine offline cases are (a) the app already resident in memory, iOS resuming
> without a reload, and (b) flaky/roaming networks. A grace window cannot rescue a cold offline launch — only a
> service worker can, and that is a separate PRD. Do not let this build imply otherwise.

Consequences for the policy:

- The gate must **never block first paint** or require a fetch on resume. `authStore.boot()` hydrates localStorage
  synchronously and renders **optimistically** (`serverVerdict: 'unknown'` + a stored token ⇒ `authed`), then validates
  in the background. **No boot spinner** — the same discipline as `progressStore`'s synchronous hydration.
- **Grace is 30 days**, and it is *not* a security parameter: all paid capability is gated by a server-minted access
  JWT that cannot be minted offline, so letting the app keep *playing* offline costs zero credits. A tight grace only
  punishes the family. Strictness belongs on the token, not on playtime.
- `serverVerdict: 'unreachable'` + within grace ⇒ `offlineGrace`: full play, `canCallPaidApis: false`. Live Azure TTS
  degrades along the path that already exists (prebaked `/sounds/tts/*.mp3` → Web Speech), so most narration is
  unaffected; "Sig et Ord" shows `Kræver internet` (it already couldn't work offline).
- `serverVerdict: 'invalid'` (401/403) ⇒ `signedOut` **immediately, ignoring grace.** That is the revocation path and
  it must not be softened. A fetch failure is `unreachable`, **never** `invalid`.
- Recovery: both `online` and `visibilitychange:visible` trigger `validate()`, so the app self-heals the moment wi-fi
  returns, without a reload. Note **timers are throttled in a backgrounded PWA**, so refresh the access token on
  visibility change and lazily before use — not only on an interval. Same for the OAuth claim poll.

### 4.8 The allowlist is mandatory, not optional

**A hard gate without a closed signup list does not protect the credits.** Nothing else in this design stops a
stranger from completing Google sign-in on the public URL and then *legitimately* burning Azure and Google quota.
Enforce `AUTH_ALLOWED_EMAILS` in `databaseHooks.user.create.before` — that one hook covers every sign-in method at
once, now and in future. Without it, everything else in §8 is theatre.

### 4.9 Environment & external setup (owner steps, do first)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon, **region `eu-central-1` (Frankfurt)**. `vercel integration add neon` — the Vercel CLI is installed (54.12.2) and the project is linked. Use the **pooled** (`-pooler`) host. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. |
| `ACCESS_TOKEN_SECRET` | `openssl rand -base64 32`. **Separate key, separate blast radius** (§4.6). |
| `PIN_PEPPER` | `openssl rand -base64 32`. Server-side pepper — this, not the KDF, is what makes a DB dump useless against a 10⁴ keyspace. |
| `BETTER_AUTH_URL` | Prod: `https://preschool-learning-app.vercel.app`. Dev: **`http://localhost:5173`**. Preview: **unset** (derived from `VERCEL_URL`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | See below. |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` | `preschool-learning-app.vercel.app` in prod, `localhost` in dev (D8). Name: `Børnelæring`. |
| `AUTH_ALLOWED_EMAILS` | **Mandatory** (§4.8). Comma-separated. |
| `AUTH_DEV_BYPASS=1` | **`.env.local` ONLY — never add to Vercel.** Guarded by `runtime()==='dev' && !process.env.VERCEL`, and there must be a test asserting the bypass is impossible when `VERCEL` is set. |

**No `VITE_*` variables.** The client learns what it needs from `/api/auth/family/status`, so nothing secret or
environment-specific is baked into the bundle. Vercel already provides `VERCEL_ENV`, `VERCEL_URL`,
`VERCEL_PROJECT_PRODUCTION_URL`.

**`baseURL()` resolution order:** `BETTER_AUTH_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` when
`VERCEL_ENV === 'production'` → `https://${VERCEL_URL}` → `http://localhost:5173`.

**Google Cloud Console — OAuth client of type "Web application".** Authorized JavaScript origins:
`https://preschool-learning-app.vercel.app` and `http://localhost:5173` (Google exempts `http://localhost` with a port
from the HTTPS rule, so the dev entry is legal). Authorized redirect URIs — register **all four** so switching
implementation detail needs no Google change:

```
https://preschool-learning-app.vercel.app/api/auth/family/oauth/callback
https://preschool-learning-app.vercel.app/api/auth/callback/google
http://localhost:5173/api/auth/family/oauth/callback
http://localhost:5173/api/auth/callback/google
```

Scopes `openid email profile` only. Keep the consent screen in **Testing** with the family emails as test users — that
avoids app verification entirely, and the usual 7-day refresh-token expiry does not apply because we request
`access_type=online` and only ever consume the one-shot `id_token`.

**Preview-deployment gap — flag this to the owner.** Redirect URIs cannot be wildcarded, and a preview origin
(`…-git-branch-user.vercel.app`) is not a registrable-domain suffix of the prod RP ID, so **on preview deployments
neither Google sign-in nor passkeys work**, and with email OTP deferred (D3) that leaves *no* sign-in method. Mitigate
by registering the **stable branch alias** for the implementation branch as an extra redirect URI (Vercel's
`<project>-git-<branch>-<team>.vercel.app` is deterministic), and accept that passkeys are prod-and-localhost only.
Otherwise previews are testable only via `AUTH_DEV_BYPASS`, which must never be set on Vercel.

`.gitignore` blanket-ignores `*.json` with an allowlist of `!` exceptions — any new committed JSON config file needs an
explicit exception or it is silently ignored.

### 4.10 Email OTP — designed, flag-disabled (D3)

Wire the `emailOTP` plugin now and leave it disabled, so enabling it later is config rather than surgery:
`otpLength: 6`, `expiresIn: 600`, `allowedAttempts: 3`, **`storeOTP: 'hashed'`** (never store a live code in
plaintext), and `sendVerificationOTP` calling a `lib/mailer.ts` `afterResponse()` wrapper around `waitUntil` from
`@vercel/functions` — never `await` the send inside the request, which also removes the email-existence timing oracle
for free. Send responses are `{ success: true }` **unconditionally** (no account-existence oracle); allowlist rejection
happens later at user creation.

When it does ship it needs a **domain acquired for this app** for SPF+DKIM — e.g. `no-reply@mail<app-domain>`.
**Do not use the owner's work domain or work email address for anything in this project** — not as a sending domain,
not in the allowlist, not as a contact address. The only account identity in use is `allanvraa@gmail.com`. You cannot
DKIM-sign `preschool-learning-app.vercel.app`. Recommended EU providers: **Brevo** (France, REST API, ~300/day free),
Mailjet (FR) or Scaleway TEM (FR). Resend defaults to US — only with its EU region enabled.

---

## 5. Client data layer — `progressStore` surgery

This is the risky half. Read §10 before writing code.

### 5.1 The key architectural insight

`state.stickers.collected` / `.newIds` have **exactly one consumer**: `src/components/hub/StickerAlbum.tsx`. Forty-five
files consume `progressStore`, but the reward multiset is read in one component. So we change the **persisted source of
truth** to a tiny composition of CRDTs while keeping the **in-memory read model byte-identical**, and no consumer
changes at all:

```
PersistedProgress (v4)   ← canonical, tiny, all CRDTs, this is what syncs
        │ derive()
        ▼
ProgressState            ← today's exact shape (+ profileId), what 45 files read
```

`derive()` recomputes `stickers.collected`, `stickers.newIds`, `totals.totalStickers`, `progression.globalXp` and
`progression.bloom` from the canonical form. Because those become **derived, not merged**, the store invariants hold
*by construction* and no merge can violate them.

**Acceptance test for this design: `StickerAlbum.tsx` needs zero changes. If it needs edits, `derive()` is wrong.**

### 5.2 New file `src/config/progressSchema.ts` — PURE, Node-importable

No `window`, no network, no `Date.now()` outside an injected `ctx`. Explicit `.ts` extensions on relative imports (the
`progressStore.ts` header comment explains why: build scripts and `node --test` import this graph directly).

```ts
export const SCHEMA_VERSION = 4 as const
export const LEGACY_STORAGE_KEY = 'bornelaering-progress'
export const LEGACY_DEVICE_ID = 'legacy-v3'      // MUST differ from any real deviceId — see §5.5
export const progressKeyFor = (profileId: string) => `bornelaering-progress:${profileId}`

export interface DeviceCounters {
  xp: number
  slots: number                                  // slots THIS device handed over via a ceremony
  bloom: Partial<Record<SectionId, number>>
}

export interface LwwStamp { at: number; by: string }

export interface SyncMeta {
  rev: number          // monotonic local revision, bumped on every persisted commit
  updatedAt: number
  epoch: number        // bumped by resetAll(); a higher epoch wins WHOLESALE
  syncedRev: number    // rev the server has acked → dirty === rev > syncedRev
  serverRev: number    // server rev we last reconciled against (baseRev for PUT)
  originDevice: string
}

export interface PersistedProgress {
  version: typeof SCHEMA_VERSION
  profileId: string | null
  stickers: { grantedSlots: number; seenThroughSlot: number; firstAt: Record<string, number> }
  ledger: Record<string /* deviceId */, DeviceCounters>
  perGame: Record<string, PerGameStats>
  totals: { totalStars: number }                 // totalStickers is DERIVED
  progression: { lastCelebratedLevel: number; explored: Record<SectionId, string[]>; updatedAt: number }
  settings: ProgressSettings & { themeId?: string }
  settingsMeta: Record<string, LwwStamp>         // keyed by field path, e.g. 'difficulty.perSection.math'
  sync: SyncMeta
}

export const defaultPersisted: (profileId: string | null, deviceId: string, now: number) => PersistedProgress
export const normalizePersisted: (raw: unknown) => PersistedProgress | null   // null ⇒ not a v4 blob
export const migrateToV4: (raw: unknown, ctx: {
  deviceId: string; now: number; themeIdHint?: string; ledgerKey?: string
}) => PersistedProgress | null

// derivation (the read model 45 files consume)
export const totalXp: (p: PersistedProgress) => number
export const totalSlots: (p: PersistedProgress) => number
export const bloomXpFor: (p: PersistedProgress, s: SectionId) => number
export const rebuildCollected: (grantedSlots: number, firstAt: Record<string, number>, now: number)
  => ProgressState['stickers']['collected']
export const deriveNewIds: (grantedSlots: number, seenThroughSlot: number) => string[]
export const derive: (p: PersistedProgress, now: number) => ProgressState

export const progressInvariantViolations: (p: PersistedProgress) => string[]
```

### 5.3 The v3 → v4 migration — the single most dangerous change

`normalize()` currently contains, at `src/services/progressStore.ts:224`:

```ts
if (r.version !== SCHEMA_VERSION) return base   // unknown/old → reset (never crash)
```

An **unconditional hard reset**. Bumping `SCHEMA_VERSION` to 4 without a migration branch **deletes the son's
45-reward book**. Replace it with a version-directed chain, and reduce `normalize()`'s remaining job to "validate an
already-v4 blob":

```
raw → version === 4 → normalizePersisted
    → version === 3 → migrateV3toV4
    → anything else → null   ⇒ caller decides (defaults for a profile key; "nothing to adopt" for legacy)
```

```
migrateV3toV4(v3, ctx):
  xp    = num(v3.progression?.globalXp)
  slots = Σ v3.stickers.collected[*].count          // the multiset cursor, gold-aware
  ledger[ctx.ledgerKey ?? ctx.deviceId] = {
    xp,
    slots: min(slots, collectedFromLevel(levelFromXp(xp).level)),   // repair clamp
    bloom: { <section>: v3.progression.bloom[<section>].xp },
  }
  stickers.firstAt         = { id: firstAt } for every on-path id in v3.stickers.collected
  stickers.grantedSlots    = ledger[...].slots
  stickers.seenThroughSlot = v3.stickers.newIds?.length
                               ? min(slot(id) for id in newIds)     // preserve pending "nyt!" badges
                               : min(45, slots)                      // everything already seen
  progression.lastCelebratedLevel = v3.progression.lastCelebratedLevel ?? 1
  progression.explored            = v3.progression.explored (string-filtered)
  perGame, totals.totalStars      = carried verbatim
  settings                        = carried; musicDefaultOn ||= true; themeId ??= ctx.themeIdHint
  settingsMeta                    = { <every carried field>: { at: v3.progression.updatedAt || 1, by: 'legacy' } }
  sync = { rev: 1, epoch: 0, updatedAt: ctx.now, syncedRev: 0, serverRev: 0, originDevice: ctx.deviceId }
```

`stickers.grantedSlots` is stored *and* derivable from `Σ ledger[*].slots`. Store it as the display cursor, treat
`Σ ledger` as truth, and have `progressInvariantViolations` assert they agree — cheap redundancy that catches a whole
bug class.

**Belt and braces: never write to `LEGACY_STORAGE_KEY` again, and never delete it.** Even a botched migration is then
recoverable from disk.

### 5.4 Store lifecycle — inert by default, then `attach`

The store hydrates in its constructor at module-import time, long before React, the router, or the gate. Any attempt to
"just hydrate the right profile" there requires reading account state synchronously at import, and a sign-out in
another tab leaves a hydrated ghost. **Inert-by-default is the only ordering correct in every case.**

```ts
// Module-level, ONE frozen instance. getSnapshot() must return a STABLE reference or
// useSyncExternalStore re-renders forever.
const INERT_STATE: ProgressState = Object.freeze(inertState())

constructor() {
  this.persisted = null
  this.state = INERT_STATE
  this.key = null
  this.installLifecycleHooks()      // unchanged, still `typeof window` gated
}
```

New API:

```ts
attach(profileId: string): void
detach(): void
isAttached(): boolean
activeProfileId(): string | null
reload(): void                       // re-read the active key + notify (cross-tab, post-sync)
whenAttached(): Promise<string>      // one-shot, resolved by the first attach()
```

`attach(profileId)`:

1. `if (profileId === this.currentProfileId) return` — **must be idempotent**; StrictMode double-invokes effects and a
   re-hydrate would discard state committed between the two invocations.
2. `this.flush()` — in-flight debounce lands under the **old** key.
3. `this.key = progressKeyFor(profileId)`.
4. `this.persisted = normalizePersisted(raw) ?? migrateToV4(raw, ctx) ?? defaultPersisted(...)`.
5. `this.state = derive(this.persisted, now)`.
6. Resolve `whenAttached()`; notify listeners — `sfxClient`/`musicClient` re-read here for free.

**No `resetAll()` and no write on attach**: attaching is a pure read, so a hydration bug can never destroy data.
`detach()`: `flush()` → `key = null`, `persisted = null`, `state = INERT_STATE` → notify.

The profile switch **mutates the existing singleton in place** — never swap the module export. Several non-React
consumers (`sfxClient`, `musicClient`, `bugReporter`, `devHarness`, `RewardWatcher`) hold the module reference
directly; they subscribe and re-read `progressStore.get()` on notify, so `attach()`'s notify is all they need.

#### Make the debounced write key-safe — highest-risk bug in the change

Today `scheduleSave()` and `flush()` write `this.state` to a module **constant** key. Once the key is mutable, a
pending timer firing after a swap writes **child A's book under child B's key**. Flushing before the swap is necessary
but not sufficient. Bind the payload to its key at schedule time so it is structurally impossible:

```ts
private pending: { key: string; json: string } | null = null

private scheduleSave(): void {
  if (!this.key || !this.persisted) return                 // detached ⇒ never persist
  this.pending = { key: this.key, json: JSON.stringify(this.persisted) }
  if (this.saveTimer) clearTimeout(this.saveTimer)
  this.saveTimer = setTimeout(() => { this.saveTimer = null; this.writePending() }, 250)
}

flush(): void {                                            // signature unchanged; App/tests unaffected
  if (!this.saveTimer) return
  clearTimeout(this.saveTimer); this.saveTimer = null
  this.writePending()
}

private writePending(): void {
  const p = this.pending; this.pending = null
  if (!p) return
  try { localStorage.setItem(p.key, p.json) } catch { /* quota / private mode */ }
}
```

#### `commit()`

```ts
private commit(next: PersistedProgress): void {
  if (!this.key) {                                         // detached: refuse, loudly in DEV
    if (import.meta.env?.DEV) console.warn('[progress] write while detached — dropped')
    return
  }
  next.sync = { ...next.sync, rev: next.sync.rev + 1, updatedAt: Date.now() }
  if (import.meta.env?.DEV) {
    const v = progressInvariantViolations(next)
    if (v.length) console.error('[progress] invariant violated', v)
  }
  this.persisted = next
  this.state = derive(next, Date.now())
  this.scheduleSave()
  this.commitListeners.forEach((l) => l(next.sync))        // → progressSync debounce
  this.listeners.forEach((l) => l())
}
```

Every existing mutator (`setDifficulty`, `markBrowsed`, `recordRoundResult`, `grantXp`, `grantTaskXp`,
`markLevelCelebrated`, `markStickersSeen`, `setSetting`, `grantPendingRewards`) keeps its **public signature
unchanged** and gains an `if (!this.isAttached()) return <zero-effect result>` head. Bodies move from mutating a
`ProgressState` draft to a `PersistedProgress` draft:

| Mutator | Change |
|---|---|
| `applyXp(draft, section, amount)` | `ledger[myDevice].xp += amt`; `ledger[myDevice].bloom[section] += amt`. The returned `XpGrantResult` still reads `totalXp()`/`bloomXpFor()` — **shape unchanged**, so `useRound`, `xpBus`, `RewardRing` are untouched. |
| `grantSlot(draft, slotIndex0)` | `ledger[myDevice].slots += 1`; `firstAt[id] ??= now`; `RewardGrant` computed from `rebuildCollected` before/after. **Keep the deterministic path logic verbatim** — do not touch `REWARD_PATH` order or the `(slot-45) % 45` wrap. |
| `grantedSlots()` | `totalSlots(this.persisted)` — O(1), and **fixes a latent bug** (§10.11). |
| `markStickersSeen()` | `seenThroughSlot = min(45, grantedSlots)` instead of `newIds = []`. |
| `setSetting` / `setDifficulty` | Also stamp `settingsMeta[path] = { at: now, by: deviceId }`; `setDifficulty` stamps **per-section** paths. |
| `resetAll()` | §5.6. |

New sync surface, used only by `progressSync` and `legacyAdoption`:

```ts
exportPersisted(): PersistedProgress | null
applyRemote(remote: PersistedProgress): MergeReport | null   // merge vs LIVE state, then commit()
syncMeta(): SyncMeta | null
markSynced(serverRev: number, ackedRev: number): void        // advance syncedRev WITHOUT bumping rev
onCommit(cb: (meta: SyncMeta) => void): () => void
```

`applyRemote` merges against `this.persisted` **at call time**, so no lock is needed even mid-ceremony (§6.2).
`markSynced` **must not bump `rev`** or the profile is permanently dirty and push-loops.

### 5.5 Legacy adoption — `src/services/legacyAdoption.ts`

```ts
export interface LegacyPreview {
  present: boolean; collectedCount: number; level: number; totalStars: number; fingerprint: string
}
export interface AdoptionMarker { adoptedInto: string; at: number; fingerprint: string }

export const legacyPreview: () => LegacyPreview
export const adoptionMarker: () => AdoptionMarker | null
export const adoptLegacyInto: (profileId: string) =>
  | { status: 'adopted'; report: MergeReport }
  | { status: 'already-adopted'; marker: AdoptionMarker }
  | { status: 'nothing-to-adopt' }
  | { status: 'unreadable' }
```

Flow, with **three independent idempotency guards**:

1. Marker present → `already-adopted`. *(Guard 1: explicit.)*
2. Read `LEGACY_STORAGE_KEY`. Absent/unparseable/not v3 → `nothing-to-adopt` / `unreadable`.
3. `migrateToV4(raw, { deviceId, now, ledgerKey: LEGACY_DEVICE_ID, themeIdHint: localStorage['bornelaering-theme'] })`.
   **Legacy XP goes into the ledger entry `'legacy-v3'`, never this device's real id.** *(Guard 2: structural —
   re-adoption becomes a per-device `max` of the same key onto itself, i.e. a no-op, even if the marker write failed.
   Using the real deviceId would conflate legacy XP with live counters and a re-adopt would clobber later play.)*
4. `progressStore.applyRemote(legacyAsV4)` — **adoption IS a merge**, reusing the exact same tested code path as sync.
   No second implementation.
5. `progressStore.flush()`, then write the marker. *(Guard 3: the `fingerprint` turns a silent double-count into a
   detectable case.)*
6. **Never delete or rewrite the legacy blob.** Optionally copy to `bornelaering-progress:archived-v3` after the first
   successful server push.

UX: `Hvem har spillet på denne iPad?` → pick or create a child → confirm the preview ("45 klistermærker, niveau 46").
Adopting the same blob into two profiles (two kids shared the iPad) is **allowed** — the marker prevents *accidental*
repeats; the dialog should let the adult do it deliberately.

### 5.6 `resetAll()` in the new world

- Detached → no-op + DEV warn.
- Preserves `settings` **and** `settingsMeta` (resetting the stamps backwards would let a stale remote setting win),
  now including `themeId` — same spirit as today's sound/music/difficulty carry-through.
- Zeroes `ledger` to `{}`, `stickers` to `{ grantedSlots: 0, seenThroughSlot: 0, firstAt: {} }`, `perGame` to `{}`,
  `totals.totalStars` to 0, `explored` empty, `lastCelebratedLevel` to **1** (never 0).
- **Bumps `sync.epoch`** — without this the next pull resurrects everything (§6.2).
- Requests an immediate push so the epoch bump reaches the server before a sibling device pushes pre-reset data.
- **Product change to flag:** reset is now **per child**. The confirm copy in `AdultCorner.tsx` currently promises
  "alle klistermærker, rekorder og stjerner" — it must now name the child (`Nulstil fremgang for Emil?`) or a parent
  will nuke the wrong kid's book.

### 5.7 Cross-tab handling

The comment at `progressStore.ts:337-343` — *"This is a single-child app, so last-writer-wins is fine"* — becomes
**factually false** and must be rewritten, or the next reader trusts it.

```ts
private onStorage(e: StorageEvent): void {
  // 1. Another tab switched child or signed out → re-lock this tab. Never keep playing as the
  //    previous child while writing to the previous child's key.
  if (e.key === ACTIVE_PROFILE_KEY || e.key === ACCOUNT_KEY) { this.detach(); return }

  // 2. Same profile, another tab wrote → MERGE, not adopt-wholesale. Sibling tabs are now real
  //    and LWW can drop a reward.
  if (this.key && e.key === this.key && e.newValue != null) {
    const remote = normalizePersisted(safeParse(e.newValue)); if (!remote) return
    const { merged, report } = mergeProgress(this.persisted!, remote, ctx)
    if (report.changed) this.commit(merged)     // idempotent join ⇒ ping-pong terminates in one round
    else { /* adopt in memory, do NOT write back */ }
    return
  }

  // 3. Another PROFILE's key (a sibling in tab 2) → ignore entirely.
}
```

`report.changed` is what stops a write ping-pong; the join's idempotence is what bounds it.

### 5.8 Storage key classification (D7)

| Key | Scope | Decision |
|---|---|---|
| `bornelaering-progress` | **legacy, read-only** | v3 anonymous blob. Adoption source only. **Never written again, never deleted.** |
| `bornelaering-progress:<profileId>` | **profile** | v4 canonical blob. The synced payload. |
| `bornelaering-theme` | **device first-paint hint** | Truth moves to `settings.themeId` (profile-scoped, syncs for free). Key stays as the synchronous first-paint hint (§10.3). `bugReporter.ts:98` keeps working. |
| `voicelab_voice_override_v3` | **device-only** | Throwaway internal tool. Never sync. |
| `tts_audio_cache_v2` | **device-only** | ~2.8 MB budget against a ~5 MB origin limit. Profile-scoping would 4× the footprint and blow quota; content is identical per child. **Hard no.** |
| `updateDismissed` | **device-only** | Keyed to a build, not a person. |
| `bl-chunk-reload`, `bl-crash-signatures`, `børnelæring-session-id` (session) | **device/session** | Reload guard, crash dedupe, diagnostics correlation. |
| audit harness key | **device-only, DEV** | Owner tooling. |
| **NEW** `bornelaering-device-id` | **device-only** | UUID. Ledger key + sync origin. Created once, **never cleared by reset**. |
| **NEW** `bornelaering-account` | **account** | Session token/expiry + cached profile roster (offline-capable gate). |
| **NEW** `bornelaering-active-profile` | **device pointer** | Which child this device last used. Drives cross-tab detach. |
| **NEW** `bornelaering-legacy-adoption` | **device-only** | `{ adoptedInto, at, fingerprint }` idempotency marker. |

### 5.9 New client services

- **`src/services/deviceId.ts`** — `getDeviceId()` (localStorage + `crypto.randomUUID()`, memoized, try/catch, falls
  back to an in-memory UUID in private mode: a throwaway ledger entry is harmless because entries are additive) and
  `resetDeviceId()` for DEV/support.
- **`src/services/profileStore.ts`** — the account/profile singleton and the **only** caller of `attach`/`detach`.
  `AccountState { status: 'locked' | 'signed-out' | 'ready'; accountId; profiles; activeProfileId }`, plus
  `hydrate/signIn/signOut/createProfile/selectProfile/clearSelection/refreshRoster`. `selectProfile` must call
  `progressStore.attach(id)` **synchronously in the same tick as its own state update** and write the active-profile
  pointer, so the first render already sees the child's real data (no level-1 flash).
- **`src/hooks/useProfiles.ts`** — `useSyncExternalStore` over `profileStore`, mirroring `useProgress.ts`.
- **`src/hooks/useSyncStatus.ts`** — **separate hook.** Do **not** put sync status in `useProgress`, or every sync tick
  re-renders the whole world.

---

## 6. Sync design

### 6.1 New file `src/config/progressMerge.ts` — PURE, Node-importable, shared with the server

Must stay free of `Date.now()` / `crypto` / `localStorage` so **the Vercel function imports it directly** and there is
exactly one merge implementation.

```ts
export interface MergeContext { now: number; deviceId: string }

export interface MergeReport {
  epochWinner: 'local' | 'remote' | 'equal'
  xpBefore: number; xpAfter: number
  slotsBefore: number; slotsAfter: number
  clampedSlots: boolean          // the repair clamp fired ⇒ one side was corrupt
  changedSettings: string[]
  changed: boolean               // false ⇒ nothing new; skip the write-back (anti-ping-pong)
}

export function mergeProgress(
  local: PersistedProgress, remote: PersistedProgress, ctx: MergeContext,
): { merged: PersistedProgress; report: MergeReport }
```

### 6.2 Merge semantics — with four corrections to the obvious approach

Each of these was wrong in the first design pass and each is a shipping blocker.

**(a) Re-derive membership from *slots handed over*, NOT from the level.** `collectedFromLevel(level)` is the *debt
ceiling*, not the *balance*; `grantedSlots()` legitimately lags it, and that gap **is** the pending ceremony. Deriving
from the level causes three bugs: it pre-grants the owed reward so the child **never sees the ceremony**; it flattens
every `count` to 1, destroying the gold-pass cursor (`grantSlot` computes `pathIndex = (slot - 45) % 45` from
`grantedSlots()`, so a level-60 player's next gold reward resets to slot 1); and for a past-45 player it manufactures
`owedRewards() = collectedFromLevel(level) - 45`, i.e. a **phantom fistful of golds** on the next ceremony.

**(b) `max()` on XP doesn't just under-count — it loses a reward already handed over.** Two iPads offline, 200 XP each:
`max` = 200 → 5 slots allowed, but each device *granted* 5, so device A's view silently erases the 5 rewards device B's
child physically celebrated. Fix: a **per-device ledger (G-Counter)** — each device only ever increments its own entry,
merge is per-device `max`, totals are `Σ`. Now 200+200 = 400 XP → 10 slots allowed and `Σ slots` = 10. Exactly
consistent. **Not optional** for `xp`/`slots`/`bloom`. Cost at family scale: ~7 numbers × 4 devices.

This makes the whole merge a join of standard CRDTs (G-Counter, max-register, grow-only set, LWW-register), hence
`idempotent ∧ commutative ∧ associative`. The payoff: **`applyRemote()` can be applied at any instant — mid-round,
mid-ceremony — with no lock and no queue.** That property is worth more than the precision.

**(c) `resetAll()` cannot be expressed in a join-only merge.** Under any monotone rule the next pull resurrects every
sticker and the reset appears to do nothing. Fix: **`sync.epoch`**, bumped by `resetAll()`. If
`local.epoch !== remote.epoch`, the **higher epoch wins WHOLESALE** — no join at all, because a reset is a declared
fresh start. Only equal epochs run the field-wise join.

**(d) `newIds` union resurrects dismissed "nyt!" badges.** `markStickersSeen()` clears the whole array, so "seen" isn't
per-id syncable state. Rewards are handed out strictly in path order and gold duplicates are `isNew: false`, so "new
since last opened" is always a *contiguous suffix of the granted prefix*. Store **`stickers.seenThroughSlot`**, merge
with `max`, and derive `newIds` from it. An unmergeable array becomes a max-register.

| Field | CRDT | Rule |
|---|---|---|
| `sync.epoch` | max-register + **gate** | Differ ⇒ higher epoch's whole blob wins, no join. Equal ⇒ join below. |
| `ledger[d].xp` | G-Counter | `max` per device over the key union; total = `Σ`. |
| `ledger[d].slots` | G-Counter | `max` per device; total = `Σ`. Keeps `owedRewards()` arithmetic exact. |
| `ledger[d].bloom[s]` | G-Counter | `max` per (device, section); total = `Σ`. |
| `stickers.grantedSlots` | derived | `min( collectedFromLevel(level(Σ xp)), Σ slots )`. The clamp is **repair-only** and provably inert on valid input: each side satisfies `slots_i ≤ collectedFromLevel(level(xp_i))`, and that function is monotone in xp, so `max_i slots_i ≤ collectedFromLevel(level(max_i xp_i))`. Unit-testable property. |
| `stickers.collected` | **derived** | `rebuildCollected(grantedSlots, firstAt, now)` — path order + `(slot-45)%45`. |
| `stickers.firstAt[id]` | min-register | `min` over **positive** values only (`Math.min(0, …)` would show 1970); union of keys; fallback `ctx.now` for a prefix id missing on both sides. |
| `stickers.seenThroughSlot` | max-register | `max`. |
| `stickers.newIds` | **derived** | `deriveNewIds(grantedSlots, seenThroughSlot)`. |
| `totals.totalStars` | max *(Phase A)* | Cosmetic under-count on concurrency. Phase B → ledger. |
| `totals.totalStickers` | **derived** | `min(45, grantedSlots)`. Removed from the wire. |
| `perGame[g].bestStreak` / `bestStars` / `bestCount` | max-register | `max` per field. |
| `perGame[g].roundsCompleted` / `lifetimeCorrect` | max *(Phase A)* | **These are counters, not bests.** **Never `sum`** — the merge runs on every sync, so summing is non-idempotent and the numbers explode. Phase B → ledger. |
| `progression.lastCelebratedLevel` | max-register | `max`, then the no-debt clamp in §6.3. |
| `progression.explored[s]` | grow-only set | Union, de-duped, order-insensitive (`markBrowsed` never removes). |
| `progression.updatedAt` | max-register | `max`. Display/diagnostics only, never a merge key. |
| `settings.<field>` | LWW-register | Newer `settingsMeta[field].at` wins; **tie → larger `by` (deviceId)** so clock-synced devices converge identically. Defaults stamped `at: 0`, explicit user changes at `at: now`, so adopted legacy settings beat an untouched fresh profile. |
| `settings.difficulty.perSection.<s>` | LWW-register | **Per section key**, not per whole object — absence is a value (override cleared). |
| `settings.musicDefaultOn` | OR | `local ‖ remote`. It's a **migration marker, not a preference**; LWW would let an old blob's `false` re-flip music on. |
| `settings.themeId` | LWW-register | Syncs the skin across devices. |
| `sync.rev` | local monotone | `max(local.rev, remote.rev) + 1` when `report.changed`, so the merged result is dirty and gets pushed back. |
| `sync.updatedAt` | max-register | `max(…, ctx.now)`. |

### 6.3 The empty-ceremony guard

`RewardOverlay.tsx` with `owed = []` still fires `sfx.play('level-up')`, `mascotBus.emit('round')`,
`celebrateTier('levelup')` and holds a **contentless overlay** for `DISMISS_MS` — only the spoken line is guarded by
`if (headline)`. Any state where `globalLevel() > lastCelebratedLevel` with zero debt produces confetti about nothing,
which a merge can easily create. Two guards:

1. **Merge post-condition:** `if (grantedSlots_merged >= collectedFromLevel(level_merged)) lastCelebratedLevel = max(lastCelebratedLevel, level_merged)` — a level whose reward was already handed over on another device has already been celebrated there.
2. **Defensive:** `RewardOverlay` early-returns (calling `markLevelCelebrated`) when `owed.length === 0 && grants.length === 0` — no SFX, no `celebrateTier`, no overlay.

### 6.4 Transport, conflict protocol and scheduling — `src/services/progressSync.ts`

Network only; **never imported by `progressStore`**.

```ts
export type SyncReason = 'attach' | 'commit-debounce' | 'ceremony' | 'pagehide' | 'reconnect' | 'poll' | 'manual'
export interface SyncStatus {
  phase: 'idle' | 'pulling' | 'pushing' | 'offline' | 'error'
  dirty: boolean; pendingRev: number; lastPushAt: number; lastPullAt: number
  conflicts: number; error: string | null
}
class ProgressSync {
  start(): void; stop(): void
  pull(r: SyncReason): Promise<void>; push(r: SyncReason): Promise<void>; syncNow(r: SyncReason): Promise<void>
  flushBeacon(): void
  getStatus(): SyncStatus; subscribe(cb: () => void): () => void
}
```

Protocol:
- `GET /api/progress?profileId=…` → `{ rev, epoch, updatedAt, blob }` (404 = never synced)
- `PUT /api/progress` `{ profileId, baseRev, blob }` → `200 { rev }` | `409 { rev, blob }`
- On 409: `progressStore.applyRemote(theirBlob)` → re-PUT with the new `baseRev`. Bounded to 3 attempts, then back off
  to the next trigger. Because the merge is a proper join, the retry **provably converges**.
- The server also runs `progressInvariantViolations` and rejects a blob whose ledger entries went **backwards** —
  the anti-tamper floor at family scale.

| Trigger | Action | Notes |
|---|---|---|
| `attach` | `pull()`, then `push()` if dirty | Never awaited by the UI; gameplay already runs off local state. |
| `progressStore.onCommit` | debounced `push()` at **8 s** | Much longer than the 250 ms localStorage debounce — batch a whole round into one request. Coalesce, reset on each commit. |
| Ceremony dismissed (`markLevelCelebrated`) | immediate `push()` | The emotionally load-bearing moment; the parent may check the other iPad. |
| `pagehide` / `visibilitychange:hidden` | existing `progressStore.flush()`, **then** `flushBeacon()` | `fetch` is cancelled during `pagehide` → use `navigator.sendBeacon`. **It cannot read a response, so it must not advance `syncedRev`** — stay dirty and re-push on next attach. Watch the ~64 KB beacon cap (`progression.explored` is the growth vector); fall back to `fetch(..., { keepalive: true })` above ~50 KB. |
| `window 'online'` | `pull()` + `push()` | |
| `poll` | `pull()` every 5 min, **only** when `visibilityState === 'visible'` and `routeKind(path) !== 'game'` | Piggyback the existing `useUpdateChecker` cadence rather than a second timer. **Never pull mid-game.** |

---

## 7. UX specification

All strings inline in the components. The app has **no i18n layer** and never will;
`src/config/danish-phrases.ts` is only for text that gets **spoken**, which none of this is (so no `tts:prebake` /
`audit:check` obligation is incurred).

Danish conventions to match, observed across every existing adult surface: trailing emoji on titles, `du`-form, ≤2
sentences of body copy, `Annullér` with the acute accent, `Luk` / `Prøv igen` / `Gem som fil` button verbs, and a
Danish `aria-label` on every interactive element. **The word "trin" must not appear anywhere.**

### 7.1 The lock screen

Modelled directly on `src/components/common/SimplifiedAudioPermission.tsx` — the app's existing app-root blocking
overlay, and the closest structural precedent (session-scoped, must not re-arm spuriously, must dismiss synchronously
and never on an async result). Reuse its exact recipe: `position: fixed; inset: 0; zIndex: 9999`, scrim, centred
`motion.div` (`maxWidth: 400`), `<Paper elevation={12} sx={{ p: 4, borderRadius: 4 }}>`, `AnimatePresence` + spring
`{ stiffness: 300, damping: 30 }`. Mounted between `AppErrorBoundary` and `App` in `src/main.tsx`, and **not**
`React.lazy` — a blocking gate must not wait on a chunk.

The show/hide decision lives in a **pure, unit-tested policy module** `src/contexts/authGatePolicy.ts` — same directory
and same shape as `src/contexts/audioPromptPolicy.ts`, which exists precisely because an iOS re-arm bug was untestable
inside React:

```ts
export type AuthPhase = 'booting' | 'signedOut' | 'locked' | 'authed' | 'offlineGrace' | 'offlineExpired'
export interface AuthGateInputs {
  hasStoredToken: boolean
  serverVerdict: 'unknown' | 'valid' | 'invalid' | 'unreachable'
  lastVerifiedAt: number | null
  now: number
  graceMs: number            // 30 days (§4.7)
  lockedByAdult: boolean
  idleSinceMs: number
  devBypass: boolean         // ?noauth=1 (or ?nogate=1) in DEV only
}
export interface AuthGateDecision { phase: AuthPhase; canPlay: boolean; canCallPaidApis: boolean }
export function authGateDecision(s: AuthGateInputs): AuthGateDecision
```

Invariants worth one test each: `invalid` ⇒ `signedOut` **immediately, ignoring grace** (revocation must be instant);
`unreachable` + within grace ⇒ `offlineGrace` with `canPlay: true, canCallPaidApis: false`; `unknown` + a stored token
⇒ `authed` **optimistically** (never a boot spinner); `devBypass` ⇒ `authed`.

| Phase | Headline | Body | Actions |
|---|---|---|---|
| `signedOut` (first run) | `Velkommen til Børnelæring 👋` | `En voksen skal logge ind én gang på denne enhed.` | `Fortsæt med Google` · `Log ind med Face ID` (only when a passkey exists for this RP) |
| `locked` | `Velkommen tilbage 👋` | `Bekræft at det er dig.` | Face ID (primary when available) · `Brug kode i stedet` → PIN pad · `Log ind med Google` |
| `offlineExpired` | `Ingen forbindelse 📡` | `Børnelæring skal på nettet igen. Slut iPad'en til wi-fi og prøv igen.` | `Prøv igen` + the last-verified date |
| `offlineGrace` | *(no overlay — plays normally)* | — | `Sig et Ord` shows `Kræver internet` |

### 7.2 The PIN pad

Replaces `AdultGate` entirely (D4). Do **not** reuse `AdultGate`'s single `TextField` — build a real keypad from
`TactileTile variant="chip"`, which already provides 44 px+ touch targets, press travel, a `:focus-visible` ring,
`state='wrong'` shake (`x: [0,-7,7,-5,5,0]`) and internal `useReducedMotion()` handling.
`src/components/games/ordleg/SpellingGame.tsx` (~line 584) is the closest existing usage.

Accent: `getCategoryTheme('math').accentColor` — **never** `categoryThemes['math']`, which is bound to the default kid
tokens and is not skin-aware. Digit glyphs on the white tile surface use `onTileColor(accent)`, never raw accent.

Behaviour: 4 dots fill as digits are entered; verify fires automatically on the 4th digit (no OK button); wrong →
shake + clear + remaining-attempts hint; lockout shows a countdown. Unlike today's silent-close gate, a wrong PIN gives
real feedback.

**PIN setup is mandatory during onboarding and cannot be skipped.** This matters for D4: the PIN is the only gate that
works offline, so if an adult could defer setting one, a fresh device would have *no* adult gate at all once
`AdultGate` is deleted. Nag until a PIN exists, immediately after the first successful sign-in (while still online, so
the local verifier can be cached). That closes the gap and lets `AdultGate.tsx` be deleted as D4 requires.

Verification routing — **one table, one place, so the rule cannot drift per call site.** Expose it as
`requirePin(reason)` from `AuthContext`:

| Reason | Verified | Rationale |
|---|---|---|
| `adultMenu` | **local** | Must work on a plane; blast radius is this device's UI. |
| `resetProgress` | **local** | `progressStore` is localStorage — local data, local authority. |
| `switchProfile` | **local** | Ditto. |
| `unlockSession` (online) | **server** | Mints a new access token ⇒ spends money ⇒ needs server authority. |
| `unlockSession` (offline) | **local** | Unlocks local play only; paid endpoints stay 401 until online. |
| `changePin` (+ `currentPin`) | **server** | Account-scoped mutation. |
| `manageCredentials` | **server** | Adding/removing a sign-in method. |
| `revokeSessions` / delete account | **server** | Account-scoped mutation. |

The principle, stated so it survives future contributors: **a locally-verified PIN may authorise anything whose blast
radius is this device's local state; a server-verified PIN is required whenever the outcome is a credential, a spend,
or an account-scoped mutation.**

Local verification uses WebCrypto **PBKDF2-SHA256, 150 000 iterations**, 16-byte salt, 256-bit output (supported in
Safari 17; ~150 ms on an A10X iPad), cached in `localStorage['bl-pin-verifier']` **only after a successful online
verify on that device** — so a device gains offline capability only once the adult has proven the PIN there.

**Cross-device PIN change detection:** every successful `validate()` compares the server's `pinUpdatedAt` against the
cached verifier's; if the server's is newer, drop the local verifier so the next adult-gate open forces an online
verify. Without this, a PIN changed on the iPhone leaves the iPad honouring the old one indefinitely.

Local attempt throttling uses the same curve in localStorage — best-effort only; an adult with devtools can clear it,
which is acceptable because the local gate guards only local UI. Server attempts are authoritative in `pin_attempt`.

### 7.3 Adult corner menu (`src/components/adult/AdultCorner.tsx`)

Keep the hold-2 s ⚙️ gesture, the `AdultView` union state machine, the `?adult-tap=1` DEV hook, and the
mount-once-then-keep-mounted lazy dialog pattern. Changes:

- Opening the menu requires PIN or Face ID (replacing the per-action gate). Unlocked ~5 min.
- **Delete `src/components/common/AdultGate.tsx`**, `makeGateCode()` and `DANISH_DIGIT_WORDS`.
- New items: `👤 Profiler` (add/rename/delete child, pick avatar emoji), `🔑 Login og sikkerhed` (set/change PIN,
  add/remove Face ID on this device, sign out, sign out everywhere), `☁️ Synkronisering` (last-synced timestamp,
  `Synkronisér nu`, plain-language error), `🔄 Skift barn` (→ `profileStore.clearSelection()`).
- `♻️ Nulstil al fremgang` keeps its second confirmation, now **naming the active child** (§5.6).
- The version/build footer stays. New dialogs are `React.lazy` like the existing four.

### 7.4 Profile picker

Shown at app start **only when the account has more than one profile**; otherwise the app boots straight into the
single profile — which is what keeps "the child never sees a login screen" true. Visual model: the
`src/components/adult/ThemePanel.tsx` selectable-tile grid (`role="group"`, `motion.button` with `aria-pressed`, 64 px
circular thumb, `3px` accent ring when active) — the app's established "grid of identity tiles". Switching mid-session
is PIN-gated; picking at boot is not.

---

## 8. Security & privacy

### 8.1 Credential leak prevention — the highest-severity item in this build

The threat is concrete: `diagnosticsBuffer` records 300 console lines and 100 network entries; `bugReporter` bundles
them with a **snapdom screenshot** and POSTs to a **public-access Vercel Blob**. Anything reaching a console line or the
DOM is one adult tap from being world-readable.

**A literal secret registry beats regexes.** New `src/services/redact.ts` keeps a module-local `Set` of live secret
strings:

```ts
export function registerSecret(v: string | null | undefined): void
export function forgetSecret(v: string): void
export function redactText(s: string): string
export function sanitizeUrl(u: string): string      // strips query+hash on auth paths; strips code/token/otp/pin/flow params everywhere
export function isSensitiveUrl(u: string): boolean
```

`authStore` calls `registerSecret()` on the session token, every access JWT and every `flowId` **at the moment of
creation**, and `forgetSecret()` on rotation. `redactText()` replaces each registered value (length > 8) with
`«redacted»` — catching tokens **by identity, not by pattern**, so a format change can't silently defeat it. Backstop
regexes for anything unregistered: JWT shape `/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g`,
`/Bearer\s+[\w.~+/=-]+/gi`, and email → `«email»`.

Then, in order:

1. **Console ring** — `pushConsole` runs `redactText(msg)` before `pushRing`. Add the same call to `remoteConsole`'s
   POST path: it is a **separate** patcher, and if only one calls the shared module the other leaks.
2. **Network ring** — replace the two-URL skip list with `if (isSensitiveUrl(url))` (matching `/api/auth`) and record a
   *sanitized* entry: `sanitizeUrl(url)`, status, duration, `redacted: true`, and **no** response snippet. Keeping
   status and duration means auth failures stay diagnosable. Extend `trimUrl` → `sanitizeUrl` **globally**, so
   `code`/`token`/`otp`/`pin`/`flow` params are stripped from every recorded URL, not just auth ones.
   **The current code never records request bodies — preserve that property.** The PIN travels in a POST body, and
   that is the single most important reason never to add body capture "for debugging".
3. **Screenshot — three independent layers**, because one is not enough for a public blob:
   (a) `AdultCorner`'s hold gesture is **disabled** while any auth dialog is open (an `authUiOpen` flag), so a
   PIN screen cannot be captured at all; (b) every auth surface carries `data-bl-redact` and `screenshotService`
   passes `exclude: ['[data-bl-redact]'], excludeMode: 'remove'` (both options confirmed present in the installed
   `@zumer/snapdom` typings); (c) `PinPad` renders **dots, never digits**, so even a bypassed capture shows nothing.
4. **Report payload** — route `app.route` through `sanitizeUrl` (it currently ships
   `location.pathname + location.search`). Add exactly
   `auth: { signedIn, phase, method: 'google'|'passkey'|null, userIdHash }` where `userIdHash` is the first 8 hex of
   SHA-256 of the user id. **Never** the email, name, token or `flowId`. Ship `profileId` + `profileCount`, never the
   child's display name; add `syncStatus`, `epoch` and `rev` — exactly what's needed to debug a "his stickers
   disappeared" report. Finally, run the whole serialised body through `redactText()` as a last net before POSTing:
   cheap, and it catches whatever a future contributor adds to the payload.
5. **URL hygiene** — `history.replaceState` strips `#bl_auth` the instant it is read. The claim credential is never in a
   URL at all (§4.5), and the "flow finished" signal is a fragment so it never reaches access logs or a `Referer`.
6. **Server side** — `storeOTP: 'hashed'`; PIN peppered + scrypt; `flowId` stored only as SHA-256; `logServerError`
   must never receive a request body (it currently doesn't — keep it that way).
7. A `node --test` case asserting a synthetic auth request never appears in the diagnostics ring.

**Worth recording, out of scope:** `api/bug-report.ts` writes with `access: 'public'`, and reports contain child
screenshots. `BUG_REPORT_READ_KEY` protects the *index*, not the blob URLs themselves. Consider a private Blob store.

### 8.2 Brute force

`lib/server-utils.ts` `rateLimit()` is a module-level in-memory `Map`, **per instance, reset on cold start** — its own
comments correctly call it a billing guard, not a wall. Two separate answers:

- **For the auth endpoints:** better-auth's own `rateLimit` with `storage: 'database'` (§4.2b) — DB-backed and shared
  across instances.
- **For the PIN specifically:** `pin_attempt` in Postgres is authoritative. Curve: 4 free attempts, then
  5th → 1 min, 6th → 5 min, 7th → 15 min, 8th → 60 min, ≥9 → 24 h **and `requiresRecovery`** (the PIN path closes
  entirely; only Google sign-in or a passkey reopens it). Success resets the counter. A correct PIN inside a lock
  window must **still** be refused — the lockout must not be bypassable by knowing the PIN.

For a 4-digit PIN the KDF is nearly irrelevant; the real controls are the **server-side pepper** and the **persisted
escalating lockout**. Say so in a code comment, or someone will later "optimise" the lockout away.

Forbidden PINs (`validateNewPin`, a pure module shared by client and server so the two can't diverge): non-4-digit;
all-repeated; ascending/descending runs including wraparound (`1234`, `4321`, `0123`, `9876`, `0987`); and a denylist
of the ~20 statistically most-used codes (`1234 1111 0000 1212 7777 1004 2000 4444 2222 6969 9999 3333 5555 6666 1122
1313 8888 4321 2001 1010`).

Also note `isAllowedOrigin()` returns **`true` when there is no `Origin` header** — deliberate, so curl and the
`/debug-report` skill work. **Leave it alone.** The paid endpoints stop needing it as a guard the moment they require a
verified JWT, and "fixing" it breaks the debug tooling.

### 8.3 CORS

Add `Authorization` to `applyCors()`'s `Access-Control-Allow-Headers`, in **both** `lib/server-utils.ts` and the
hand-duplicated copy in `dev-server.js`. No `Access-Control-Allow-Credentials` — we never send cookies cross-origin.

Be aware this is **correctness, not load-bearing**: in prod the SPA is same-origin with `/api`, and in dev Vite proxies
`/api` → `127.0.0.1:3001` so the browser sees a same-origin request and never preflights (`changeOrigin: true` rewrites
`Host`, not `Origin`, so `dev-server.js`'s localhost branch still passes). Add it for curl, the `/debug-report` skill
and any future cross-origin caller — but don't expect it to fix a symptom.

### 8.4 Data minimisation (D9)

EU-region database; profile = emoji + optional first name (no surname, no birthdate, no photo); no analytics or
tracking of any kind; account and profile deletion that actually deletes rows, reachable from the adult menu.

---

## 9. iOS 17 / PWA trap list

Compatibility floor is **iOS/iPadOS 17** (the owner's oldest iPad caps at 17.7). Check every API against Safari 17,
not "latest Safari" — the newer devices in the house hide 17-only breakage, which is exactly how Ogg audio shipped and
silenced that iPad.

| Trap | Mitigation |
|---|---|
| **iOS consumes user activation across an `await`** — already burned into `.claude/rules/audio-system.md` for audio unlock. `navigator.credentials.create()/get()` after an `await` fails. | **Pre-fetch the options on mount** (refresh every ~4 min; a stale challenge is a clean retryable error) and make the two WebAuthn entry points **non-`async` functions taking pre-fetched options**, so the type system enforces it. |
| **better-auth's own passkey client helpers violate that rule** — `authClient.passkey.addPasskey()` and `signIn.passkey()` fetch options and *then* call `navigator.credentials.*`. | Don't use them. Call `/passkey/generate-*-options` ourselves. Also `@simplewebauthn/browser`'s `startAuthentication` is gesture-safe **only** with `useBrowserAutofill: false` — autofill mode awaits `browserSupportsWebAuthnAutofill()` before `get()`. |
| Installed PWA storage is isolated from Safari; out-of-scope OAuth runs in an in-app browser view. | The cookie-free own-PKCE leg + app-context `flowId` + polling recovery + `WrongContextNotice` (§4.5). |
| Safari has no FedCM, ever. | Redirect flow only — never Google One Tap. |
| **`window.open` in standalone mode can escape to Safari and lose the return path.** | Always `window.location.assign(authorizeUrl)`. Popup-blocker-proof as a bonus. |
| **`vercel.app` is on the Public Suffix List**, and a preview origin is not a registrable-domain suffix of the prod RP ID. | `preschool-learning-app.vercel.app` is a valid RP ID; `vercel.app` is not. **Passkeys cannot work on preview deployments at all** — set `webauthn().enabled = false` there and hide the Face ID button with a one-line explanation. Keep `origin` an **array** so a custom domain later is a config change. |
| **`baseURL` in dev must be `http://localhost:5173`, not `:3001`.** | The Google `redirect_uri` must be a URL the *browser* can reach, and Vite proxies `/api`. Pointing it at `:3001` makes every callback appear to "work" while never reaching the app. |
| The passkey challenge **is** stored in a cookie (`better-auth-passkey`), payload in `verification`. | Fine — the whole passkey flow is same-origin `fetch` in one context. But `useSecureCookies` must be **false in dev**: Safari won't store `Secure` cookies over `http://localhost`. |
| **6 separate digit boxes break iOS one-time-code autofill.** | One input: `inputMode="numeric" autoComplete="one-time-code" maxLength={6}` with `letter-spacing` for the segmented look — the same trick `AdultGate`'s `TextField` already uses. |
| Apple reports an **all-zero AAGUID**. | Never branch on it, never name the authenticator model. Label passkeys by a user-supplied *device* name at registration ("iPad i stuen"). |
| The WebAuthn system sheet **fails outright if the iPad has no passcode/biometrics**. | Handle it with a Danish message, not a crash. |
| Clock skew on an old iPad. | No `nbf`, never validate `iat`, `clockTolerance: 120`, and the client tracks expiry from the **relative** `expiresIn` (§4.6). |
| **Timers are throttled in a backgrounded PWA**, so "refresh every 10 min" is unreliable. | Refresh on `visibilitychange:visible` and lazily before use, not only on an interval. Mirrors the existing audio-system handling. |
| iOS cross-device passkey flows require re-scanning a QR every time (no persistent linking). | No cross-device passkey story; per-device enrolment + Google as the portable method. |
| No service worker (network-only) and `swCleanup` deletes every Cache Storage entry on boot. | Never cache auth state in Cache Storage. And see §4.7 — this is why cold offline launch cannot work. |
| The blanket `no-store` on `/(.*)` also covers `/api/auth/*`. | That is exactly what you want (no CDN or browser caching of session responses). Leave it; don't "optimise" `/api` caching later. |
| `residentKey` / `userVerification` / `attachment` choices. | `residentKey: 'required'` (what makes username-less unlock possible), `authenticatorAttachment: 'platform'` (Face ID/Touch ID; iCloud Keychain still syncs it, so this is not device lock-in), `userVerification: 'required'` (safe *because* attachment is platform — Apple always performs UV; it would be wrong with security keys allowed), `attestation: 'none'` (Apple returns none anyway). |
| Page roots set `userSelect: 'none'` / `WebkitTouchCallout: 'none'`; inheriting breaks iOS selection and paste. | Explicitly set `userSelect: 'text'` on any auth input. |
| Landscape-first, `orientation: any`, `--vh`, safe-area insets. | Lock screen and PIN pad use `HomePage`'s root recipe; verify at 844×390 and 667×375 per `.claude/rules/responsive-design.md`. |

---

## 10. Codebase traps — each of these will bite

1. **Module-import-time hydration → the "who am I?" ordering problem.** The store hydrates in its constructor on first
   `import`, before React, the router and the gate. Inert-by-default is the only correct ordering. Corollary:
   `getSnapshot` must return a **stable frozen module constant** for the inert state — returning a fresh
   `defaultState()` per call is an infinite `useSyncExternalStore` re-render loop.
2. **The debounced write is not key-aware.** Flush-before-swap is necessary but the payload must also be bound to its
   key at schedule time (§5.4). A single missed ordering writes one child's book over another's.
3. **First-paint theme flash.** `ThemeProvider.tsx` reads localStorage in a `useState` initialiser during the very
   first render. Keep `bornelaering-theme` as a device-level **hint** written on every theme change, make
   `settings.themeId` the truth, and rely on the gate covering the screen during the swap so the flash is invisible.
   **Do not** replace the synchronous hint read with an async fetch — that flashes white on the dark immersive skins.
4. **The v3 hard reset lives in `normalize()`, not in a migration slot.** Its comment justifies the reset for v1→v2 and
   v2→v3 (random sticker pools genuinely couldn't be mapped). v3→v4 is a *pure structural* upgrade. Replace with the
   version-directed chain and never write to the legacy key.
5. **`structuredCloneState()` is an implicit whitelist.** It hand-enumerates every field and hard-codes
   `version: SCHEMA_VERSION`. Any v4 field you forget to add is **silently dropped on the next commit** — appearing
   minutes later as data loss with no error. Replace it with native `structuredClone(s)` (Safari 15.4+, well under the
   iOS 17 floor; fine in Node 22) and delete the whitelist. Blobs are a few KB and commits are per-task.
6. **Non-React consumers are fine — but only because they re-read on notify.** `sfxClient` and `musicClient` cache a
   derived boolean and refresh it in a `subscribe` callback, so `attach()`'s notify updates them for free.
   `musicClient`'s `if (next === this.enabled) return` means a music-on profile attaching over the music-on inert
   default fires no `resume()` — which matches today's behaviour (resume waits for a gesture), so leave it.
   `bugReporter` reads lazily and is automatically correct.
7. **`devHarness` runs pre-attach.** `main.tsx` fires `installDevRewards()` at import; against an inert store its
   `resetAll()`/`grantXp()`/`grantPendingRewards()` chain becomes a silent no-op and the `?rewards=n` screenshot
   harness dies without an error. Gate it behind `await progressStore.whenAttached()`, and consider `?profile=<id>` to
   auto-select a dev profile so `?rewards=n&theme=x` chains still work headlessly.
8. **The cross-tab comment's premise is now false** (§5.7). Replace both the code and the comment, and handle the
   profile pointer changing (sign-out / switch child in another tab must re-lock this tab).
9. **The invariant is an inequality, not an equality.** `progressStore.test.ts` asserts equality, but only ever *after*
   `grantPendingRewards()` drains the debt. The true invariants are
   `grantedSlots ≤ collectedFromLevel(globalLevel())` and `owedRewards() ≥ 0`. A merge that "restores the equality"
   destroys the pending ceremony. Encode both, and their gap, in `progressInvariantViolations`.
10. **`RewardWatcher` is a live tripwire during profile switches.** Mounted at app root, keyed on `globalXp` +
    `lastCelebratedLevel`. Attaching a profile with pending debt correctly fires the deferred ceremony on the next menu
    (the safety net working). A *merge* that jumps the level without debt fires an **empty** ceremony (§6.3).
11. **`normalize()`'s off-path pruning manufactures debt.** It deletes collected ids not in `ON_PATH`, which decrements
    `Σ counts` and therefore `grantedSlots()`, creating phantom `owedRewards()`. Latent today; guaranteed to fire the
    first time someone edits `stickers.ts`. A stored slot cursor is structurally immune — a free win.
12. **`attach()` must be idempotent for StrictMode.** `main.tsx` renders under `React.StrictMode`; effects
    double-invoke in dev.
13. **Node-importability discipline.** `progressStore.test.ts` imports the real singleton under `node --test`, so every
    module in that graph needs explicit `.ts` extensions on relative imports, `import.meta.env?.` with the optional
    chain, and `typeof window === 'undefined'` guards. `progressSchema.ts` and `progressMerge.ts` inherit all three.
14. **Quota.** `tts_audio_cache_v2` already budgets ~2.8 MB against a ~5 MB origin limit and has a
    `QuotaExceededError` retry path. N small profile blobs are fine; profile-scoping the TTS cache would blow it.
    `progression.explored` is the only unbounded-ish field and is what will eventually push the sync payload past the
    64 KB `sendBeacon` cap.
15. **`api/` and `lib/` are NOT type-checked by `npm run build`** — `tsconfig.json` includes only `src`. Server-side
    type errors are invisible until runtime, which is unacceptable for auth code. W0 adds `tsconfig.api.json` and
    `npm run typecheck:api`.
16. **A running dev-server holds shared config in memory.** After editing `lib/auth.ts` or any `shared-*.js`, kill the
    process on 3001 and restart, or you verify against stale values. A `curl` 200 only proves *something* is listening,
    and starting a second instance silently no-ops on a bound port.

---

## 11. Work packages

Each ends at a working, committable state. **W0–W4 are independently shippable**: after W4 the app is gated and
signed-in with a single implicit profile and no sync, which is already a complete improvement. **Commit at every
boundary.**

Ordering rationale: **de-risk the two platform unknowns first** (Web handler + catch-all routing) before any feature
code exists; **ship the paid-endpoint gate early** because it's the requirement with money attached; and build
**Google sign-in last among the auth methods**, because a broken OAuth leg must never be the thing that locks the
family out of their own app.

| # | Package | Done when |
|---|---|---|
| **W0** | Provision Neon (Frankfurt) + the Google OAuth client; env vars into Vercel and `.env.local`; `regions: ["fra1"]`. Add `tsconfig.server.json` (`include: ["lib","api"]`, `noEmit`) wired into `npm run build` as `tsc -p tsconfig.json && tsc -p tsconfig.server.json && vite build` (§10.15). | `npm run build` type-checks `lib/` and `api/`; Neon reachable. |
| **W1** | **Skeleton, to prove the platform.** `lib/env.ts`, `lib/db.ts`, `lib/auth.ts` with **only** the bearer plugin; `api/auth/[...all].ts` (`fetch` export); the `dev-server.js` mount (move `express.json()` down, `*splat`). | `get-session` returns `null` in dev **and on a preview deploy** — this proves the web handler and the catch-all routing before anything is built on top. Also `curl -i -X POST /api/auth/sign-in/social` to confirm the `Set-Cookie` premise of §4.5. |
| **W2** | **All pure modules + tests, zero infrastructure:** `authGatePolicy`, `pinPolicy`, `redact`, `accessToken`, `pinHash`, `progressSchema`, `progressMerge`. | Everything green under `node --test`, including the merge algebra and the v3 fixture. |
| **W3** | **The paid-endpoint gate — ship this early.** `lib/access-token.ts`, `lib/paid-guard.ts`, `/family/access-token`, `authorizedFetch` + the 5 call-site conversions, dev bypass, `Allow-Headers`, `rateLimit` `subject`. | `curl` without a token → 401 `need_access_token`; forged token → 401; valid → 200. Bypass works with `AUTH_DEV_BYPASS=1` and is provably impossible when `VERCEL` is set. |
| **W4** | `authStore` + `AuthContext` + `AuthGate` + `LockScreen` + `OfflineNotice`, mounted in `main.tsx`/`App.tsx` (audio permission **inside** the gate, so only one blocking overlay shows at a time). DEV bypass: `devNoAuth()` where **`?nogate=1` also implies no-auth**, so every existing `ui-screenshot` recipe keeps working unchanged. | App is hard-gated; `ui-screenshot` still drives every existing screen; two known recipes diff clean against `docs/ui-reference/`. |
| **W5** | PIN: `PinPad`, `PinDialog`, `requirePin` routing table, server hash + `pin_attempt` lockout, local PBKDF2 verifier, mandatory onboarding setup. **Delete `AdultGate.tsx` + `makeGateCode()` + `DANISH_DIGIT_WORDS`** and rewire `AdultCorner` (incl. the `authUiOpen` screenshot suppression). | PIN gates the adult menu; lockout demonstrably works incl. correct-PIN-inside-lock-window; no reference to `AdultGate` remains. |
| **W6** | Passkeys: gesture-safe register + unlock with **pre-fetched** options, RP-ID env plumbing, preview disable. | Face ID works on the 17.7 iPad in Safari **and** installed-PWA. CDP virtual-authenticator test green. |
| **W7** | **Google sign-in:** the cookie-free PKCE pair, `flowId` claim, polling recovery, `WrongContextNotice`, and the `AUTH_ALLOWED_EMAILS` hook (§4.8). | Sign-in completes on the installed iPad PWA; a wrong `flowId` never yields a token; claiming twice → 410; a non-allowlisted email is refused. |
| **W8** | `deviceId.ts`; the store surgery (inert default, `attach`/`detach`, key-safe writes, persisted-form mutators, `derive`, `structuredClone` replacing the whitelist); update `progressStore.test.ts`. **This is where `SCHEMA_VERSION` becomes 4 — only after W2 is green.** | All pre-existing economy tests pass unmodified in substance; **`StickerAlbum.tsx` untouched**. |
| **W9** | `profileStore` + `useProfiles` + profile picker + PIN-gated switching + theme profile-scoping; then `legacyAdoption.ts` + `AdoptLegacyDialog`. | Two profiles coexist with separate books; the detached DEV warn never fires. **On a copy of the owner's real blob:** the son's 45-reward book, level, gold-pass position, difficulty overrides and explored set survive byte-for-byte; adopting twice is a provable no-op; the legacy key is unmodified afterwards. |
| **W10** | `api/progress.ts` + `progressSync.ts` + `useSyncStatus` + the `☁️ Synkronisering` line + `👤 Profiler` + `🔑 Login og sikkerhed` + profile/account deletion. | Two browsers converge; airplane-mode play then reconnect loses nothing and double-counts nothing; two devices offline concurrently → XP sums exactly; a reset on A survives a pull from B. |
| **W11** | Bundle hygiene (`auth-vendor` in `manualChunks` — one line, it's a function in Vite 8), a CSP header in `vercel.json` (the app ships none today), re-capture `docs/ui-reference/`, update `CLAUDE.md`, `.claude/rules/api-endpoints.md`, the `ui-screenshot` skill doc, and add `.claude/rules/auth.md`. | `npm run build && npm run lint && npm test` green; screenshots refreshed. |

**Phase B (optional, later):** promote `totals.totalStars`, `perGame.roundsCompleted` and `perGame.lifetimeCorrect` to
the ledger — a trivial v4→v5 "existing totals → `ledger[thisDevice]`" migration.

---

## 12. Verification

- **Unit (`npm test`, `node --test`)** — pure modules only, in the style of `src/config/progression.ts` and
  `src/contexts/audioPromptPolicy.test.ts`:

  - `progressMerge` — **algebraic laws** (`merge(a,a) ≡ a`, commutative, associative: these three tests are the licence
    for lock-free `applyRemote`); `progressInvariantViolations(merged) === []` across (fresh, mid-book, exactly-45,
    gold-pass) × (ahead, behind, concurrent); `totalSlots(merged) ≥ max(totalSlots(a), totalSlots(b))` (never loses a
    reward); the 200+200 → 400 XP / 10 slots concurrency case; gold-pass cursor preserved for a level-60 player; reset
    wins (`epoch=1` empty vs `epoch=0` fat → empty); repeated merge is stable over 5 applications; `newIds` never
    resurrects; a hand-written realistic **v3 fixture** (45 rewards, gold pass, difficulty overrides) migrates with
    zero loss.
  - PIN policy — trivial-PIN rejection, lockout escalation.
  - Diagnostics redaction — a synthetic auth request never appears in the ring.
  - `authGatePolicy` — the truth table, especially `invalid` beating grace, `unreachable` inside/outside grace, and
    `unknown` + token ⇒ optimistic `authed`.
  - `accessToken` — sign→verify round trip, expired, wrong `aud`, wrong `iss`, tampered signature, and a ±90 s clock
    offset passing while ±300 s fails.
  - `pinHash` — round trip, wrong PIN, pepper change invalidating an old hash, and that `scryptSync` at N=16384 stays
    under Node's default `maxmem`.
- **API (`curl` against `http://127.0.0.1:3001`)** — per `.claude/rules/api-endpoints.md`. Note §10.16 about stale
  in-memory config. Beyond the basics:
  - **`/api/tts-azure` with no `Authorization` ⇒ 401 `need_access_token`; forged JWT ⇒ 401; valid ⇒ 200. This is the
    single most important assertion in the whole PRD** — it is the one that stops a stranger burning Azure credit.
  - `AUTH_DEV_BYPASS=1` ⇒ 200 without a token; unset ⇒ 401; and assert the bypass is impossible when `VERCEL` is set.
  - PIN: 4 wrong ⇒ 401 with `attemptsLeft`; 5th ⇒ 423 with `lockedUntil`; **correct PIN inside the lock window ⇒ still
    423**; after expiry ⇒ 200 and the counter resets.
  - `oauth/claim` with a wrong `flowId` ⇒ 404/410, never a token. Claim twice ⇒ second is 410.
  - `POST /api/auth/*` before **and** after moving `express.json()` — proves the ordering trap is genuinely fixed
    rather than accidentally working.
- **UI (`ui-screenshot` skill)** — start both dev servers **in Windows PowerShell, not WSL** (a WSL-launched Vite makes
  every `/api` call 502). Lock screen, PIN pad, profile picker and the reworked adult menu across all 4 registered
  skins, plus phone (844×390, 667×375) and reduced-motion, using `?nogate=1` to reach existing screens. Also:
  - Assert the gate actually blocks: load `/alphabet/quiz`, wait for `Log ind`, assert the game board is absent.
  - **Passkey register + unlock headlessly** via CDP's WebAuthn domain — `WebAuthn.enable` +
    `WebAuthn.addVirtualAuthenticator({ options: { protocol:'ctap2', transport:'internal', hasResidentKey:true,
    hasUserVerification:true, isUserVerified:true } })`. A small `cdp.mjs` addition that exercises the real plumbing.
    **It does not prove the Safari gesture rule** — only the iPad can.
  - Assert `data-bl-redact` is present on the PIN surface and that the hold gesture is inert while it is open.
- **Real-device — the only place the real risks live.** The owner's **iPadOS 17.7** iPad, installed to the home screen:
  Google sign-in end-to-end (watch whether the in-app browser hands back — the polling recovery is what you're really
  testing), passkey register + unlock (the gesture rule), airplane mode with the app resident ⇒ still playable with
  narration falling back to prebaked, and airplane mode + force-quit ⇒ **document what actually happens** (expected:
  the document fetch fails, per §4.7).
- **Prod smoke after deploy** — `curl -I` the auth route to confirm it resolves to the function and not the SPA
  fallback. The `functions` glob and the rewrite-vs-filesystem question both look fine locally and can only be proven
  in prod, exactly as `.claude/rules/api-endpoints.md` warns about `vercel.json` headers.

**The gate that matters most is W8's.** Run it against a real copy of the son's blob before anything ships, and keep
`bornelaering-progress` on disk permanently.

---

## 13. Risks & accepted trade-offs

| Risk | Handling |
|---|---|
| **Passkeys are bound to `*.vercel.app`** (D8). | RP ID is an env constant; migration documented; Google + PIN remain non-breaking fallbacks so a domain move can never lock anyone out. |
| **Session token in localStorage** is more XSS-exposed than httpOnly (better-auth's docs flag this). | Accepted: no UGC, no third-party scripts, no analytics. CSP added in W11. Relying on a cookie surviving the installed-PWA OAuth hop is the larger risk. |
| **Concurrent offline play** would lose rewards under a naive `max()` merge. | Per-device G-Counter ledger for xp/slots/bloom (§6.2b). Phase A leaves three cosmetic counters on `max`. |
| **Schema v3's `normalize()` hard-resets on mismatch** — a naive bump wipes the son's book. | W5 before W6: the migration test must be green **before** `SCHEMA_VERSION` changes. Never write to the legacy key. |
| **Cross-key write during a profile switch** silently corrupts a sibling's book. | Payload bound to its key at schedule time (§5.4). |
| **`structuredCloneState()` silently drops unlisted fields.** | Replaced with native `structuredClone`. |
| **Single long implementation session** (D10). | W0–W4 independently shippable; store surgery gated behind a green migration test; commit at every boundary. |
| **Email OTP deferred** (D3) — Google is the only bootstrap method. | A friend without a Google account cannot be onboarded in v1. This is the trigger for buying a domain. |
| **Preview deployments have no sign-in method** — passkeys can't work (RP ID / PSL), Google redirect URIs can't be wildcarded, OTP is deferred. | Register the deterministic branch alias as an extra redirect URI (§4.9), and accept that passkeys are prod-and-localhost only. `AUTH_DEV_BYPASS` must never be set on Vercel. |
| **"Playable offline" is already false** for a cold launch (no service worker + `no-store` on `/(.*)`). | Documented honestly in §4.7 rather than implied away. A real offline story is a separate service-worker PRD. |
| **Two external better-auth facts are load-bearing** — that `storeStateStrategy` sets a state cookie, and that `signInSocial({ idToken })` auto-creates users and returns `set-auth-token`. | Both are verified in **W1** with `curl` on a preview, before any UI is built on them. Fallback for the second: `internalAdapter.createUser` + `linkAccount` + `createSession` inside the plugin. |
| **A future custom domain invalidates every passkey.** | Keep Google (and later OTP) first-class forever; never let the UI imply passkeys are the primary method. |
| **`rateLimit()` is per-instance in-memory** and cannot protect a 4-digit PIN. | Attempt counters persist in `account_pin` with escalating lockout. |
| **Per-child reset is a product change.** | Confirm copy must name the child, or a parent nukes the wrong book. |

---

## 14. Deferred to a later phase

Email OTP (needs a domain — see D3), Sign in with Apple (needs a paid Apple Developer membership), custom-domain
migration and the associated passkey re-enrolment, the GDPR policy layer (privacy page, data export, consent capture,
retention/purge), a device list with per-device revocation, family/invite sharing, and Phase B of the sync ledger.
