# PRD accounts-02 — Sign-in reliability

Follows `plans/accounts/tmp-prd-accounts-01-auth-profiles-sync.md`. Design record: `.claude/rules/auth.md`.
Authored 2026-08-09. **IMPLEMENTED 2026-08-09** — W1–W9, commits `baba625`, `3b50deb`, `ad4c358`,
`cbcb3e3`, `2c5fca8`, all on staging. See §9 for what was found to be wrong with this document.

**Read `.claude/rules/auth.md` before touching anything here** — it carries the invariants this PRD does
not repeat (the cookie-free `flowId` design, bearer-not-cookie transport, the fail-closed allowlist, the
`.js`/`.ts` extension split, the signed `set-auth-token` shape, `progressStore` inert-until-attach).

## 1. Context

Google sign-in on the TestFlight shell (`BL Staging`) fails on the first attempt and works on the second.
Apple sign-in never works: the sheet lands on a Danish failure page with a Fejlkode, and its
"Tilbage til Børnelæring" link reloads the web app *inside the sheet* instead of returning to the app.
Both leave the app not-signed-in while showing a modal that says "Du er allerede logget ind".

Everything under §2 is fact from staging bug reports and the staging Neon database on 2026-08-09, not
inference. The six root causes are independent; fixing any one alone leaves the flow broken.

## 2. Measured

Staging bug reports — `curl -s "https://staging.boernelaering.dk/api/bug-report?list=15&expand=1&key=$BUG_REPORT_READ_KEY"`
(the key is in `.env.local`; staging has had its own Blob store since 2aea46e):

| id | when (UTC) | what |
|---|---|---|
| `SA694` | 2026-08-08 21:52:42 | server: `no-session-token-after-signin`; the Google `user` row was created 54 s later |
| `TQAEF` | 2026-08-09 06:30:11 | server: `no-session-token-after-signin` |
| `8AE9T` | 2026-08-09 06:33:45 | client: `google-claim / poll-window-exhausted`, commit `29a8749`, breadcrumb `tap button Log ind med Apple` at 06:30:02 |
| `GYBAN` | 2026-08-09 06:34:04 | server: `no-session-token-after-signin` (the second Apple attempt) |

`8AE9T`'s network ring is the load-bearing evidence: `/oauth/start` 200, then `/oauth/claim` 200 at
**+1.8 s, +5 s, +9 s — then nothing for 210 s**, then the give-up at +220 s. Its API URLs are absolute
(`https://staging.boernelaering.dk/api/…`), which proves `isNativeShell()` was true: this is the shell, not
Safari. `8AE9T` and `TQAEF` are the same attempt seen from the two ends.

Staging Neon (`bl-staging`, `ep-snowy-band-…eu-central-1`), read 2026-08-09:

- `user` — exactly one row, `allanvraa@gmail.com`, created 2026-08-08T21:53:36.
- `account` — exactly one row, `providerId: 'google'`. **No Apple account has ever been created.**
- `childProfile` — one row, `avatarEmoji: 'fox'`, `name: null`. Profile creation and the avatar already work.
- `oauthFlow` — the two failed Apple flows **are still there**: `state = 'used:…'`, `sessionToken` NULL,
  `claimedAt` NULL. A failed callback leaves a row the claim endpoint reads as *pending*.
- `AUTH_ALLOWED_EMAILS` (staging) = `allanvraa@gmail.com`, nothing else. `APPLE_BUNDLE_ID` **is set** on the
  staging Vercel project.

## 3. Root causes

**RC1 — Apple's ID token is verified against the wrong audience.**
`lib/auth.ts:54-56` spreads `appBundleIdentifier: optionalEnv('APPLE_BUNDLE_ID')` into the provider config, and
that variable is set on staging. better-auth's Apple provider
(`node_modules/@better-auth/core/dist/social-providers/apple.mjs`, `verifyIdToken`) resolves the expected
audience as `options.audience?.length ? options.audience : options.appBundleIdentifier ? options.appBundleIdentifier : options.clientId`
— the bundle id **replaces** the Services ID rather than joining it. Our `response_mode=form_post` web token
carries `aud` = Services ID, so `jwtVerify` throws, `verifyIdToken` returns false, and `signInSocial` raises
`UNAUTHORIZED / INVALID_TOKEN`. The comment at `lib/auth.ts:52-53` ("harmless when unset") is true as written;
what it misses is that it is *harmful when set*.

**RC2 — `asResponse: true` swallows every APIError, so the real reason never surfaces.**
`node_modules/better-call/dist/endpoint.mjs:30-36`: with `asResponse`, an `APIError` is **returned** (converted
to an error Response), not thrown. So the `catch` in `signInWithIdToken` (`lib/auth-family-plugin.ts:941-967`) is
dead for APIErrors, `res.headers.get('set-auth-token')` is null, and every distinct failure — invalid token,
missing email, allowlist refusal — collapses into `no-session-token-after-signin` with `{}` as its detail. Two
consequences that are visible to the adult: the FORBIDDEN branch's message
("Denne konto har ikke adgang til Børnelæring.") is **unreachable through OAuth**, and the report names neither
provider nor status. This is why three reports say the same thing about two different faults.

**RC3 — A failed callback leaves the flow row indistinguishable from "still on the consent screen".**
`completeOauthCallback` returns `failureHtml(...)` without touching the row, so `state` stays `used:…` and
`sessionToken` stays NULL. `familyOauthClaim` (`lib/auth-family-plugin.ts:792`) then answers
`{status:'pending'}` — the normal "adult is still at Google" reply. The app therefore polls a permanently dead
flow until its own timer expires. Confirmed by the two orphan rows in §2.

**RC4 — The client gives up *before* trying, and its timer freezes behind the system browser.**
`src/components/auth/OAuthReturnHandler.tsx:110-132`: each tick checks
`Date.now() - current.startedAt > POLL_WINDOW_MS` (180 s) and, if so, clears the flow and reports —
**without one final claim attempt**. Meanwhile iOS suspends the shell's WKWebView while
`SFSafariViewController` covers it (measured: three polls, then a 210 s gap). The first tick after the sheet
closes therefore lands past the window and throws away a flow the server would still honour: the server's TTLs
are 10 min for the flow (`OAUTH_FLOW_TTL_MS`) and 5 min after parking (`OAUTH_CLAIM_TTL_MS`). Google's second
attempt works only because it is fast enough to stay inside 180 s. Note the 01ff1bd fix (arm the poll
unconditionally) is present in the tested build `29a8749` and is not the problem here.

**RC5 — The shell's return page is a dead end in both directions.**
Success 302s to `RETURN_URL = '/#bl_auth=1'` on the staging host, which boots the **entire web app inside the
sheet**; having no `flowId`, it correctly renders `WrongContextNotice` — "Du er allerede logget ind" — which is
exactly the modal that reads as "the app says I'm logged in". Failure renders
`<a href="/">Tilbage til Børnelæring</a>` (`lib/auth-family-plugin.ts:248-266`), a root-relative link that
navigates the **sheet**, never the app. `closeExternalAuth()` was added for the success path but only runs after
a successful claim, which is precisely what does not happen here.

**RC6 — The diagnostics cannot answer "which provider, which runtime, which attempt".**
`reportOauthFailure` carries no provider. The client auth report carries no `runtimeTarget` / tier / API origin —
the only reason we know `8AE9T` was the shell is that its network URLs happened to be absolute. And
`authDiagnostics` caps at 3 uploads per *session*, where a session is a page load; in the shell the page never
reloads, so an entire evening of attempts can yield three reports total.

## 4. Non-goals

- No change to the cookie-free `flowId` design, bearer transport, or the allowlist policy.
- No production deploy in this PRD's scope — staging only until the owner signs off.
- No automatic retry that could double-spend a flow. Single-use stays single-use.
- Passkeys stay off in the shell: `capacitor://localhost` can never match the production rpID.
- No adaptivity, no new global state, no service worker.

## 5. Workstreams

### W1 — Apple audience (server)

`lib/auth.ts`: replace the `appBundleIdentifier` spread with an explicit
`audience: [cfg.clientId, optionalEnv('APPLE_BUNDLE_ID')].filter(Boolean)`, so the Services ID (web) **and** a
bundle id (a future native sheet) both verify. `audience` wins in better-auth's precedence chain, which is the
whole point — do not rely on `appBundleIdentifier` being absent.

Tests: a source guard asserting the provider config sets `audience` and that `appBundleIdentifier` is never the
sole audience source; plus a unit test over the precedence expression copied from `apple.mjs`, so a better-auth
bump that changes it fails here instead of on the owner's iPad.

### W2 — Surface the real sign-in error (server)

`signInWithIdToken` must stop treating the Response as opaque. Read `res.status`, parse the JSON body's
`code`/`message`, and return a discriminated result (`{ ok: true, token }` | `{ ok: false, status, code }`).
Then in `completeOauthCallback`:

- 403 / `FORBIDDEN` → keep the "Denne konto har ikke adgang til Børnelæring." copy, no Fejlkode, no report
  (unchanged intent — it is now actually reachable).
- anything else → report with `{ provider, status, code }` and show a Fejlkode.

Retire `no-session-token-after-signin` as a catch-all; keep the slug only for a genuinely header-less 200 so old
report codes still resolve. Extend `lib/oauth-failure-report.test.ts`: a 401 body maps to its own reason, a 403
body produces the forbidden copy with no code and no report.

### W3 — A failed flow must fail decisively (server + client)

Add `failureCode` and `failedAt` to the `oauthFlow` schema in `lib/auth-family-plugin.ts`, write them on **every**
failure branch of `completeOauthCallback`, and make `familyOauthClaim` return **410 with the code** when they are
set instead of `{status:'pending'}`. The client already treats 410 as decisive
(`src/services/googleSignIn.ts:120-128`) — extend it to show the Danish message and surface the code on the lock
screen next to the existing "Fejlrapport sendt. Kode:" line.

Migration: `npm run auth:migrate` (dry run) then `-- --apply`, against **staging**.

### W4 — The poll must claim before it gives up (client)

`src/components/auth/OAuthReturnHandler.tsx`:

- always `await attempt()` **before** evaluating the give-up window;
- accumulate the window in **foreground time** — only advance it while `document.visibilityState === 'visible'` —
  and raise the ceiling to the server's flow TTL (10 min), so client and server agree on when a flow is dead;
- make a decisive server answer (404/410 + the W3 code) the only *silent* stop; a timer expiry stays a reported
  failure.

Extend `src/components/auth/oauthReturnPoll.test.ts` with a frozen-clock case (poll suspended 210 s, then
resumed) asserting a claim is attempted before any give-up, and a foreground-time accounting case. Run
`/re-break` on both.

### W5 — Deterministic return into the shell

The owner's requirement is minimum interaction. Two layers, in this order:

1. **Custom URL scheme — the fast path.** `/oauth/start` records the caller's client on the flow row
   (`client: 'web' | 'shell'`), and the scheme is chosen from a **server-side allow-list keyed by tier**, never
   echoed from the request body. A shell flow's callback then 302s to `bl-staging://auth?ok=1` (production:
   `bl://auth?ok=1`) instead of `/#bl_auth=1`. iOS brings the app to the front, `@capacitor/app`'s `appUrlOpen`
   fires, and the handler calls `closeExternalAuth()` and claims immediately.

   **No new registration with Google or Apple is required** — our own server issues that final redirect, so the
   `redirect_uri` registered with each provider is unchanged. That is what makes this cheap.

   Native work: add `@capacitor/app`, add `CFBundleURLTypes` to `ios/App/App/Info.plist`, have
   `scripts/set-build-tier.mjs` rewrite the scheme per tier (same treatment `CFBundleDisplayName` already gets),
   and pin both schemes in `src/config/capacitorConfig.test.ts`. **This needs a new TestFlight build to test at
   all**, and `packageClassList` in `ios/App/App/capacitor.config.json` must gain the new plugin via
   `npm run cap:sync` (never bare `npx cap sync ios`).

2. **Shell-aware pages — the guarantee, and it works in the binary already installed.** When the flow row says
   `shell`, the failure page's link becomes copy — "Luk dette vindue for at vende tilbage til Børnelæring" —
   rather than an `<a href="/">` that navigates the sheet into the web app; and the success case, when the scheme
   is unavailable, serves a tiny "Færdig" page instead of 302-ing the whole app into the sheet. Both stay
   script-free — `lib/server-html-csp.test.ts` still applies, and the CSP reason for the 302 has not changed.

W4 is the correctness guarantee; W5 is what makes it feel instant. Ship layer 2 with W4 so the current binary
improves immediately, then layer 1 with the next build.

### W6 — Diagnostics that can answer the next question

- `reportOauthFailure(reason, detail)` gains `provider` at every call site.
- The client auth report gains `runtimeTarget` (`web` | `shell`), `BL_TIER`, and the resolved API origin.
- On a FORBIDDEN refusal, report the refused address's **domain only** — `gmail.com` vs
  `privaterelay.appleid.com`. That distinguishes Hide My Email from a wrong account and is not the address;
  `redact.ts`'s rules and the never-capture-a-request-body rule are unchanged.
- `authDiagnostics`' per-session cap becomes a rolling time window (3 per 10 min), because a shell page that never
  reloads otherwise goes quiet after three faults.

### W7 — A fake OIDC provider for staging and dev (the test key)

Gated by `AUTH_FAKE_PROVIDER === '1'` **and** `runtime() !== 'production'` **and** `tier() !== 'production'` —
three independent conditions, failing closed, with a test pinning that production can never enable it (model it on
`lib/env.test.ts`'s `AUTH_DEV_BYPASS` case, which asserts impossibility once `VERCEL` is set).

It adds `provider: 'fake'` to `/oauth/start`, whose authorize URL is a local page that immediately redirects to
our own callback carrying a self-signed ID token — a key generated at boot, verified through a local JWKS — for an
address the staging allowlist accepts. That makes start → callback → claim → adopt → profile-create drivable
end-to-end by `cdp.mjs` **and** `webkit.mjs`, with no Google or Apple account involved, including every failure
branch (force a 403, a 401, a token-exchange rejection). Removable in one commit; note it in
`docs/app-store/policy-verification.md` if it ever ships anywhere but staging, which it must not.

### W8 — The scenario matrix as tests

Every row in §6 gets one of: a unit test, a harness recipe under `.claude/skills/ui-screenshot/`, or an explicit
`UNKNOWN — owner iPad only` marker with the reason. No row may be silently absent, and each states the rung its
evidence came from.

### W9 — Profile creation + avatar (pinning, not rebuilding)

The database evidence shows this path already works, so this workstream locks it down rather than changing it:
a first sign-in always reaches the **un-dismissible** `CreateProfileDialog` with an avatar preselected
(`DEFAULT_AVATAR_ID`); `avatarEmoji` can never be written NULL (`cleanAvatar` is an allow-list); `rosterSettled`
prevents the dialog flashing during a cold-boot `/api/profiles` round trip; and the guest-book adoption checkbox
is offered exactly once, default on, with its "attribution, not permission" copy intact. Order stays load-bearing:
`adoptDocument` **before** `selectProfile`.

## 6. Scenario matrix

**A — Happy paths.** A1 fresh install → guest auto-play → "Til de voksne" → Google → profile + avatar → playing.
A2 the same with Apple. A3 re-sign-in on a second device with existing profiles → picker. A4 exactly one child →
boots straight into the book, no picker. A5 passkey unlock (web/PWA only). A6 sign out → sign in again → same
child, same book, no lost XP.

**B — Interruptions.** B1 cancel at the provider's consent screen. B2 sheet dismissed after the callback but
before the claim. B3 app backgrounded >3 min mid-round-trip (the RC4 case). B4 app killed mid-round-trip → cold
boot with a pending flow. B5 the return lands in a different storage jar (installed PWA ↔ Safari). B6 two flows
started back-to-back — the second overwrites `bl-oauth-flow`, and the first must not be claimable into a
half-state. B7 network drops mid-claim. B8 device offline when the button is tapped.

**C — Refusals and errors.** C1 non-allowlisted Google address. C2 Apple + Hide My Email. C3 Apple ID address not
on the allowlist. C4 provider returns `error=access_denied`. C5 token exchange rejected (expired or malformed
Apple client secret). C6 flow older than 10 min. C7 replayed callback. C8 claim after the 5-min claim TTL. C9 5xx
during the claim. C10 `/oauth/start` rate limit (10 per 10 min) hit. C11 `APPLE_*` absent → no Apple button at
all, never a button that dies. C12 iPad clock skew (±120 s tolerance on the access JWT).

**D — Profiles.** D1 account with zero profiles → mandatory dialog. D2 avatar always set. D3 guest-book adoption
offered once, default on. D4 adoption declined → the guest book stays put. D5 adding a second child. D6 profile
creation while offline.

**E — State integrity.** E1 sign-out detaches progress and drops the cached roster. E2 a 401 on a background
validate signs out through the subscription. E3 an abandoned first attempt leaves no orphan session or dangling
flow row. E4 the shell never offers a passkey button. E5 the backend badge shows the staging host on every
staging surface, and is absent on production.

Rungs: **1** headless Chrome (`cdp.mjs`), **2** real WebKit + iPad UA (`webkit.mjs`), **3** the owner's iPad.
Anything only rung 3 can settle is written `UNKNOWN` — never inferred, never folded into a verdict.

## 7. Verification

- `npm test`, `npm run lint`, `npm run build`, `npm run context:check`.
- W7's fake provider driven end-to-end at rung 1 and rung 2, including the frozen-poll case via `?oauthflow=`
  plus a scripted `visibilitychange`, and each failure branch.
- `curl` the **deployed** staging callback for the shell-aware pages and the 410-with-code claim. Local green
  proves nothing about the deployed artifact, and this whole area is the one that has burned that rule twice.
- `npm run deploy:staging`, then confirm `/api/version`'s `commitHash` before treating any play-test as a verdict.
- Then one real Google and one real Apple round trip on the owner's iPad against staging, following §6.
- `/re-break` on every new guard before reporting anything as verified.

## 8. Owner actions and open items

1. **The Apple ID address is unverified and cannot be verified from here.** No Apple `account` row has ever
   existed, so nothing in the database names it. The staging allowlist is exactly `allanvraa@gmail.com`, and RC1
   fails *before* the allowlist is ever consulted — so the allowlist is not the current cause. After W1+W2+W6 the
   next Apple attempt reports a clean refusal naming the address's domain, which settles it. If the Apple ID
   differs, add it to staging's `AUTH_ALLOWED_EMAILS` (`env rm` then `env add` — `--force` is a silent no-op) and
   **redeploy**.
2. **Decide `APPLE_BUNDLE_ID`.** W1 works either way; leaving it set is fine once `audience` is explicit.
3. **W5 layer 1 needs a new TestFlight build** (native plugin + Info.plist). W4 and W5 layer 2 reach the installed
   binary through `npm run deploy:staging`, because the shell's API host is remote even though its bundle is not.
4. **Local dev cannot exercise Apple today** — `.env.local` has no `APPLE_*` vars, so `appleUsable()` is false and
   no Apple button appears. Pull them to a **scratch path** and copy the five lines across by hand; never
   `vercel env pull` onto `.env.local`.
5. `npm run auth:migrate -- --apply` against staging for W3's columns.

## 9. Implementation record — where this document was WRONG

Implemented 2026-08-09 in five commits. The four corrections below matter more than the plan did.

**RC2 was under-stated: fixing it did not make the FORBIDDEN branch reachable.** W2's premise was right —
`asResponse: true` returns an APIError instead of throwing — but reading the status was not enough.
better-auth does not pass our refusal through at all: `databaseHooks.user.create.before` throws
`FORBIDDEN`, `handleOAuthUserInfo` reduces it to `{ error: <message> }`, and `sign-in.mjs` re-throws
`APIError.from("UNAUTHORIZED", { message, code: "OAUTH_LINK_ERROR" })`. So the status becomes **401** and
the code becomes a generic link error. Checking status/code alone left the refusal classified as an
ordinary fault, and the adult still got "Login mislykkedes" plus a Fejlkode for a working refusal. The
MESSAGE is the only field that survives, so it is now a shared constant (`ALLOWLIST_REFUSED_MESSAGE`)
thrown by the hook and matched by `classifySignInFailure`. **W7 found this on its first run** — nothing
short of an end-to-end drive could have, and W2 shipped believing it was already fixed.

**W7's gate is local-only, not "staging and dev".** `runtime() !== 'production'` is false on the staging
Vercel project too, because it deploys with `--prod`. Left exactly as specified rather than relaxed: local
development already IS the staging tier, both harnesses drive localhost, and the gate is what stands
between this and "anyone may sign in as anyone". Verified against the DEPLOYED staging host — both doors
refuse (`unknown_provider`, and a 404 on the fake authorize endpoint).

**W5 layer 1 needs a capability handshake the PRD did not mention.** Sending a `bl-staging://` redirect to
a binary that has not registered `CFBundleURLTypes` ends a *successful* sign-in on Safari's "the address
is invalid" — strictly worse than the page it replaces. So `/oauth/start` takes `client: 'shell-scheme'`,
claimed only after the `appUrlOpen` listener has actually registered. The scheme itself still comes from
the server's tier-keyed table; the request states a capability, never a destination.

**Three columns, not two.** `oauthFlow` gained `client` (W5) and `failureMessage` alongside W3's
`failureCode`/`failedAt` — the Danish sentence is stored rather than re-derived so the callback page and
the app say the same thing, which is what lets the 410 carry copy the client never has to duplicate.

Scenario coverage, with its rungs, is `docs/auth/signin-scenarios.md`; the rung-1 harness is
`.claude/skills/ui-screenshot/oauth-probe.mjs`. Still **UNKNOWN — owner's iPad only**: the real Google and
Apple round trips, whether iOS fires `visibilitychange` under the sign-in sheet, and whether it hands
`bl-staging://auth` back (that one needs a new TestFlight build; the installed binary keeps layer 2).
§8's open items stand, except that a rejected Apple exchange on staging returned `invalid_grant` rather
than `invalid_client` — which proves the Apple client secret signs correctly there, so RC1 was indeed the
remaining blocker.
