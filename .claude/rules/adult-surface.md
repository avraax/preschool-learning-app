---
paths:
  - "src/components/adult/*.tsx"
  - "src/components/adult/panes/*.tsx"
  - "src/config/adultSettingsIa.ts"
  - "src/config/pinReasons.ts"
  - "src/services/bugReporter.ts"
  - "src/services/diagnosticsBuffer.ts"
  - "src/services/screenshotService.ts"
  - "src/services/screenshotFidelity.ts"
  - "api/bug-report.ts"
  - "api/log-error.ts"
---

# The adult surface & bug reports

Settings PRD-01. **THE DOOR IS THE CHILD'S AVATAR — there is no gear** (owner, 2026-08-09). Tapping
`ProfileBadge` (the header badge on home, the section menus, Min Bog and every game) opens the adult
surface: a plain tap → `requirePin('adultMenu')`, or the guest arithmetic gate → the lazy
`AdultSettings`. This is Khan Academy Kids' pattern, and it removes a permanent adult artifact from a
child's screen. The old ~2s hold went earlier, once the 4-digit PIN became the real gate.

`AdultSurface` (`src/components/adult/AdultSurface.tsx`, mounted globally in `App.tsx`, **renders
nothing until asked**) owns the gate + the screenshot capture + the lazy mount; the trigger reaches it
through `src/services/adultSurfaceBus.ts`. Three things that will bite:

- **`aria-label` is EXACTLY `"Til de voksne"`, and it lives on the badge now.** Every `ui-screenshot`
  recipe and `sweep.mjs` clicks `[aria-label="Til de voksne"]`. Reword it and the whole verification
  harness stops finding the door — silently, on every recipe at once.
- **The `authUiOpen` check stays on the SURFACE side of the bus**, not in the trigger, so a second
  trigger can never forget it. A PIN screen must never be capturable into a bug report (§8.1 layer a).
- **No child attached ⇒ no badge ⇒ no door.** That window is the cold boot before the roster settles,
  where a blocking gate is up and the gear would have been inert anyway — but it is a real difference.

The objection that had to be answered before the gear could go: a report captures `document.body` when
the surface opens, so the door must be reachable **from the broken screen, mid-game included**, or no
report can ever show the game that broke. Verified end-to-end — a report filed from `/alphabet/quiz`
carries the quiz board, not the settings.

## The two-pane IA is a contract

A `maxWidth="md"` Dialog (MUI's default z-index 1300) with a persistent left rail of **five
mutually-exclusive groups** — **Barn** (active child + read-only "Sådan går det" + roster/switch/rename/
add/delete + reset strip) · **Læring** (difficulty; `panes/LaeringPane.tsx` **EXPLAINS the selected level in
Danish** and labels the setting as per-child) · **Lyd** (SFX/music + narration voice + tempo) ·
**Udseende** (skin) · **Konto** (email + sync + PIN + Face ID + log out / log out everywhere / delete
account) — plus a **persistent rail footer** (bug report + tap-to-copy version) reachable from every pane.
It replaced 13 flat rows in a scrolling `xs` dialog and six sibling sub-panels.

The reset lives in **Barn**, in that pane's destructive strip (it is per-child, so it sits next to the
child) → "Nulstil fremgang for {navn}" → a confirmation that **names the active child** →
`progressStore.resetAll()`, which clears that child's book and the XP behind it (bests and stars are
gone app-wide — Endless Play PRD-01 — and the confirmation copy no longer names them), **preserves** sound/music/
difficulty/theme (those are preferences, not progress) and bumps `sync.epoch` so the next pull can't
resurrect it (`.claude/rules/auth.md`).

- **Group/item structure is DATA** in `src/config/adultSettingsIa.ts`, guarded by
  `adultSettingsIa.test.ts`, whose load-bearing assertions read the REAL `pinVerifierFor` table (pure, in
  `src/config/pinReasons.ts`, re-exported from `AuthContext`) so **no account-scoped destructive action can
  be downgraded to the local ~5-minute unlock**.
- **Every `irreversible` action is TYPE-TO-CONFIRM**: the button stays disabled until the adult types a
  fixed Danish word (`NULSTIL` reset · `SLET` delete child · `SLET ALT` delete account — all distinct, so
  a child-deletion habit can't carry into wiping the account), via the shared
  `panes/DestructiveConfirmDialog.tsx`, with the word read from the IA module so the guard can't pass
  against a value nothing renders. **A PIN does not substitute for it** — inside the unlock window
  `requirePin` returns true without prompting, and where a pad IS shown (account deletion) it arrives
  AFTER the confirm, which left that confirm a single tap identical in weight to the reversible "Log ud"
  beside it. Reversible actions deliberately demand no typing; the test enforces both directions.
- **Navigation grammar**: **one** "Luk" (top-right, no other control uses that word), **no back arrow at
  regular width** (the rail is the way back) and exactly one on a pushed compact pane titled with its rail
  label, nested TASK dialogs only, **max modal depth 3**. On phones (`PHONE_ANY`, or below the `md`
  breakpoint) it goes `fullScreen` single-pane push-nav; the last-viewed pane is restored across opens
  (module variable, not persisted).
- **Auth surfaces are deliberately NOT re-skinned** — `PinSetupDialog`, `CreateProfileDialog` and the
  account-deletion `PinPad` render inside `<AppSkin>`, which restores the app theme within the adult tree.

## The account offer: lead with what is true for every family

Signing in is offered only here, behind the parental gate — nothing adult-directed goes in front of it
(Kids Guideline 1.3), so a Duolingo-style timed prompt during play is **not available to us**.

- **Outcomes, not features.** Sync, multiple children and the microphone game are each conditional on
  something a new user may not have; one child on one iPad — the median install — matched none of the
  three, so the screen said nothing to the person reading it. Every row is title + hint, and the hint
  carries the outcome.
- **"Bogen er sikret" leads**, because it is the only line true for everyone: a guest book exists on
  that iPad alone and a reset destroys it. Say the progress is **uncopied**, never *unsaved* — it is
  saved, and the distinction is the whole lever.
- **The offer is progress-aware** (`rewardNumber()` in the rail row), which is the endowed-progress
  effect pulled in the one place the constraint allows. Never `globalLevel()`, never as a distance.
- **One trust line at the CTA** — free, no ads, no tracking, no mail. Cost and data handling are the
  dominant parental objection for a children's app, and all four clauses are load-bearing claims: if
  any stops being true, the line goes first.
- **Say the price before the work.** "Tilføj et barn" used to let a guest pick an avatar and type a
  name before `createProfile` refused; it now states "Kræver en konto" and routes to Konto. A pane asks
  `AdultSettings` to switch via a `goToPane` prop — `select()` owns the compact push and `lastPane`.

## Bug reporting

`diagnosticsBuffer` (`src/services/diagnosticsBuffer.ts`, installed as the FIRST import in `main.tsx`)
always records rings of console lines, network calls and route/tap breadcrumbs. Opening the surface
captures a **screenshot** (snapdom).

**The capture runs BEHIND the gate, and must never be awaited in front of it.** It used to be
`await captureScreenshot()` before `requirePin`, which meant a cold snapdom import + a whole-document
computed-style walk + an `embedFonts` rasterise (~0.9s by its own note) before the modal could paint —
1-2 seconds of nothing happening on every open. It now starts a beat AFTER the gate is up (snapdom's
clone is main-thread work; firing it into the enter transition trades a slow open for a janky one), and
the gate keeps showing the game underneath because every surface that can be open during a capture
carries **`data-capture-exclude`** (`src/services/captureExclude.ts`). That marker goes on the Dialog
ROOT, not the paper — MUI's backdrop is a sibling of the paper, so marking the paper leaves a grey slab
over the whole shot. It is deliberately NOT `data-bl-redact`: that one means "can render a secret", this
one only means "opened after the capture was asked for", and the guest gate is exactly the surface that
is the second without being the first. `stabilizeForCapture` skips both, or its live-DOM writes would
flicker the dialog the adult is reading. Guarded by `components/auth/gateLayout.test.ts`.

**snapdom is a computed-style CLONE rasterised through an SVG `<foreignObject>`, not a photograph**, so
whatever `getComputedStyle` doesn't round-trip is silently lost and the report shows an app that never
existed:

- `margin:auto` reports `0px` → every centred block slams left
- without `embedFonts` the fallback face is wider → text reflows and ellipsises
- `backdrop-filter` paints an oversized washed rectangle over real content
- computed *widths* are pinned, so `text-overflow` fires on sub-pixel rounding

`stabilizeForCapture` in `src/services/screenshotService.ts` re-states those on the live DOM and restores
them; the pure decision rules are `screenshotFidelity.ts`. Never "optimise" an option back off without the
A/B in the `ui-screenshot` skill.

"Rapportér et problem" → `bugReporter.buildReportPayload()` (build info, device, audio health incl. the TTS
circuit-breaker + playback-failure count + permission snapshot, progress state, diagnostics rings) → POST
`/api/bug-report` → **Vercel Blob** (`bug-reports/<date>/<ID>/report.json` + `screenshot.jpg`) → a short
code (e.g. `R7K3F`) shown to the adult; offline/failure → "Gem som fil" downloads the same JSON.
**Crashes auto-upload** slim reports (no screenshot): window `error`/`unhandledrejection` hooks + the global
`AppErrorBoundary` (kid-friendly "Ups!" + reload; `?crash-test=1` throws on purpose), deduped by signature,
max 3/session.

**Failed SIGN-INS auto-upload too** (`type: 'auth'`, WITH a screenshot — `src/services/authDiagnostics.ts`).
They needed their own channel because they are invisible to both mechanisms above: the door to the adult
surface is inside `<App />`, i.e. behind the gate, and every sign-in failure is *handled*, so it never
reaches the crash hooks. Two failed logins on the iPad left no data at all before this. `noteAuthStep` records a trail
(mirrored to `console`, so it also rides along in any later manual report), `reportAuthFailure` uploads,
and **the lock screen prints the short code** — the only surface that can, since the adult is not past the
gate. The worst offender it closes: `OAuthReturnHandler`'s 3-minute poll used to give up with
`clearInterval` and nothing else. Throttling is stricter than the crash path (dedupe by `stage|reason`,
max 3/session, 30s floor) because `google-claim` runs inside a 3s poll. **Every recorded field is an enum,
a status code or an error name** — never a body, URL, email or token; `authDiagnostics.test.ts` fails if a
field that could carry one is added. Locally `dev-server.js` mirrors the endpoint into the gitignored `.bug-reports/` folder, so
the whole flow works without Blob.

**To debug a report, use the `/debug-report` skill** — it handles "newest report", one code, or many.

One-time prod setup: Vercel dashboard → Storage → create a **Blob** store → connect to the project (adds
`BLOB_READ_WRITE_TOKEN`). **Required:** set `BUG_REPORT_READ_KEY` in the Vercel env — GET reads are
**fail-closed** (403 until the key is set) since reports contain child screenshots; once set, every GET must
pass `&key=<value>` (PRD-03). Settable from here: `vercel env add BUG_REPORT_READ_KEY production`.

```bash
# ALWAYS use curl, not WebFetch (large JSON). Local base: http://127.0.0.1:3001 (open; prod needs the key).
curl -s "https://preschool-learning-app.vercel.app/api/bug-report?list=10&expand=1&key=$BUG_REPORT_READ_KEY"
curl -s "https://preschool-learning-app.vercel.app/api/bug-report?id=R7K3F&key=$BUG_REPORT_READ_KEY"
curl -s -o /tmp/shot.jpg "<screenshotUrl from the response>"   # then Read the jpg
```

## Client logging is dev-only

`remoteConsole` is **OFF in production** (Audio v2 decision — no durable storage), so end users no longer
POST to `/api/log-error` and that endpoint receives ~no traffic. Server-side errors are recorded via
`lib/server-utils.ts` `logServerError` (Vercel function logs + absolute-URL POST). Force client logging on
with `?enable-console=true`.

```bash
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=50&device=iPad&level=error"
# params: limit, level (error/warn/info/log), device, since (ISO date)
```

## Update banner

PRD-09: `useUpdateChecker` polls the deployed build; when a newer build is live `UpdateBanner` shows a
**dismissible** bottom-centre pill (no reload) and the apply-update is a **PIN-gated item in the
adult menu** — never a child-tappable reload button. Pairs with the network-only / `lazyWithReload`
recovery (`.claude/rules/pwa-and-device.md`).
