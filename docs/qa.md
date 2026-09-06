# QA — the pass to run before every release

Run this before submitting a build to App Store review, and before merging anything large. It is written
to be re-run, not read once: every step is a command with an expected result, so a difference from the
baseline is the finding.

**Every claim names the rung it came from** (CLAUDE.md): (1) headless Chrome, (2) real WebKit with an iPad
UA, (3) the owner's iPad. Rungs 1–2 are below and I can run them. Rung 3 is §5 and only the owner can.

## 0. Prerequisites

Both dev servers, **in Windows PowerShell, not WSL** (WSL gives 502 on every `/api` call):

```
npm run dev:api                                     # 3001
node node_modules/vite/bin/vite.js --host 127.0.0.1 # 5173
```

## 1. Prove the sweep is not decoration — do this FIRST

```
node .claude/skills/ui-screenshot/sweep.mjs --selftest
```

Must print **three FAILs** (crash boundary, impossible title, bad route) then `SELFTEST PASSED`. If it
does not, every green below means nothing. This exists because a crashed route satisfies `--wait-for`
and passes vacuously — `AppErrorBoundary`'s "Prøv igen" and NotFound's "Hjem" are both real buttons.

## 2. The automated pass

| Command | What it actually proves | Baseline |
|---|---|---|
| `npm test` | The pure logic: progression algebra, CRDT merge, difficulty tables, guest gate, config guards | 781 pass |
| `npm run lint` | 0 errors (the warnings are pre-existing) | 0 errors, 24 warnings |
| `npm run context:check` | The guardrail byte budget still fits | under budget |
| `npm run audit:check` | Every closed-set narration clip is signed off | clean, 1910 clips |
| `npm run schema:check` | **Both deployments' databases match the code they run** — the check that was missing when sign-in died on production | staging + production IN SYNC |
| `npm run shots:check` | **App Store Connect holds the same screenshots as the repo** — re-shooting is not uploading, and ASC shows the right filename beside the wrong image | all 12 match |
| `npm run lexicon:check` | Each PLS lexeme is live **and tested in a real sentence** — a bare word gives a false negative, which cost three wrong diagnoses | `fire` APPLIED |
| `sweep --phase smoke` | Every route renders, shows **its own** Danish title, and throws no console error or page exception | 27 PASS · 0 FAIL · 1 N/A |
| `sweep --phase layout` | The same across **8 viewports** — iPad landscape/portrait/split, small iPad, wide, phone both ways — plus **nothing clipped off-screen** | 216 PASS · 0 FAIL · 8 N/A |
| `sweep --phase audio` | Narration **actually produced sound**, measured, rather than asking anyone to listen | 26 PASS · 0 FAIL · 2 N/A |
| `sweep --phase difficulty` | Let/Normal/Svær change what the generators produce — not merely that a game reads the table | 16 PASS · 0 FAIL · 5 N/A |
| `sweep --phase round` | Eight tasks can be driven in a row; play never "ends" | 12 PASS · 0 FAIL · 5 N/A |
| `sweep --phase ceremony` | Seeds `?rewards=8` and plays to the crossing, so the sticker is paid where it was earned | 9 PASS · 0 FAIL |
| `sweep --phase live` | **No screen speaks through live Azure** — i.e. every line really is in the prebaked set | 20 PASS · 0 FAIL · 1 N/A |

All sweep commands take `--engine chrome|webkit|both`, `--only <substr>` and `--concurrency <n>`.
**The layout phase is 224 jobs and takes 10–15 minutes** — run it in the background and read the summary.

**Run the audio and ceremony phases at `--concurrency 1`, and run only ONE sweep at a time.** Both
phases assert against a clock, so they report machine load as a defect. Measured, three times each:

- **The autoplay browses** (`/alphabet/learn`, `/math/numbers`) step on a fixed onset — 1.3s for letters,
  1.4s for numbers, never awaiting the clip — so under contention a cold fetch outruns its own slot and
  the next step cancels it. The row reads `SILENT … all N clips were pre-empted`. Both passed 3/3 alone.
- **The ceremony's `held` check** samples the board every 200ms for the life of the overlay, so a stall
  long enough to skip a sample can read as movement. `/alphabet/quiz` failed once at `--concurrency 4`;
  `/math/comparison` failed once at `--concurrency 1` **while a second sweep was running in another
  shell**. Both passed 3/3 alone (`held=true`).

**The LAYOUT phase flakes under contention too** (2026-09-06) — the paragraph above named only audio and
ceremony, and that reads like layout is safe. It is not: six of 224 jobs failed, four of them `#root
empty`, while a handful of `cdp.mjs` captures ran against the same dev server. All five routes went 8/8
on a serial re-run. The tell is the SCATTER — the same route passing at other viewports — because a real
layout defect is viewport-shaped, not random.

**`--only /alphabet/learn` matches NOTHING in Git Bash, and says so as a green line.** MSYS path
conversion rewrites a leading-slash argument into a Windows path (`C:/Program Files/Git/alphabet/...`),
so the filter matches no route and the sweep prints `planned 0 · ran 0 · PASS 0 · FAIL 0 · N/A 0 ·
DEAD 0` — which scans as a pass and is *no evidence at all*. Drop the leading slash: `--only
alphabet/learn`. **Always check `planned` is non-zero before believing a filtered run.**

**Two routes that flake even in a sequential chain at `--concurrency 1`** (2026-09-06, full pass). The
sweep runs its own jobs back-to-back, so "nothing else running" is not the same as "nothing competing":

- **`audio /math/numbers`** read `SILENT — 1 of 3 clips genuinely failed`. Note the wording: the probe
  says **"genuinely failed"** specifically to distinguish a real failure from a pre-empted clip, so this
  does NOT look like the documented pre-emption artifact above and must not be waved through on the
  strength of the route name. It was still an artifact — **3/3 clean in isolation, 3/3 clips played.**
- **`ceremony /math/patterns`** went PASS → `???` ("4 advances, 14 clicks, never reached a crossing").
  In isolation it is **2/3**: when it crosses, every assertion holds (`beat=sticker, covers=true,
  held=true`); when it doesn't, it simply runs out of click budget before banking a slot's XP. So the
  ceremony baseline of `9 PASS` is really "9 when patterns crosses, 8 when it doesn't" — an 8 with
  `/math/patterns` on `???` is at baseline, and `PASS → ???` is never evidence of a regression the way
  `PASS → FAIL` would be.

So: a single red in either phase is not a finding until it has been re-run in isolation
(`--only <route> --concurrency 1`, nothing else going). A red that survives that is real. The other
phases don't measure time and can be run wide.

**`sweep.mjs | tail` HIDES A HANG, and the layout phase hangs at the default concurrency.** Two runs
in a row on 2026-09-06 stalled with the last job never returning — the first was invisible for 50
minutes because the command was `… | tail -30`, so nothing reached the output file at all and an empty
log is indistinguishable from a slow start. Redirect to a log (`> layout.log 2>&1`) and watch the line
count instead; `--concurrency 2` got 223 of 224 jobs through. **The tell that it is hung rather than
slow is the process table, not the log**: `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"`
and check the newest `StartTime` — if no new browser has spawned in minutes, the run is dead and the
remaining Chromes are leaked. Kill only the harness's own (`CommandLine -like '*cdp-*'` or
`'*--headless*'`), never all of them, and **never `node`** — a sibling session's Vite is in that list
(`.claude/rules/working-in-this-tree.md`).

**Why `--phase live` exists, and why the audio phase does not replace it.** The audio phase asks "did
sound come out", and answers OK whether the clip was prebaked or synthesized live. On 2026-09-05 two
screens were speaking through live Azure and both sounded fine in the harness — the owner caught them by
EAR on the iPad. A live call is not merely slow there: a guest has `canCallPaidApis: false`, so
`/api/tts-azure` is refused and the line falls through to **Web Speech — a different voice**, or silence
with no network. `?nogate=1` bypasses that gate, which is exactly why the harness could not hear it.
So this phase judges the REQUEST, not the sound. `/ordleg/mic` is the one true exception (it reads back
an arbitrary spoken word) and is N/A by name.

## 2.1 What the first run found, and how it was resolved

The first full run (2026-09-04, commit `e4a7ceb`) reported six defects that 732 unit tests, a clean
lint and a green build all missed. **Four were real and are fixed; two were probe artifacts.** Kept here
because the shape of each is what a later run needs in order to tell a regression from a known issue.

| Phase | Route | Reported | Verdict |
|---|---|---|---|
| audio | `/learning/memory/letters` | NO AUDIO ATTEMPTED despite trigger `[aria-label="Hør igen"]` | **real** — two causes, both fixed (`bdbd7d7`) |
| audio | `/learning/memory/numbers` | same | **real** — same two causes |
| audio | `/math/patterns` | SILENT — all clips pre-empted (something is cancelling narration) | **real** — the late welcome; fixed |
| audio | `/math/numbers` | SILENT — 1 of 3 clips genuinely failed | **not reproducible** — the autoplay contention above |
| ceremony | `/math/addition` | the board advanced UNDERNEATH the overlay | **probe artifact** — fixed (`7847e3b`) |
| ceremony | `/math/subtraction` | same | **probe artifact** — same |

**A second pass on 2026-09-05 found two MORE unprebaked lines, and neither came from this document —
the owner heard them on the iPad.** Tapping a memory card said *"Stort bogstav X"* in a voice that was
not Christel. Cause: `MemoryGame` spoke `audio.speak(letter)`, the raw UPPERCASE glyph, while
`DANISH_LETTER_NAMES` maps to lowercase (`A → 'a'`) with respellings for two (`X → 'eks'`, `Z → 'zæt'`)
— and the bake holds THAT text, so an uppercase glyph matched 0 of 1886 clips. Sweeping every game for
live Azure calls then found one more: Hvilken Farve?'s question was a template literal inside
`FarveQuizGame.tsx`, so not one of its 24 questions had ever been baked. Both fixed (`335fa57`), and
**`--phase live` is the mechanical version of the ear that caught them.**

**The one root cause behind three of the audio reds: the late welcome ate the "Hør igen" press.** On a
cold load audio is not unlocked at mount, so a game's welcome is deferred to the `isAudioReady` effect —
and the thing that unlocks audio is the child's first tap. So pressing "Hør igen" ran: speak(prompt) →
unlock → `isAudioReady` flips → deferred welcome fires → its `playAudio` calls `stopCurrentAudio()` →
the prompt dies unheard. `hasInteractedRef` exists exactly to stop the welcome talking over play, but
only the answer-tap handlers set it. Both repeat handlers now set it too. The tell was in the *passing*
rows: every other quiz read "1 pre-empted by design", which was never by design — those routes only
survived because their clip happened to be requested twice.

**And a second, independent defect on the memory routes, which is the one that mattered for the App
Store:** both board instructions were composed inline in `MemoryGame.tsx`, which the prebake enumerator
cannot reach (it is plain Node — it imports `src/config/*.ts`, never a `.tsx`). They were the only two
spoken lines in the app with no prebaked clip: 0 of 1885 manifest keys matched. Every press therefore
reached live Azure — which the shipped app **blocks for a guest** (`canCallPaidApis: false`) — and then
fell through to Web Speech: a different voice, or silence offline. `audit:check` could not see it, by
construction: it signs off clips that are *in* the closed set, so a line missing from the set is
invisible to it. Now in `gamePhrases.ts`, enumerated, prebaked and guarded by `memoryPhrases.test.ts`
(which pins both the fact and the shape — no `instructions:` string literal in the component).

**The ceremony pair was the probe measuring the wrong thing.** `sigBeforeCeremony` was captured *before*
the click that triggers the crossing, so condition (2) asked "did the board change since I answered" —
guaranteed true for any game whose prompt completes on a correct answer, and `MathOperationGame` does
exactly that on purpose (`effectiveRevealAnswer` turns `3 + 4 = ?` into `3 + 4 = 7`). Plus and Minus
were the only two routes to fail because they are the only two that rewrite their prompt. The probe now
snapshots at overlay-open and samples for the overlay's whole life.

**What this run says about the pass itself:** every one of the four real defects was child-facing, none
of them broke a test, a lint or a build, and two of them had been shipping. That is the argument for
running this before every submission — and the argument for reading a *passing* row's detail, since the
"1 pre-empted by design" that turned out not to be by design was visible in green rows for weeks.

## 3. Results that are N/A, not gaps

- **`/ordleg/mic` in the audio phase.** Same consent gate as below, one step further on: the redirect
  drops `?nogate=1`, so the app reverts to its gated state and the audio phase's `first-content-button`
  fallback clicks a button on the sign-in landing, which navigates and takes the eval context with it.
  That reported as `DEAD` — a permanent unexplained row — until the judge learned it. The route's render
  and no-crash are still asserted, by smoke and layout, whose evals don't click.
- **`/farver/laer` in the audio phase.** Lær Farver narrates on tapping a colour, and has no replay
  control, so there is no trigger to fire. Counting it PASS would claim coverage never exercised.
- **`/ordleg/mic` in smoke and layout.** The mic game refuses until an adult gives consent —
  `App.tsx` renders `micConsentGiven() ? <SpeakWordGame /> : <Navigate to="/ordleg" replace />` — so the
  sweep lands on the Ordleg menu, where the tile is hidden too. It reported 1 FAIL in smoke and 8 in
  layout (one per viewport) until the judge learned this. It still **FAILs** on a crash or an empty
  `#root`, so the route is not exempted, only its title assertion. The redirect also drops the query
  string, so `?nogate=1` is lost — which is why probing it by hand shows a lock screen.

## 4. What the automation does NOT cover

Say UNKNOWN about these rather than implying the sweep covered them.

- **Themes and dark mode.** `sweep.mjs` varies route and viewport, **not skin**. Four skins plus dark are
  unswept — the nearest thing is a manual `webkit.mjs --dark` / per-skin capture. This is the largest
  automated gap.
- **The native shell.** Everything here runs the web build in a browser. The Capacitor paths — bundled
  assets, `capacitor://localhost` origin, the system-browser sign-in handoff, native mic permission —
  are only exercised by a TestFlight build.
- **Signed-in flows.** Guest is fully covered; a real session is not, because minting one writes into the
  owner's **production** Neon database (`.claude/rules/auth.md` — test rows have reached his play-test
  that way). So: sign-in, sync, multi-child profiles and account deletion are rung 3 only.
- **The microphone game.** Needs consent, an account and a real microphone.
- **Whether the Danish sounds right.** The audio phase proves sound *was produced*, never that the
  pronunciation is correct. Only the owner's ears settle that.
- **Real touch.** Drag-and-drop is driven with synthetic pointer events. Whether a 5-year-old's finger
  works, and whether a drag also registers as a tap, is rung 3.
- **The production SHAPE of the adult surface.** Six items are owner tools hidden in the App Store
  build (`adultSettingsIa` `devTool`). The hidden state is otherwise undriveable — a plain `vite build`
  hides them correctly but answers no `?nogate=1`, and `build:harness` sets `__HARNESS__`, which is one
  of the three inputs that turn them back ON — so **`?hidetools=1`** forces the production shape in
  dev. Verified 2026-09-05 in both directions for five of the six; `konto.syncNow` is unobservable at
  rung 1 because `KontoPane` returns the sign-in offer to a guest before it reaches the sync section,
  and it rests on the source-read guard in `adultSettingsIa.test.ts` instead.
- **The adult surface in guest mode.** The harness crashes solving the arithmetic gate
  (`.claude/skills/ui-screenshot/SKILL.md`), so that screen is uncapturable and untestable at rung 1–2.

## 5. The device pass — owner only, rung 3

Install the production build from TestFlight, then work through this. Each line is pass/fail, not
"have a play".

**Guest, on a fresh install**
- Opens straight into the section menu — no login wall, no permission prompt
- All five sections open; one game in each is playable to a correct answer
- Turn WiFi **off**: every game still plays and still speaks
- The reward ring fills and the sticker ceremony fires in-game at the crossing
- Min Bog shows earned stickers and a silhouette for the next one
- Avatar → arithmetic gate → adult area opens; a wrong answer refuses

**Adult settings that change the games**
- Sværhedsgrad Let / Normal / Svær each visibly change a game (answer count, number range)
- A per-section override applies to that section only
- Udseende: each of the four skins renders correctly, and dark mode
- Lyd: muting silences narration and SFX
- Privatliv: the AI-voice disclosure is present and readable

**Sign-in**
- Google sign-in completes in the system browser and returns to the app
- Sign in with Apple completes
- Face ID / passkey is correctly **absent** in the shell
- Creating a first child offers to adopt the guest book; accepting carries the stickers over
- Progress syncs to a second device

**The microphone game**
- Hidden until enabled in Privatliv; enabling shows the consent screen naming Google
- iOS asks for microphone permission only when the game first runs, never at launch
- Denying the permission degrades gracefully rather than dead-ending
- Sig et Ord recognises a spoken Danish word

**The things only a device can tell you**
- Narration sounds right in Danish — letters, numbers, the odd word
- Audio still works with the ringer switch off (UNKNOWN whether the shell fixes this)
- Drag-and-drop feels right, and a drag does not also count as a tap
- Nothing is clipped or unreachable on the real 12.9" screen
- The app resumes correctly after being backgrounded and swiped away

## 6. Recording a run

Note the date, the commit, and any line that differed from the baseline in §2. A finding is a
difference from the baseline — not the absence of one.

| Date | Commit | Result |
|---|---|---|
| 2026-09-04 | `e4a7ceb` | First run. Six reds → §2.1. Four real, two probe artifacts. |
| 2026-09-05 | `3fc22d2` | **Every phase at baseline.** 734 tests · lint 0 errors · audio 26/0/2 · smoke 27/0/1 · round 12/0/5 · difficulty 16/0/5 · ceremony 9/0 (`held=true` on all nine). Rungs 1–2 only; §5 still owed. |
| 2026-09-06 | `9387956` | **Corner rework (`e210722`+`53d0720`), every phase at baseline.** 780 tests · lint 0 errors · tsc · build · context 47999/48000 · selftest · smoke 27/0/1 · layout 210/0/8 · ceremony 9/0 · live 20/0/1. One real finding, fixed: the name pill would have shipped a child called **Dev** in all ten store shots (`?kidname=`). Rungs 1–2 only; §5 still owed. |
| 2026-09-06 | `ffa5167` | **FULL PASS before the 1.0 build — every phase at baseline.** 781 tests · lint 0 errors · tsc · build · context 47999/48000 · audit 1910 · schema both IN SYNC · shots 12 match · desc in sync · lexicon `fire` APPLIED · selftest · smoke 27/0/1 · layout **216/0/8, 0 DEAD** · audio 26/0/2 (after isolating `/math/numbers`) · difficulty 16/0/5 · round 12/0/5 · ceremony 9/0 (after isolating `/math/patterns`) · live 20/0/1. Build 16 attached to 1.0. Rungs 1-2; §5 owed on build 16. |
| 2026-09-06 | `a8bc650` | **Independent re-run of layout + ceremony by the implementing session.** layout 214/1/8 → the one red (`phone-land /farver/jagt`, one element 3px below the fold) **did NOT survive isolation**: `--only farver/jagt --concurrency 1` is 8/8, so it is the contention artifact §2.1 predicts. ceremony 8 PASS / 0 FAIL / 13 UNKNOWN, every crossing `beat=sticker, covers=true, held=true`. The 8-vs-9 gap against the row above is the DRIVER'S CLICK BUDGET on `/math/patterns`, not a regression — isolated twice, advancing 4 then 2 of the 8 it needs, UNKNOWN both times and never FAIL. Rungs 1–2 only; §5 still owed. |
