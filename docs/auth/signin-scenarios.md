# Sign-in scenario matrix

Every row of `plans/accounts/tmp-prd-accounts-02-signin-reliability.md` §6, with the evidence that
covers it and **the rung that evidence came from**. `src/config/signinScenarios.test.ts` fails if a row
is missing or carries no evidence class, so nothing can go quietly uncovered.

**Rungs** (CLAUDE.md): **1** headless Chrome / plain-Node (`cdp.mjs`, `npm test`,
`.claude/skills/ui-screenshot/oauth-probe.mjs`) · **2** real WebKit with an iPad UA (`webkit.mjs`) ·
**3** the owner's iPad. `curl` against the **deployed** staging host is rung 1 evidence about the
deployed artifact specifically, and is marked `rung 1 (deployed)` — local green proves nothing about it.

**UNKNOWN is a verdict.** A row nothing can settle from here says so, with the reason. It is never
folded into a pass.

## A — Happy paths

| # | Scenario | Evidence | Rung |
|---|---|---|---|
| A1 | Fresh install → guest → Google → profile + avatar → playing | `oauth-probe.mjs` drives start→callback→claim end to end; `profileGatePolicy.test.ts` + `profileCreation.test.ts` cover the profile half; guest auto-play in `authGatePolicy.test.ts` | 1 · **UNKNOWN (3)** for the real Google consent screen |
| A2 | The same with Apple | Identical server path — `completeOauthCallback` reads the provider off the ROW and only the token endpoint differs; the Apple form POST reaches the handler on the deployed host (no 415) | 1 (deployed) · **UNKNOWN (3)** for the real Apple sheet |
| A3 | Second device with existing profiles → picker | `profileGatePolicy.test.ts` "two children and none chosen is the picker" | 1 |
| A4 | Exactly one child → straight into the book | `profileGatePolicy.test.ts` "one child already attached shows nothing" | 1 |
| A5 | Passkey unlock (web / PWA only) | `ui-screenshot` `--webauthn` recipe; `shellAuth.test.ts` for where it is offered | 1 |
| A6 | Sign out → sign in again → same child, same book | `authSignOut.test.ts` (detach + roster drop), `progressMerge` algebra for the book surviving | 1 |

## B — Interruptions

| # | Scenario | Evidence | Rung |
|---|---|---|---|
| B1 | Cancel at the provider's consent screen | `oauth-probe.mjs` `cancel` → decisive 410, no Fejlkode, no report | 1 |
| B2 | Sheet dismissed after the callback, before the claim | `oauth-probe.mjs` claims in a separate request from the callback, which is this shape exactly | 1 |
| B3 | Backgrounded >3 min mid-round-trip (**RC4**) | `oauthReturnPoll.test.ts` "THE FROZEN CLOCK", built from report 8AE9T's own timings | 1 · **UNKNOWN (3)** for whether iOS fires `visibilitychange` under the sheet — which is why the per-sample cap exists |
| B4 | App killed mid-round-trip → cold boot with a pending flow | `oauthReturnPoll.test.ts` "a cold boot with a pending flow claims immediately" | 1 |
| B5 | Return lands in a different storage jar (PWA ↔ Safari) | `WrongContextNotice` + the `returned-without-pending-flow` report, listed in `authDiagnostics.test.ts` | 1 |
| B6 | Two flows started back-to-back | `signinScenarios.test.ts` asserts a single `OAUTH_FLOW_KEY`, so the second start makes the first unclaimable rather than half-claimable | 1 |
| B7 | Network drops mid-claim | `claim()`'s catch records `poll-network-blip` and does NOT end the attempt; the next tick retries | 1 |
| B8 | Device offline when the button is tapped | `start-network-error`, listed in `authDiagnostics.test.ts` | 1 |

## C — Refusals and errors

| # | Scenario | Evidence | Rung |
|---|---|---|---|
| C1 | Non-allowlisted Google address | `oauth-probe.mjs` → the refusal copy naming the domain, no Fejlkode, no report | 1 |
| C2 | Apple + Hide My Email | `oauth-probe.mjs` → named as `@privaterelay.appleid.com`, treated as a refusal not a fault | 1 |
| C3 | Apple ID address not on the allowlist | Same branch as C1; the provider does not change it | 1 |
| C4 | Provider returns `error=access_denied` | `oauth-probe.mjs` `cancel` | 1 |
| C5 | Token exchange rejected (expired / malformed Apple secret) | `oauth-probe.mjs` `reject-exchange` → fault WITH a Fejlkode. A real one was also observed on deployed staging (`invalid_grant`, which incidentally proves the Apple client secret signs correctly) | 1 · 1 (deployed) |
| C6 | Flow older than 10 min | Branch pinned by source (`expiresAt < now` → 410). **Not driven**: it needs a ten-minute wait or clock control the server does not expose | 1 (source only) |
| C7 | Replayed callback | Driven against the deployed host: a second callback for a failed flow answers 410 and re-renders the recorded verdict | 1 (deployed) |
| C8 | Claim after the 5-min claim TTL | Same shape as C6 — branch pinned by source, not driven, for the same reason | 1 (source only) |
| C9 | 5xx during the claim | `claim-http-error`, listed in `authDiagnostics.test.ts` | 1 |
| C10 | `/oauth/start` rate limit (10 per 10 min) | **Observed live** — `oauth-probe.mjs` hit it on a re-run and the endpoint refused, exactly as designed | 1 |
| C11 | `APPLE_*` absent → no Apple button at all | `appleUsable()` gates the provider, `/family/providers` fails toward `['google']`; the deployed staging host answers `["google","apple"]`, which proves the `.p8` really parses there | 1 (deployed) |
| C12 | iPad clock skew | `lib/access-token.test.ts` "clock skew: ±90s passes, ±300s fails" | 1 |

## D — Profiles

| # | Scenario | Evidence | Rung |
|---|---|---|---|
| D1 | Account with zero profiles → mandatory dialog | `profileCreation.test.ts` (un-dismissible) + `profileGatePolicy.test.ts` (only once the roster has ANSWERED) | 1 |
| D2 | Avatar always set | `profileCreation.test.ts` — preselected in the dialog, and `cleanAvatar` refuses rather than defaults on both server copies | 1 |
| D3 | Guest-book adoption offered once, default on | `profileCreation.test.ts` + `guestAdoption.test.ts` | 1 |
| D4 | Adoption declined → the guest book stays put | `progressAdoption.test.ts` "the SOURCE key is left byte-identical" | 1 |
| D5 | Adding a second child | `profileStore.createProfile` from the picker; `authOverlayZ.test.ts` proves the dialog is not mounted underneath it | 1 |
| D6 | Profile creation while offline | **UNKNOWN — not covered.** `createProfile` needs `/api/profiles`, so offline it fails and the dialog stays open; nothing asserts what the adult is told. A `cdp.mjs` run with the request blocked would settle it at rung 1 | **UNKNOWN** |

## E — State integrity

| # | Scenario | Evidence | Rung |
|---|---|---|---|
| E1 | Sign-out detaches progress and drops the cached roster | `authSignOut.test.ts` | 1 |
| E2 | A 401 on a background validate signs out through the subscription | `authSignOut.test.ts` | 1 |
| E3 | An abandoned first attempt leaves no orphan session or dangling flow row | Read directly from staging Neon after driving every failure branch: one `user` row (the owner's), and every `oauthFlow` row carrying `failedAt` — none in the "pending forever" shape that RC3 produced. Rows expire and the next `/oauth/start` sweeps them | 1 (deployed DB) |
| E4 | The shell never offers a passkey button | `shellAuth.test.ts` — `passkeysSupportedInThisBuild()` derives from `isNativeShell()` | 1 |
| E5 | The backend badge shows the staging host, and is absent on production | `backendTarget.test.ts` | 1 |

## What no rung below 3 can settle

Collected so the next session does not re-derive it:

- Whether iOS fires `visibilitychange` when `SFSafariViewController` covers the webview (B3). The
  foreground accounting is correct either way — that is what the per-sample cap buys.
- Whether iOS hands `bl-staging://auth` back to the app (W5 layer 1). Needs a new TestFlight build; the
  binary in the field answers `client: 'shell'` and keeps the terminal page until then.
- Whether the owner's Apple ID address is on the staging allowlist. Nothing in the database names it
  (no Apple `account` row has ever existed). The next Apple attempt now reports its DOMAIN, which
  settles it.
- Real touch feel, and whether the Danish sounds right.
