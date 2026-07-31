---
paths:
  - "lib/auth.ts"
  - "lib/auth-family-plugin.ts"
  - "lib/env.ts"
  - "lib/access-token.ts"
  - "lib/paid-guard.ts"
  - "lib/pin-hash.ts"
  - "lib/session.ts"
  - "api/auth/**"
  - "api/profiles.ts"
  - "api/progress.ts"
  - "src/services/authStore.ts"
  - "src/services/authSignIn.ts"
  - "src/services/passkeyClient.ts"
  - "src/services/googleSignIn.ts"
  - "src/services/pinVerifier.ts"
  - "src/services/profileStore.ts"
  - "src/services/progressStore.ts"
  - "src/services/progressSync.ts"
  - "src/utils/storageReset.ts"
  - "src/services/redact.ts"
  - "src/config/progressSchema.ts"
  - "src/config/progressMerge.ts"
  - "src/config/pinPolicy.ts"
  - "src/components/auth/**"
  - "src/contexts/AuthContext.tsx"
  - "src/contexts/authGatePolicy.ts"
---
# Accounts, PIN, Profiles & Progress Sync

Identity for a household. One adult **account** (Google OIDC or passkey), N **child profiles** (played,
never logged into), and a **device** that is enrolled once and trusted. The child never sees an auth
screen. Implemented from `plans/accounts/tmp-prd-accounts-01-auth-profiles-sync.md`.

## Shape

```
lib/env.ts          runtime()/baseURL()/webauthn()/allowlist  — the ONE place "where am I?" is decided
lib/auth.ts         the single better-auth instance (api/ AND dev-server.js import THIS object)
lib/auth-family-plugin.ts   our endpoints as a better-auth PLUGIN + our 5 tables' schema
lib/access-token.ts + lib/paid-guard.ts     the 15-min HS256 JWT that gates the PAID endpoints
lib/pin-hash.ts     HMAC(PIN_PEPPER, pin) → scrypt N=16384
src/config/pinPolicy.ts | progressSchema.ts | progressMerge.ts   PURE, shared by client AND server
src/services/        authStore · profileStore · progressStore · progressSync · pinVerifier · redact
src/components/auth/ AuthGate → LockScreen | ProfileGate → ProfilePicker | PinPad/PinDialog
```

`npm run auth:migrate` (dry run) / `-- --apply` owns the schema — better-auth's core tables, the passkey
table, and our five (`childProfile`, `profileProgress`, `familyPin`, `pinAttempt`, `oauthFlow`).
`scripts/auth-dev-session.mjs` mints a real allowlisted session so the bearer surface is curl-testable.

## Rules that are load-bearing

- **`AUTH_ALLOWED_EMAILS` is mandatory and fails CLOSED.** A hard gate without a closed signup list
  stops nobody from completing Google sign-in on the public URL and then *legitimately* burning Azure
  and Google credit. Enforced in `databaseHooks.user.create.before` — one hook, every sign-in method.
- **The paid endpoints require the access JWT**, not a session. `/api/tts-azure` bills per character and
  `/api/stt` per second of audio. `code: 'need_access_token'` on the 401 is what tells the client to
  mint-and-retry ONCE instead of signing the adult out. Prebaked narration under `/sounds/tts/` stays
  public — only the live Azure fallback and STT are gated.
- **Bearer token, never a cookie** (`bearer` plugin, token in localStorage). An installed iOS PWA has
  its own storage jar, and with bearer transport an OAuth *redirect* has no response body the SPA can
  read — so the `flowId` handoff is structurally required, not a hedge.
- **The Google leg is our own cookie-free PKCE**, not better-auth's `/sign-in/social`. Verified with
  curl: that route answers `set-cookie: better-auth.state=…` *before any session exists*, so the cookie
  we distrust is load-bearing. The `flowId` is written into the app's OWN localStorage before
  navigating; the return URL carries only `#bl_auth=1` in the FRAGMENT. `location.assign`, never
  `window.open`.
- **iOS eats user activation across an `await`.** `registerPasskey` / `unlockWithPasskey` /
  `startPasskeyUnlock` are NON-async and take PRE-FETCHED options (refreshed ~4 min). Never use
  better-auth's own passkey client helpers — they fetch options and *then* call
  `navigator.credentials.*`. `useBrowserAutofill: false` for the same reason.
- **DEV passkeys need `http://localhost:5173`, not `127.0.0.1`** — the RP ID must be a registrable
  suffix of the page's domain, and the SecurityError reads exactly like "no Face ID on this device".
- **Passkeys cannot work on preview deployments** (`vercel.app` is on the Public Suffix List), so the
  plugin isn't registered there at all.
- **The PIN lockout is checked BEFORE the hash is compared**, so a CORRECT PIN inside a lock window is
  still refused. `pinAttempt` lives in Postgres precisely because `lib/server-utils.ts`'s `rateLimit()`
  is a per-instance in-memory Map. Don't "optimise" either away — for a 10 000-value keyspace the pepper
  and the persisted lockout are the only real controls.
- **The local PIN verifier is cached ONLY after a successful ONLINE verify on that device**, and dropped
  when `/family/status` reports a newer `pinUpdatedAt` (else a PIN changed on the iPhone is honoured on
  the iPad forever) and on sign-out.
- **`requirePin(reason)` is ONE table** (`pinVerifierFor` in AuthContext). Local authorises anything
  whose blast radius is this device's local state; SERVER is required whenever the outcome is a
  credential, a spend, or an account-scoped mutation.
- **Never add request-body capture to diagnostics.** The PIN travels in a POST body. `redact.ts` keeps a
  registry of live secret strings (caught by identity, not pattern); `sanitizeUrl` strips the whole
  query+fragment on `/api/auth`. Auth surfaces carry `data-bl-redact`, `screenshotService` removes
  those nodes, the hold gesture is inert while an auth dialog is open, and `PinPad` renders dots.
- **CLEAN SHEET, no migration.** The owner chose to reset all progress at the accounts release, so
  there is deliberately NO v3→v4 migration and no legacy-adoption flow. A non-v4 blob normalises to
  `null` and the child starts fresh; `src/utils/storageReset.ts` sweeps the pre-accounts keys, the
  cached roster and the cached local PIN verifier ONCE per device (marker-guarded, same shape as
  `swCleanup`). Sweeping the roster + verifier is not cosmetic: without it a device keeps offering
  stale child profiles and keeps honouring a PIN the server no longer has. Nothing is ever
  pre-added — an account with no children gets the mandatory create dialog.
- **`set-auth-token` is the SIGNED cookie value** (`<rawToken>.<hmac>`), NOT `session.token`.
  `internalAdapter.findSession()` takes the RAW token, so the OAuth claim must split on `.` first —
  looking the signed value up returns null and bounces the adult back to the lock screen *after* a
  successful Google sign-in. The bearer plugin accepts EITHER form on the way IN, which is why the
  passkey path (same signed value handed straight to the client) always worked. Guarded by
  `node --env-file=.env.local scripts/auth-probe-claim.mjs`, which parks the signed shape a real
  callback produces — seeding a RAW token is precisely how this hid behind a green test.

## progressStore is INERT until a profile is attached

The store hydrates at module-import time, before React, the router or the gate — so it cannot know
whose data it holds. It therefore starts inert and **`profileStore` is the ONLY caller of
`attach`/`detach`**. Consequences a future change must respect:

- `getSnapshot()` returns a **frozen module constant** while detached. A fresh object per call is an
  infinite `useSyncExternalStore` loop.
- Every mutator no-ops while detached, and `recordRoundResult` returns a zero-effect result of the same
  SHAPE (a caller mid-teardown must not crash).
- `attach()` is a **pure read** and **idempotent** (StrictMode double-invokes effects).
- The debounced write **binds its payload to its key at schedule time**. Flushing before a profile swap
  is necessary but not sufficient; this is what makes a cross-child write impossible.
- Anything running before the gate opens must `await progressStore.whenAttached()` (e.g. the
  `?rewards=n` harness), or it silently no-ops.

## The v4 document and the merge

Persisted form (`src/config/progressSchema.ts`, schema **v4**) is a composition of CRDTs; the in-memory
read model is derived from it and is **byte-identical to the pre-accounts shape**, which is why no consumer changed
(the design's acceptance test was "StickerAlbum.tsx needs zero edits").

- **XP/slots/bloom are a per-device G-Counter ledger.** A `max()` on totals doesn't merely under-count —
  it ERASES rewards another device already handed over. Two iPads at 200 XP each must yield 400 XP and
  10 slots.
- **Membership is re-derived from slots HANDED OVER, never from the level.** `collectedFromLevel(level)`
  is the debt ceiling; the gap between it and `grantedSlots` IS the pending ceremony.
- **`sync.epoch` is how `resetAll()` survives a merge.** No monotone join can express a deletion, so a
  differing epoch means the higher one wins WHOLESALE.
- **`seenThroughSlot`, not a `newIds` array** — a set union would resurrect dismissed "nyt!" badges.
- `roundsCompleted` / `lifetimeCorrect` / `totalStars` merge with `max`. **Never `sum`**: the merge runs
  on every sync, so summing is non-idempotent and the numbers explode.
- The merge's idempotence/commutativity/associativity tests are the **licence** for calling
  `applyRemote()` mid-round and mid-ceremony with no lock. If they regress, that guarantee is gone.
- `progressMerge.ts` + `progressSchema.ts` must stay free of `window`, `Date.now()` and `crypto`:
  `api/progress.ts` imports them directly so there is ONE merge implementation. `tsconfig.server.json`
  has no `DOM` in `lib`, which enforces this mechanically.
- **`markSynced` must not bump `rev`**, or the profile is permanently dirty and push-loops.
- The unload push uses `fetch(..., { keepalive: true })`, **not `sendBeacon`** — a beacon cannot set
  headers, so it cannot carry the bearer token. Either way it must not advance `syncedRev`.

## Verifying

- `npm test` — the pure modules, the merge algebra, the v3 fixture, the store surgery, legacy adoption.
- `curl http://127.0.0.1:3001` per `.claude/rules/api-endpoints.md`. **Restart the dev-server after
  editing anything under `lib/`** — a stale instance 404s every auth route while its banner looks
  healthy. Emoji passed through curl on Git Bash arrive mangled; create profiles from the browser.
- `ui-screenshot` with `--webauthn` for passkeys and `?nogate=1` (⇒ no-auth) for every other recipe.
  `import()` inside `--eval` gets a DIFFERENT module instance than the app (Vite HMR URLs), so drive the
  real path or use the `window.__auth` / `__profiles` / `__progress` / `__sync` DEV handles.
- **The real risks only show on the iPad**: the iOS gesture rule, the installed-PWA OAuth hop, and
  whether the in-app browser hands control back (the polling recovery is what's really under test).
