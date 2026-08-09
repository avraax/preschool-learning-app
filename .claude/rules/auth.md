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
  - "src/config/avatars.ts"
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
- **Production is `boernelaering.dk` since 2026-08-07** (was `preschool-learning-app.vercel.app`, which
  still serves as a fallback). The switch is env-only — `BETTER_AUTH_URL` + `WEBAUTHN_RP_ID` in Vercel
  production — because `origins` is an array and `baseURL()` checks `BETTER_AUTH_URL` first.
  **Changing `WEBAUTHN_RP_ID` INVALIDATES every registered passkey**: a credential is bound to the RP ID,
  so existing ones must be deleted and re-registered on each device. Google sign-in is the way back in,
  which is why it must keep working before the RP ID moves. A domain move therefore needs, in this order:
  the new redirect URIs added in the Google console (BOTH paths — `/api/auth/family/oauth/callback` and
  `/api/auth/callback/google`), then the env vars, then a **redeploy** (env never reaches a live
  deployment), then re-registration. Never move the RP ID before the redirect URIs exist.
- **The PIN lockout is checked BEFORE the hash is compared**, so a CORRECT PIN inside a lock window is
  still refused. `pinAttempt` lives in Postgres precisely because `lib/server-utils.ts`'s `rateLimit()`
  is a per-instance in-memory Map. Don't "optimise" either away — for a 10 000-value keyspace the pepper
  and the persisted lockout are the only real controls.
- **The local PIN verifier is cached ONLY after a successful ONLINE verify on that device**, and dropped
  when `/family/status` reports a newer `pinUpdatedAt` (else a PIN changed on the iPhone is honoured on
  the iPad forever) and on sign-out.
- **`requirePin(reason)` is ONE table** — `pinVerifierFor`, now in the PURE `src/config/pinReasons.ts`
  and re-exported from `AuthContext` so every call site is unchanged. It moved out of the `.tsx` so a
  plain-Node test can read it: `src/config/adultSettingsIa.test.ts` asserts every account-scoped
  destructive SETTING resolves to the server verifier, and a test that re-declared the server set
  itself would pass vacuously. Local authorises anything whose blast radius is this device's local
  state; SERVER is required whenever the outcome is a credential, a spend, or an account-scoped
  mutation.
- **Never add request-body capture to diagnostics.** The PIN travels in a POST body. `redact.ts` keeps a
  registry of live secret strings (caught by identity, not pattern); `sanitizeUrl` strips the whole
  query+fragment on `/api/auth`. Auth surfaces carry `data-bl-redact`, `screenshotService` removes
  those nodes, the ⚙️ corner tap is inert while an auth dialog is open, and `PinPad` renders dots.
- **CLEAN SHEET, no migration.** The owner chose to reset all progress at the accounts release, so
  there is deliberately NO v3→v4 migration and no legacy-adoption flow. A non-v4 blob normalises to
  `null` and the child starts fresh; `src/utils/storageReset.ts` sweeps the pre-accounts keys, the
  cached roster and the cached local PIN verifier ONCE per device (marker-guarded, same shape as
  `swCleanup`). Sweeping the roster + verifier is not cosmetic: without it a device keeps offering
  stale child profiles and keeps honouring a PIN the server no longer has. Nothing is ever
  pre-added — an account with no children gets the mandatory create dialog.
- **The OAuth callback answers with a 302, never a page that scripts itself.** `vercel.json`'s `/(.*)`
  header rule applies `script-src 'self'` to EVERY path, API routes included (`curl -I` the deployed
  callback to see it). The callback used to hand back via an inline
  `<script>location.replace('/#bl_auth=1')</script>`, and W11's CSP shipped *after* it — so the automatic
  return silently died and the adult had to notice the link and tap it. No error, no log, and only
  reachable through a real Google sign-in. A 302 from inside a `createAuthEndpoint` handler passes
  through better-auth's router untouched (verified with curl). Guarded by `lib/server-html-csp.test.ts`:
  no server-generated HTML may contain a `<script>` tag.
- **Sign-out is a SUBSCRIPTION, not a call at the buttons.** `authStore.clearLocal()` fires
  `signOutListeners`, and `profileStore` registers `signOut()` there at module scope. That covers the
  path no component can intercept — a 401 on a background validate — and it is why the child gets
  detached and the cached roster dropped at all. Before it, signing out left `progressStore` attached to
  the previous adult's child and the roster on disk, so the next adult briefly played as that child.
  `authStore` cannot call `profileStore` (the import points the other way); keep it a subscription.
  `AuthGate` deliberately does NOT detach when the gate blocks — `<App />` is unmounted there, so no game
  exists to write anything.
- **What sits ABOVE the gate runs before login, so app-wide side effects must be GATE-REPORTED, not
  route-inferred.** `AppThemeProvider` is above `AuthGate` in `main.tsx` and it starts the music bed;
  the lock screen lives at `/`, which is a menu path, so the bed played over the login screen and
  through the whole Google round trip while being perfectly correct about the route. `AuthGate` and
  `ProfileGate` therefore call `musicClient.setGateBlocking(...)` — the gate is the only thing that
  knows. Anything else a pre-gate provider can kick off (audio, sync, timers) needs the same shape;
  `authUiOpen` covers the *overlay* question, not this one.
- **And the inverse: what sits BELOW the gate does not EXIST before login.** `AuthGate` renders
  `LockScreen` *instead of* its children, so anything mounted inside `<App />` is absent from the one
  screen an adult sees while signing in. The backend badge shipped that way — invisible at exactly the
  moment you most want to know which backend you are handing credentials to — and moved to `main.tsx`,
  above the gate (guarded in `backendTarget.test.ts`). Guest auto-play hides this: most cold launches
  render the app, so the gap only appears after an explicit sign-out.
- **"No children" and "we haven't asked yet" are different states.** `AccountState.rosterSettled` is true
  only once a roster refresh has ANSWERED (either way), and `contexts/profileGatePolicy.ts` — pure, like
  `authGatePolicy` — is what decides between nothing / the picker / the mandatory create dialog. Reading
  `profiles.length === 0` directly raised the UN-DISMISSIBLE create dialog for the length of every cold
  boot's `/api/profiles` round trip, and since `storageReset` wipes the cached roster once per device,
  that was the accounts release's first impression on any account whose children were made elsewhere.
- **The resume path is throttled, and publishing is change-gated.** `visibilitychange:visible` fires on
  every iPad app switch. `validate()` dedupes in-flight callers and skips a verdict that is still fresh;
  `refreshStatus()` is throttled independently and takes `force` (pass it after a PIN set, a passkey
  change, or a new session — the mandatory PIN nag hangs off that answer); `persist()` throttles timestamp-only
  writes; and `publish()` drops a notify whose snapshot is materially unchanged, since `AuthProvider`
  sits above `<App />` and every publish re-renders the whole app.
- **Logging out lives in the Konto pane's destructive strip, and the lock phase is UNREACHABLE.** The owner
  chose a plain "Log ud" over a "Lås appen" action, so `authStore.lock()` has no caller and
  `phase: 'locked'` — LockScreen's "Velkommen tilbage" branch, "Brug kode i stedet", and
  `pinVerifierFor('unlockSession')`, the one row that depends on connectivity — is dead by decision, not
  by accident. The machinery stays for a future idle auto-lock (`authGatePolicy` reserves
  `idleSinceMs`); do not read that branch as live. **"Log ud" and "Log ud alle steder" take NO PIN**
  (owner, 2026-08-09): both are account-scoped and destructive but REVERSIBLE and destroy nothing, the
  adult already passed the parental gate to reach the pane, and the confirm names the account — so a PIN
  asked the same question twice. They declare `verify: { kind: 'confirm' }`, and
  `adultSettingsIa.test.ts` pins that exemption to exactly those two ids, so it cannot spread to a
  credential change or to account deletion. What the PIN silently ALSO bought was proof the device was
  online (a server verify) at the moment of signing out; that is now stated where it belongs — the
  confirm warns when `status.dirty` or the sync is offline instead of promising "al fremgang er gemt"
  and hoping. It still confirms first because the consequence lands on the CHILD, and still pushes
  progress before clearing the token. `pinVerifierFor('revokeSessions')` consequently has **no caller** —
  kept, like `lock()`, for the next account-scoped mutation; do not read it as live. Account deletion
  sits beside them in the same strip and keeps both its typed word and its PIN pad (Settings PRD-01
  gathered them; "Login og sikkerhed" as a separate panel is gone).
- **Auth overlay stacking lives in `src/components/auth/authOverlayZ.ts`.** The lock screen and the
  profile picker are hand-rolled `fixed` boxes at ~10 000; a MUI `<Dialog>` defaults to **1300**. So a
  dialog opened FROM one of them mounts *underneath* it — live, interactive and invisible, which is a
  dead button with no error anywhere. That is why the lock screen's "Brug kode i stedet" never worked and
  why the picker's "Tilføj et barn" was hidden (both measured with `elementFromPoint` at the surface's
  centre, before and after). Never write a z-index literal in that directory.
  **A PIN surface can also live OUTSIDE that directory** — the account-deletion pad sits in the adult
  settings tree, where it and the settings Dialog were both at MUI's 1300 and the pad won only by DOM
  order. `authOverlayZ.test.ts` therefore sweeps all of `src/` for a `<PinPad>` inside a `<Dialog>`
  without `zIndex: AUTH_Z.pin`, **with comments stripped first**: a prose mention of the constant in the
  "why" comment above the fix satisfied a plain `includes()` and kept the guard green after the fix
  itself had been removed.
- **The DEV bypass attaches a stand-in child** (`DEV_PROFILE`, id `dev-local`, in `profileStore`).
  `?nogate=1` has no account and never will, so without it `progressStore` stays inert — `?rewards=n`
  awaits `whenAttached()` forever and the mandatory create dialog covers every screenshot recipe. It is
  never written to the roster cache, and `progressSync` already refuses to sync under the bypass.
- **better-auth ANSWERS with its errors; it does not throw them, and it rewrites the ones it forwards.**
  Two separate traps, both of which shipped as "handled" code that could never run:
  `asResponse: true` makes better-call **return** an `APIError` converted to a Response
  (`dist/endpoint.mjs`), so a `try/catch` around `signInSocial` is dead — read `res.status` and the JSON
  body instead. And the allowlist hook's `FORBIDDEN` never arrives as one: `handleOAuthUserInfo` reduces
  it to `{ error: <message> }` and `sign-in.mjs` re-throws `APIError.from("UNAUTHORIZED", { message,
  code: "OAUTH_LINK_ERROR" })`, so **the status and the code are both discarded and only the MESSAGE
  survives**. `ALLOWLIST_REFUSED_MESSAGE` is therefore a contract shared by the hook and
  `classifySignInFailure`, not copy. Consequence to remember: every distinct OAuth failure looked
  identical for weeks, and the refusal copy was unreachable — twice, because the first fix only addressed
  the first trap.
- **Apple's expected `aud` is `audience` OR `appBundleIdentifier`, never both.** better-auth resolves
  `options.audience?.length ? options.audience : options.appBundleIdentifier ? … : options.clientId`, so
  a bundle id **replaces** the Services ID. Our web token carries the Services ID, so setting
  `APPLE_BUNDLE_ID` alone made every Apple sign-in fail verification — silently, for the life of the
  feature. Always set an explicit `audience` array.
- **A failed OAuth callback must STAMP the flow row** (`failureCode`/`failureMessage`/`failedAt`), or it
  is byte-identical to a flow still on the consent screen and `/oauth/claim` answers `pending` to a
  corpse. The client's poll counts its give-up window in **foreground time with a per-sample cap**,
  because iOS freezes the webview behind `SFSafariViewController` and a wall-clock window discards a flow
  the server would still honour. Claim first, evaluate the window second.
- **The shell cannot be handed back with a URL the web uses.** `/#bl_auth=1` boots the whole web app
  inside the sheet; `<a href="/">` navigates the sheet. `/oauth/start` records `client`
  (`web`/`shell`/`shell-scheme`) and the callback answers accordingly. `shell-scheme` is a **capability**
  the client claims only after registering `appUrlOpen` — the scheme itself comes from a tier-keyed table
  on the server, never from the request.
- **A fake OIDC provider exists for local drives** (`lib/fake-oidc.ts`, `AUTH_FAKE_PROVIDER=1`), gated on
  the flag + runtime + tier and refused at four doors. `.claude/skills/ui-screenshot/oauth-probe.mjs`
  drives every branch; budget one full run per 10 minutes against `/oauth/start`'s rate limit. It is what
  found the `OAUTH_LINK_ERROR` rewrap above, so reach for it before reasoning about a sign-in branch.
- **`set-auth-token` is the SIGNED cookie value** (`<rawToken>.<hmac>`), NOT `session.token`.
  `internalAdapter.findSession()` takes the RAW token, so the OAuth claim must split on `.` first —
  looking the signed value up returns null and bounces the adult back to the lock screen *after* a
  successful Google sign-in. The bearer plugin accepts EITHER form on the way IN, which is why the
  passkey path (same signed value handed straight to the client) always worked. Guarded by
  `node --env-file=.env.local scripts/auth-probe-claim.mjs`, which parks the signed shape a real
  callback produces — seeding a RAW token is precisely how this hid behind a green test.

## Sign in with Apple — required, and shaped differently from Google

**App Store Guideline 4.8** wants a second login option collecting no more than name + email and
letting the address stay private, whenever a third-party service sets up the primary account.
**Passkeys do not satisfy it** — they can only unlock an account that already exists — so Google-only
was a submission risk *and* a dead end for an adult without a Google account. Apple rides the same
cookie-free flow; only these differ:

- **Apple POSTs.** `response_mode=form_post` is mandatory once any scope is requested, so it gets its
  own `method: 'POST'` callback path (register that exact URL in the developer portal). Everything
  after the code — state lookup, replay refusal, pre-flight state invalidation, exchange,
  `signInSocial({ idToken })`, parking — is shared in `completeOauthCallback`, and the **provider is
  read off the stored flow row, never off the request**, so a caller can't choose the token endpoint.
- **The client secret is a JWT we sign** (`lib/apple-client-secret.ts`), not a stored string, and it
  expires. `crypto.sign` defaults to **DER**, which is a valid ECDSA signature and an invalid JWS —
  `dsaEncoding: 'ieee-p1363'` is what makes it a 64-byte `r‖s`. `sub` is the **Services ID**, `iss` the
  Team ID. Every one of those mistakes returns the same `invalid_client`, which reads like a wrong key.
- **`appleUsable()` is the single gate** — configured *and* the key actually signs. `apple().enabled`
  only means four env vars are non-empty; a malformed `.p8` passes it and dies at the exchange with
  the adult blaming their Apple ID. The provider config is also built in a try/catch at module init,
  because `createPrivateKey` throwing there would take down **every** auth route, not just Apple.
- **Hide My Email** mints an `@privaterelay.appleid.com` address, which `AUTH_ALLOWED_EMAILS` refuses
  (it fails closed). Correct, and worth knowing before you read it as a bug.

**`/family/status` cannot answer "which sign-up buttons exist"** — it is session-gated, and the adult
who needs that answer has no session. Gating the Apple button on `info.methods` hid it on the only two
surfaces that create an account. The unauthenticated **`/family/providers`** + `signUpProviders.ts`
is that answer, and it **fails toward `['google']`**: a missing button, never one that cannot work.

## Guest play (no account), and the effect-order trap it exposed

App Store Guideline 5.1.1(v) requires the app to open playable without a login, so `authGatePolicy` has
a **`guest`** phase (full play, `canCallPaidApis: false`) and `profileStore` attaches a fixed local child
`local-guest`. Cheap only because `progressStore` was already inert-until-`attach()`: guest is a new
CALLER, not a second progress path, and `canSync()` already requires a session token so no sync branch
was needed. Device-scoped flags in `utils/guestMode.ts`.

- **`canCallPaidApis: false` is the same control as `AUTH_ALLOWED_EMAILS`, not caution.**
  `/api/tts-azure` bills per character and `/api/stt` per second. A guest costing nothing is what makes
  an open guest path safe to ship at all.
- **Auto-guest is decided in `authStore`'s CONSTRUCTOR, not `boot()`** — `boot()` runs from an effect,
  i.e. after first paint, so deciding there flashes the lock screen on a brand-new install.
- **React runs a CHILD's effect before its PARENT's**, and `AuthGate.GateBody`
  (`profileStore.hydrate`) is a child of `AuthProvider` (`authStore.boot()`). Harmless while a
  session-less device started `signedOut` — the gate blocked and `hydrate` early-returned. Auto-guest
  unblocks the gate on the FIRST render, so hydrate now runs BEFORE boot: `isDevBypass()` was still
  false and `?nogate=1` silently attached the guest child instead of `DEV_PROFILE`, with every headless
  recipe still passing. **Anything `hydrate` reads must be set at construction, never in `boot()`.**
- **A guest has no PIN**, so `requirePin` routes to the local verifier, finds nothing cached (it is only
  written after an ONLINE verify), falls through to a server with no account — and locks the adult out
  of "Til de voksne" entirely. The account-less gate is an arithmetic challenge
  (`src/config/guestAdultGate.ts`), which is also what Apple means by a parental gate.

## progressStore is INERT until a profile is attached

The store hydrates at module-import time, before React, the router or the gate — so it cannot know
whose data it holds. It therefore starts inert and **`profileStore` is the ONLY caller of
`attach`/`detach`**. Consequences a future change must respect:

- `getSnapshot()` returns a **frozen module constant** while detached. A fresh object per call is an
  infinite `useSyncExternalStore` loop.
- Every mutator no-ops while detached, and `grantTaskXp` returns a zero-effect result of the same SHAPE
  (a caller mid-teardown must not crash).
- `attach()` is a **pure read** and **idempotent** (StrictMode double-invokes effects).
- The debounced write **binds its payload to its key at schedule time**. Flushing before a profile swap
  is necessary but not sufficient; this is what makes a cross-child write impossible.
- Anything running before the gate opens must `await progressStore.whenAttached()` (e.g. the
  `?rewards=n` harness), or it silently no-ops.

## The `avatarEmoji` column does NOT hold an emoji

It holds an **avatar id** (`'fox'`) from the closed set in `src/config/avatars.ts` — the app ships no
emoji (CLAUDE.md), so the child avatars became baked art in `src/assets/avatars/`. The COLUMN kept its
old name deliberately: renaming it means a migration against the owner's live DB for zero behavioural
gain, so the id↔column mapping lives only in `publicShape`/`cleanAvatar` in `api/profiles.ts` (mirrored
in `dev-server.js`). Expect the name to lie; don't "fix" it by writing a glyph back.

- `src/config/avatars.ts` is PURE and Node-importable precisely so the client, `api/profiles.ts` and
  `dev-server.js` validate against ONE list. Its legacy glyph→id table is written as `\u{…}` escapes so
  the file itself stays emoji-free.
- **`cleanAvatar` is an ALLOW-LIST, and its old rule was the exact opposite.** It used to reject ASCII
  letters/digits on the grounds that "an avatar is a pictograph" — backwards once avatars ARE ascii ids.
  It still accepts a known legacy glyph (so a client running older JS mid-deploy isn't rejected) but
  refuses an unrecognised one rather than defaulting.
- Reads normalise through `normalizeAvatarId`, so a row written before the swap still resolves. Writes
  only ever store an id.

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
- **`perGame` and `totals` left the document** with the round (Endless Play PRD-01 W3), so the "merge
  counters with `max`, never `sum`" rule has nothing left to govern — but keep the reason: the merge
  runs on every sync, so summing anything is non-idempotent and the numbers explode. A rolling deploy is
  safe (an old client's extra keys are simply dropped) and **`SCHEMA_VERSION` stayed 4 on purpose**:
  there is no migration path, so a bump would wipe every child's book on update.
- The merge's idempotence/commutativity/associativity tests are the **licence** for calling
  `applyRemote()` mid-round and mid-ceremony with no lock. If they regress, that guarantee is gone.
- `progressMerge.ts` + `progressSchema.ts` must stay free of `window`, `Date.now()` and `crypto`:
  `api/progress.ts` imports them directly so there is ONE merge implementation. `tsconfig.server.json`
  has no `DOM` in `lib`, which enforces this mechanically.
- **`markSynced` must not bump `rev`**, or the profile is permanently dirty and push-loops.
- The unload push uses `fetch(..., { keepalive: true })`, **not `sendBeacon`** — a beacon cannot set
  headers, so it cannot carry the bearer token. Either way it must not advance `syncedRev`.

## Verifying

- `npm test` — the pure modules, the merge algebra, the store surgery, and the auth guards:
  `authSignOut.test.ts` (detach on both sign-out paths, roster settling, resume throttling),
  `profileGatePolicy.test.ts`, `authOverlayZ.test.ts`, `lib/server-html-csp.test.ts`. The
  client-side auth graph is Node-importable — keep its relative imports explicitly extensioned and
  `import.meta.env?.` optional, or the suite stops loading. **Which extension differs by half:** the
  client/test graph uses `.ts`; `lib/**` and `api/**` use `.js`, because Vercel ships the compiled
  sibling (`.claude/rules/api-endpoints.md`). Getting that backwards is not a test failure — it is a
  silent production-only 500 across every accounts endpoint, which is exactly how they shipped.
- **A dead auth surface fails no test and throws no error.** Two shipped ones were only found by
  hit-testing: `document.elementFromPoint(centre of the element)` must return that element, not the
  overlay above it. Use that, not a screenshot — an obscured dialog simply isn't drawn, so the picture
  looks fine.
- **Never verify against the shared Neon DB.** It is the owner's REAL account: test rows land in his
  play-test. Two child profiles and a test PIN reached him that way. Use a scratch account, or wipe
  immediately afterwards (`scripts/auth-dev-session.mjs` creates; deleting the `user` row cascades).
  **`auth-dev-session.mjs`'s own "LOCAL DEV ONLY" banner does not protect you** — its guard is
  `runtime() !== 'dev'`, which checks where the CODE runs, not which database it points at, and
  `.env.local` holds the PRODUCTION Neon URL. So it reads as safe while minting a real year-long
  session on the owner's account (that is exactly how one got minted just for screenshots). For a
  screenshot use `?nogate=1`, which attaches a stand-in child and touches nothing.
- **Before deleting anything in that DB, re-derive the identifier FROM the DB** rather than trusting an
  id you remember from earlier in the session. A scoped query returning zero rows can mean *wrong
  scope*, not *already clean* — a stale user id read as "nothing to revoke" when the row had simply
  been recreated under a new id. List the table first, confirm the row is the one you mean, then act.
- `curl http://127.0.0.1:3001` per `.claude/rules/api-endpoints.md`. **Restart the dev-server after
  editing anything under `lib/`** — a stale instance 404s every auth route while its banner looks
  healthy. Emoji passed through curl on Git Bash arrive mangled; create profiles from the browser.
- `ui-screenshot` with `--webauthn` for passkeys and `?nogate=1` (⇒ no-auth) for every other recipe.
  `import()` inside `--eval` gets a DIFFERENT module instance than the app (Vite HMR URLs), so drive the
  real path or use the `window.__auth` / `__profiles` / `__progress` / `__sync` DEV handles.
- **The real risks only show on the iPad**: the iOS gesture rule, the installed-PWA OAuth hop, and
  whether the in-app browser hands control back (the polling recovery is what's really under test).
