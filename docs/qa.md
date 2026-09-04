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
| `npm test` | The pure logic: progression algebra, CRDT merge, difficulty tables, guest gate, config guards | 732 pass |
| `npm run lint` | 0 errors (warnings are pre-existing) | 0 errors, 24 warnings |
| `npm run context:check` | The guardrail byte budget still fits | under budget |
| `npm run audit:check` | Every closed-set narration clip is signed off | clean |
| `sweep --phase smoke` | Every route renders, shows **its own** Danish title, and throws no console error or page exception | 27 PASS · 0 FAIL · 1 N/A |
| `sweep --phase layout` | The same across **8 viewports** — iPad landscape/portrait/split, small iPad, wide, phone both ways — plus **nothing clipped off-screen** | 216 PASS · 0 FAIL · 8 N/A |
| `sweep --phase audio` | Narration **actually produced sound**, measured, rather than asking anyone to listen | 22 PASS · **4 FAIL** · 1 N/A · 1 DEAD |
| `sweep --phase difficulty` | Let/Normal/Svær change what the generators produce — not merely that a game reads the table | 16 PASS · 0 FAIL · 5 N/A |
| `sweep --phase round` | Eight tasks can be driven in a row; play never "ends" | 12 PASS · 0 FAIL · 5 N/A |
| `sweep --phase ceremony` | Seeds `?rewards=8` and plays to the crossing, so the sticker is paid where it was earned | **2 FAIL** |

**The baseline is not all-green, and that is the point.** The first full run (2026-09-04, commit
`e4a7ceb`) found six defects that 732 unit tests, a clean lint and a green build all missed. They are
untriaged — listed here so a later run can tell a regression from a known issue:

| Phase | Route | Reported |
|---|---|---|
| audio | `/learning/memory/letters` | NO AUDIO ATTEMPTED despite trigger `[aria-label="Hør igen"]` |
| audio | `/learning/memory/numbers` | NO AUDIO ATTEMPTED despite trigger `[aria-label="Hør igen"]` |
| audio | `/math/numbers` | SILENT — 1 of 3 clips genuinely failed, 0 decode failures |
| audio | `/math/patterns` | SILENT — all clips pre-empted before playing (something is cancelling narration) |
| ceremony | `/math/addition` | the board advanced UNDERNEATH the overlay (the generator was not deferred) |
| ceremony | `/math/subtraction` | the board advanced UNDERNEATH the overlay (the generator was not deferred) |

Not yet established for any of them: whether it is a real defect or the probe finding the wrong trigger.
Triage before treating a repeat as the same issue.

All sweep commands take `--engine chrome|webkit|both`, `--only <substr>` and `--concurrency <n>`.
**The layout phase is 224 jobs and takes 10–15 minutes** — run it in the background and read the summary.

## 3. Results that are N/A, not gaps

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
