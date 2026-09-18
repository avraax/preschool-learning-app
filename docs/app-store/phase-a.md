# Phase A — what shipped, what is verified, and what is still the owner's

Companion to `tmp-prd-app-store-ios.md` §4.1. Implemented on **`feat/app-store-ios`**, 2026-08-06.
Nothing native was added: no Capacitor, no `ios/` tree, no dependency, no account, no payment.

**Every claim below names the rung it came from** (CLAUDE.md): (1) headless Chrome, (2) real WebKit with
an iOS UA, (3) the owner's iPad. **Nothing here has reached rung 3.**

---

## A1 — Guest / local play (§3.2)

The app opens playable with no account. Guideline 5.1.1(v).

- **A device that has never signed in auto-enters guest** at `authStore`'s constructor — before React,
  not in `boot()`, so a brand-new install never flashes a lock screen (that flash would have been on the
  one launch a reviewer sees). A device that HAS signed in and then signed out still gets the lock
  screen, now with **"Spil uden konto"** on it. The owner chose this split on 2026-08-06: auto-guest
  everywhere would drop a child into an empty book after an accidental sign-out, with no explanation.
- `phase: 'guest'` ⇒ `canPlay: true`, **`canCallPaidApis: false`**. That is not caution — it is the same
  control as `AUTH_ALLOWED_EMAILS`. `/api/tts-azure` bills per character and needs a server-minted JWT
  no account-less client can obtain. **A guest costs nothing, which is what makes an open guest path
  safe to ship.** Every spoken line is prebaked, so a guest loses nothing a child would notice.
- `profileStore` attaches a fixed local child `local-guest` — a new caller of the existing
  inert-until-`attach()` machinery, not a second progress path. Its book is
  `bornelaering-progress:local-guest`, so guest and real children can never overwrite each other.
  `progressSync` needed no guest branch: `canSync()` already requires a session token.
- **A gap found and closed while building this.** `requirePin` routed a guest to the LOCAL verifier,
  which is only cached after an ONLINE verify — so it fell through to a server with no account and **a
  guest could never open "Indstillinger" at all**: no difficulty, no sound, no bug report, no privacy
  links, and no way to sign in. That is precisely the "guest path is partial" residual risk in PRD §5.3.
  The account-less gate is now an arithmetic challenge (`src/config/guestAdultGate.ts`), which is also
  what Apple means by a parental gate — "adult-level tasks", not a secret. Operands are 4–9 (so every
  answer is two digits and the entry self-submits), calibrated against the real child: he counts to
  60–70 and adds to 20, and cannot multiply. A new question on every open and after every wrong answer.
  A signed-in adult keeps the PIN, which is stronger.
- `KontoPane` in guest mode drops the account UI entirely and offers sign-in plus what it buys.

**Verified (rung 2, real WebKit + iOS UA):** a fresh device reaches `phase: guest`, attaches
`local-guest`, renders all five section tiles and shows **no blocking overlay**; a
previously-signed-in device gets the lock screen at z-9999 with the guest button, and pressing it opens
the app; the arithmetic gate opens all six settings groups on a correct answer and, on a wrong one,
refuses and re-rolls the question.

**Not migrated, deliberately:** guest progress does not move into an account on sign-in. That matches
the accounts release's standing clean-sheet decision; the Konto pane says so in Danish.

## A2 — Privacy policy + support page (§3.5)

`/privatliv` and `/support`, rendered **in-app** (Guideline 1.3 forbids links out of a Kids app) and
reachable at those URLs **without an account** — `AuthGate` mounts them standalone when the gate blocks,
because Apple fetches both. Content is data in `src/config/legalContent.ts` so it can be guarded.

Danish first, English second on the same page: the app stays Danish-only, but App Review reads English.

The policy names **Microsoft Azure AI Speech, Neon and Vercel** (Google Cloud Speech-to-Text was dropped
with the microphone game on 2026-09-18), carries the 5.1.1(i) equal-protection confirmation, states what
leaves the device and when, states retention and deletion (pointing at the two in-app paths that already
exist), and says how to withdraw consent.

> **OWNER, before submitting.** This is a factual description written from the code, not legal advice,
> and you are the data controller named in it. Read it — it names you and `allanvraa@gmail.com`
> publicly.

## A3 — WITHDRAWN (the microphone game was removed)

Phase A3 built a parental consent gate for Ordleg's speech-input game, "Sig et Ord". **The game itself
was removed in full on 2026-09-18** — component, hook, `/api/stt`, the consent switch, the iOS purpose
string and every privacy disclosure that described it — so the gate has no subject and is gone with it.
The app now requests no device permissions at all, which is what the listing and the privacy policy say.

### The adult IA is still SIX groups, not five

Settings PRD-01's five-group shape was a contract, and A3 broke it on the owner's decision (2026-08-06)
so a Kids Category reviewer would find the parental gate and the privacy policy together. **Privatliv
survives the microphone's removal**: it still carries the policy, the support page and the AI-voice
disclosure Microsoft's Code of Conduct requires, and those are exactly what a reviewer goes looking for.


## A4 — Offline-readiness audit (§3.10)

`src/config/runtimeTarget.ts` answers "web deployment or bundled shell?" from the page's **protocol**
(`capacitor:` / `ionic:`). **No Capacitor dependency** — importing a native SDK to ask a question the
origin already answers would be backwards, and nothing native exists yet. `http://localhost` is
deliberately NOT the shell: that is the dev server, and claiming it would disable these guards in the one
place they are developed.

| §3.10 item | Finding | Action |
|---|---|---|
| `swCleanup.ts` | **Safe** in a shell (every access feature-detected or inside the try/catch, both promises `.catch`ed) but **pointless** — a bundled shell never had a web-era service worker to inherit | Skipped in the shell. Two async storage sweeps at every cold boot on a 2017 iPad is not free |
| `lazyWithReload` | **Harmful** in a shell. The recovery assumes a reload fetches a newer `index.html`; bundled chunks cannot be stale, so a reload re-fetches the bytes that just failed | Rethrows in the shell → `AppErrorBoundary`, as for any other failure |
| Update banner / `/api/version` | **Meaningless at best, a permanent false "en ny version er klar" at worst** — a shell binary's version is set by App Store review, not by a push | Returns before the fetch, so the shell also stops polling every 10 minutes |
| `vite-plugin-pwa` | **Not registered and not imported anywhere** — verified. It is an unused entry in `dependencies` | Pinned by a guard (config + source graph + no `serviceWorker.register`). **Left in `package.json`** — see below |
| `vercel.json` caching | Irrelevant for bundled assets, still relevant for `api/` | No change, as the PRD says |

> **OWNER, a small one:** `vite-plugin-pwa` is an unused production dependency. Removing it touches the
> lockfile, which is not worth doing on this branch for zero behavioural gain — but it should go.

**This deliberately inverts CLAUDE.md's "never design a feature around works offline", for the shell
only.** The Vercel deployment keeps its network-only, no-service-worker design unchanged. Two delivery
targets, two rules — recorded in `.claude/rules/pwa-and-device.md` so a later session does not "fix" it
back. And **never add an OTA / live-update service**: Guideline 2.5.2 forbids downloading code that
changes app functionality.

## A5 — iPhone 6.9" layout pass (§4.2)

Added permanent `iphone-69` (440×956) and `iphone-69-landscape` (956×440) presets to
`.claude/skills/ui-screenshot/webkit.mjs` — at dpr 3 those are exactly the required 1320×2868 / 2868×1320.
The built-in `iphone` presets are 6.1" geometry and would have produced rejected uploads.

**Measured, both orientations, across the home menu, all four game shapes, Min Bog, Ordleg, Stav Ordet
and Memory: `overflowY: 0` and `overflowX: 0` everywhere. No content clipping, no horizontal scroll, no
console errors, no page exceptions.** The boxes that escape the viewport are the parallax scene's
deliberate overscan layers and the corner mascot.

**One finding worth recording, from the group A3 added.** On a 440px-tall landscape phone the adult
root list is six rows plus a header and a pinned footer, which does not fit: the list scrolls (327px of
content in a 284px box) and **Privatliv, the last row, is below the fold at rest.** It is NOT a dead
control — measured with `elementFromPoint` after scrolling (`hittable: true`) and confirmed by a real
click that opened the pane. Standard scrolling behaviour, and iOS Settings does the same. Left alone:
clawing back 43px would mean cutting the 44px row floor or the version footer, and both cost more than
this is worth. Worth knowing if a seventh group is ever added, and it is why the iPhone shot 6 is the
Læring pane rather than the root list.

Portrait is *airy* rather than broken — a landscape-first design at 440×956 leaves large empty bands
(Min Bog's chapter chips wrap to an orphan row; Stav Ordet has a dead lower third). **Not chased**,
because PRD §3.9 locks iPhone to landscape via `UISupportedInterfaceOrientations~iphone` in Phase B, so
portrait will not ship. If that decision is ever reversed, this is the work it creates.

> **Rung 2 is the ceiling here, permanently.** These are genuine renders of the real app in real WebKit,
> so they legitimately represent it — but no human has ever seen this app on an iPhone. Real touch feel
> and true iPhone WebKit behaviour are **UNKNOWN**. This was accepted knowingly when the owner chose a
> universal app (PRD §5.5).

## A7 — No Google credential is persisted server-side (§3.2)

Guideline 5.1.1(v): "An app may not store credentials or tokens to social networks off of the device."
Whether Apple reads "social networks" as covering Google-as-IdP is UNKNOWN (PRD §6 #18), so the design
sidesteps the question rather than arguing it.

- **Refresh token: never issued.** The authorization URL already set `access_type=online`, and Google
  only returns a refresh token for `offline`. Nothing to store, and nothing in the server graph names
  one.
- **Access token: was being stored, now is not.** `signInSocial({ idToken: { token, accessToken } })`
  hands better-auth the Google access token, which it writes to `account.accessToken` in Neon
  (`api/routes/sign-in.mjs` → `handleOAuthUserInfo`). **Nothing in this repo ever read it** — Google's
  own `getUserInfo` decodes the ID token and ignores the access token entirely
  (`@better-auth/core/src/social-providers/google.ts`) — so it bought nothing and left a live Google
  credential at rest. It is no longer captured from the exchange or forwarded.

Guarded by `lib/googleTokens.test.ts`, because the regression is **invisible**: re-adding `accessToken`
is a plausible one-word change, nothing breaks, and no test would fail. Read from source rather than
from the database on purpose — `.claude/rules/auth.md` forbids probing the owner's real Neon.

> **OWNER:** existing rows in `account` may still hold an access token from earlier sign-ins. They expire
> in about an hour and are useless, but if you want them gone, one `UPDATE account SET "accessToken" =
> NULL` on the Neon console does it. Not run from here — that is your production database.

## A6 — Sign in with Apple: NOT DONE, on purpose

Skipped per instruction. It needs the Sign in with Apple capability on the App ID, which needs a paid
Developer Program membership (PRD C1). It belongs to Phase B and is sequenced after C1.

---

## Verification summary

`npm test` **524 pass / 0 fail**, `tsc` clean on both the client and server projects, `npm run lint`
0 errors.

**All 19 new invariants were re-broken** (`/re-break`) and each flipped **its own** test — both
Google-token guards, the guest phase and its paid-API refusal, the public-path list, the operand floor,
the `requirePin` guest branch, all four offline-audit guards, the three privacy-policy clauses and the
six-group IA. (Five of the nineteen guarded the microphone consent gate and went with it on
2026-09-18.)

The comment-stripping those source-reading guards depend on was proved in **both** directions: a prose
comment naming the forbidden thing keeps the suite green with stripping on, and turns it red with
stripping off.

## Still the owner's, before this can be submitted

**Three of the four items here were closed by the audit in `policy-verification.md`** (2026-08-06),
which checked every factual claim against the code and every required element against Apple's guidelines
and GDPR Art. 13. Read that file rather than the policy itself; what remains is short:

1. ~~**Confirm the Google Cloud data-logging box is unticked.**~~ **Moot since 2026-09-18** — the app
   sends Google no audio at all.
2. **Decide whether the policy is legally sufficient for you.** It now describes the app accurately and
   contains every Art. 13 element, and four wrong claims were found and fixed — but "accurate and
   complete" is not "legally sufficient", and that part is a determination, not a fact.
3. **Cut the "virker uden internet" line from the description if Phase B1 slips.** Still not true today.
4. Everything in PRD §4.4 Phase C: enrolment and the 99 USD, EU DSA trader status, the ASC API key.

**Closed:** the Azure licence question (Microsoft's Code of Conduct for AI Services contains no
prohibition on shipping prebuilt-voice output inside your own app — but it *does* require disclosing that
the voice is synthetic, which the app was failing and the listing contradicted; fixed).
