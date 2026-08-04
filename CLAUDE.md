# Børnelæring - Danish Preschool Learning App

Danish educational web app for children aged 5-7. Alphabet, math, colors, and memory games with native Danish audio narration.

## How to talk to the owner (applies to EVERY reply)

Short, plain, natural language. Answer first. A few sentences, not a report.

- **Don't explain reasoning he already agreed to**, don't estimate durations, don't recap the session.
- Name the command, the file, or the thing to tap — then stop.
- When he asks "in short", he means 3–5 sentences. A two-item question gets a two-item answer.
- Still say plainly what's broken or blocked, and flag real caveats — in a sentence, not a section.
- Keep the density where a future session is the reader: PRDs, commit messages, `.claude/rules`, this file.

This has been asked for three times (2026-08-01 ×2, 2026-08-04) and kept not sticking, because it only
lived in agent memory, which is advisory. It lives here now. Don't delete it, and don't let a long
research answer be the exception — the 2026-08-04 orientation question got ~10 paragraphs and the useful
version was three sentences.

## Tech Stack

- React 19 + TypeScript, Vite 8, Material-UI v9 (no Tailwind)
- Framer Motion for animations, Howler.js for sound effects
- Audio: `SimplifiedAudioController` singleton → `ttsClient` playback engine → **Azure AI Speech** (single TTS provider) → Web Speech API (fallback) → Howler (SFX). Danish da-DK voice (Christel) for most sections; Azure en-US Ava (multilingual) for the Engelsk section. The VoiceOverridePanel (opened from the "Til de voksne" corner menu) can swap the Danish narration voice live among all Azure VoiceLab voices. Danish pronunciation is corrected via a hosted W3C PLS lexicon (`public/da-DK.pls`) and per-letter phrasing overrides (`.claude/rules/audio-system.md`); inline IPA wraps a WHOLE utterance and exists only as a VoiceLab audition tool, not a per-word app fix. (Google TTS was removed in the Audio v2 rebuild; Google STT still powers "Sig et Ord".)
- Speech input (Sig et Ord): Google Cloud STT v2 via `/api/stt` + `useSpeechInput` — recognizer
  **`eu/chirp_3`**, because `short` returns ZERO results for a single isolated Danish word (measured)
- React Router DOM v7 (route components lazy-loaded via `lazyWithReload` — stale-chunk → reload-once recovery). Single hand-authored PWA manifest (`public/manifest.json`); **no service worker** (network-only)
- Deployment: Vercel (auto-deploy on push to `master`)

## Commands

```
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build (rewrites src/config/version.ts — don't commit that churn)
npm run lint         # ESLint
npm test             # Node built-in runner (node --test, type-stripped ≥22.18); unit tests in src/**/*.test.ts + lib/**
                     # Relative imports carry an EXPLICIT extension, and WHICH ONE depends on who runs the file:
                     #   `.ts` for the client/test graph (Node's ESM resolver rejects extensionless; Vite/tsc take both)
                     #   `.js` for anything a VERCEL FUNCTION reaches — api/, lib/, and the src/config modules they
                     #         pull — because Vercel compiles each file to a sibling .js and rewrites no specifiers.
                     #         `.ts` there is a production-only ERR_MODULE_NOT_FOUND (see .claude/rules/api-endpoints.md).
                     # Plain-node entries then need `--import ./scripts/js-to-ts-resolve.mjs` (test, dev:api, auth:*,
                     # tts:*, audit:*) — and "reaches" is TRANSITIVE: switching stickers.ts broke the prebake scripts,
                     # which nothing type-checks. Run each entry after touching an extension, don't reason about it.
npm run preview      # Preview production build
npm run tts:prebake  # Regenerate prebaked TTS (needs Azure creds; resumable). Commit its output.
npm run audit:check  # Narration guard (PRD-11): flags closed-set clips not signed off in docs/audit/
npm run audit:approve-all  # Owner bulk sign-off of the current narration set (after a /audit listen pass)
git push origin master  # Deploy to production (Vercel)
```

**Prebaked TTS (PRD-06):** the closed narration set is synthesized once into `public/sounds/tts/` +
a committed manifest; `ttsClient` plays those before Azure. **Every line the app speaks is prebaked**
(since 2026-08-02 that includes the composed sentences — math questions/facts, comparison facts,
sequence read-backs, colour-mix lines); the ONLY live-Azure text left is Sig et Ord's read-back of an
arbitrary spoken word. Composed lines are built by shared builders in `src/config/gamePhrases.ts` /
`letterWords.ts` / `ordlegWords.ts` so the enumerator bakes the exact same strings. Two ranges are
**DERIVED from `difficulty.ts`**, never hand-copied: `sequenceStarts` (109 Hvad Mangler read-backs — it
was a hardcoded 18, which is also what pinned skip-10 to one fixed question forever) and the Ordleg word
pools (~20 of those words had been reaching live Azure by accident, baked only when a word happened to
double as an `englishVocab` Danish gloss). **Adding or changing any spoken line
follows the 8-step protocol in `.claude/rules/audio-system.md`** (build in config → enumerate → pin in
a test → prebake → audit sign-off).

## Routes

5 sections — `/alphabet` `/math` `/farver` `/english` `/ordleg` — each a menu + its games, plus `/album`,
`/learning/memory/:type/:size`, and off-menu `/voicelab` and `/audit`. Every feature uses bookmarkable,
deep-linkable URLs (utilities in `src/utils/urlParams.ts`); routes are enumerated in `App.tsx`.

## Key Architecture

Each bullet is the rule that would cause a mistake if absent; the detail lives in the path-scoped rule it
points to (`.claude/rules/`, loaded when you touch matching files).

- **Audio**: Centralized `SimplifiedAudioController` singleton (single audio at a time — new audio cancels current; **no queue**). See `.claude/rules/audio-system.md` for mandatory rules.
- **Games**: two patterns — task-based **quizzes** (bounded rounds of 8 → `RoundResultScreen`; wrong answers only break first-try) and calm **learning browses** (free exploration, no round). Both earn **live per-task XP** (see Progression); stickers drop only on a level-up. gameIds are `<section>.<game>`. Per-game mechanics + invariants: `.claude/rules/games-catalog.md` · how to build: `.claude/rules/game-development.md` · drag games: `.claude/rules/drag-and-drop.md`.
- **In-game interaction language**: one shared vocabulary across every game — `<BackButton variant='game'>`, the `guideReaction`→`mascotBus` mascot bridge, a synchronous `sfx.play('tap')` on every answer press, `mascotBus.emit('streak')` + `celebrateTier('streak')` on the 3-in-a-row, and `celebrateTier` (never legacy `celebrate`). Games open straight to the instant-load board — the themed wipe's `mascotBus.emit('welcome')` is the only arrival cue. **Navigation always flows through the transition system / `RoundResultScreen` — no raw `navigate()` from inside a game.** The header holds the **reward ring and nothing else** (owner, 2026-08-02: a second progress meter beside the ring, and 8 pips is past the subitizing limit). Board surfaces come from the shared `TactileTile`/`PromptFocus`/`RepeatButton` + `src/theme/depth.ts` material — per-game wiring and the hand-rolled parity checklist: `.claude/rules/game-development.md`.
- **Layout**: Full-viewport, no-scroll game layouts. See `.claude/rules/responsive-design.md`.
- **Drag & drop / tap parity**: the Farver games plus Stav Ordet, Plus/Minus and Hvad Mangler use `@dnd-kit` via shared primitives in `src/components/common/dnd/`. **A game that accepts one gesture must accept BOTH** (owner, 2026-08-03: the drag games ignored a plain tap, and a 5-year-old taps) — the tap and the drop call **ONE resolve function**, never two copies of the scoring, and they share **`DRAG_ACTIVATION_DISTANCE`** so no gesture is both (a drag ending back over its own tile fires `onDragEnd` *and* the browser's trailing click). Which side carries the tap differs per game — whichever side is the child's CHOICE. Games whose prompt has no gap to drop into stay tap-only *by design*; `UnifiedQuizGame` mounts no DndContext unless a config sets `dragToPromptSlot`. **`kidCollision` (never `closestCenter`)** so abortive drags spring back instead of scoring. See `.claude/rules/drag-and-drop.md` for mandatory rules (the per-game tap/drop table, spring-back, advance-guard, floating-droppable measuring, the `sx`-not-raw-`style` gotcha, non-mutating `shuffle`).
- **Theming**: fully token-driven — one `ThemeTokens` object per skin, `buildTheme(tokens)` onto the MUI theme, **no styling values hardcoded in components**. Two mistakes that look fine on the default skin and break the others — **the rest, plus "adding a theme": `.claude/rules/theming.md`**:
  - **`getCategoryTheme(id)`, never `categoryThemes[id]`** — the static map is bound to the kid tokens and is not skin-aware.
  - **Accent text on a white surface uses `theme.onTileColor`**, never raw `accentColor` (a light skin accent is illegible on `tileSurface`); focal-zone text is `scene.dark ? accentColor : onTileColor`.
- **Scene & mascot & music**: an app-wide **persistent parallax world** renders behind every page (`src/components/common/scene/`), freezing on game routes and under reduced-motion; the **mascot** is rendered INSIDE each page and reacts via `mascotBus`; a per-world **music bed** plays on menu surfaces only, as a channel separate from TTS/SFX. Two rules bite hardest — **the rest (parallax overscan, home's shared arc, the gate-reporting music bed): `.claude/rules/scene-and-world.md`**:
  - **Progress shows in the world ONLY as ambient DENSITY.** Decor seated at hand-authored percentages was deleted as clutter (owner, 2026-08-03) — don't re-add anything positioned in the world unless its position DERIVES from the art.
  - Nothing in the scene may be positioned by a tuned percentage against content it doesn't know; that is the same rule as `.claude/rules/responsive-design.md`'s "reserve the space".
- **State**: Local React state only, no global state management — EXCEPT persistent progress (below).
- **The Reward Book / progress**: **ONE track — one reward slot.** `progressStore` (per-child, schema v4, **INERT until `profileStore.attach()`**) is the source of truth; everything else is DERIVED in the pure `src/config/progression.ts`. Five rules that a change here can silently break — **full model, curve, ceremony and surface rules: `.claude/rules/rewards-and-progression.md`**:
  - `collectedFromLevel(level) = level - 1` is THE mapping; never recompute it inline. `grantedSlots ≤ collectedFromLevel(globalLevel())` is an INEQUALITY and the gap IS a pending ceremony.
  - `rewardNumber()` is THE child-facing number. **Never show `globalLevel()` anywhere**, child- or adult-facing, and **never show the number as a DISTANCE** (no denominator, no "n to go" outside the adult pane). Guarded by `rewardSurfaces.test.ts`.
  - The reward path is **APPEND-ONLY and never shuffled**; totals are derived from `src/config/stickers.ts`, so don't quote a whole-book number anywhere.
  - Rewards are granted **ONLY by the ceremony** (`grantPendingRewards()` → `RewardOverlay`), never by the surface that noticed the crossing. **The ring is the ONLY door to Min Bog**, on every screen.
  - XP is **never difficulty-dependent** and any completed round ≈ one reward ("a round is a round").
- **Difficulty** (static, manual — **NO adaptivity by design**): a global Let/Normal/Svær + optional per-section overrides in `progressStore.settings.difficulty`, set in "Til de voksne" → Læring, read live via `useDifficulty(section)` / `progressStore.difficultyFor(section)`; every game regenerates the current question on a mid-game change. **What the three levels MEAN is defined ONCE** in the pure `src/config/difficulty.ts` — a shared spine plus one table per game and an `EXEMPT` map with a reason per entry; nothing re-derives a level inline. Two rules worth holding, everything else in **`.claude/rules/games-catalog.md`**:
  - **Verifying that a game READS its table is not verifying that the level is PLAYABLE** — those are two audits and the first is the cheap one. Tal Quiz passed every plumbing check while 60% of its *Let* questions were the hardest thing it asks. **Audit a level by SAMPLING the generators**, never by reading the table.
  - A harder level must **never cost rewards** (Svær's star budget is looser), mirroring the rule that XP is never difficulty-dependent.
- **SFX**: `sfx` singleton (`src/services/sfxClient.ts`, Howler) is a SEPARATE short channel from TTS — it never cancels/queues against narration. Cues live in `public/sounds/ui/*.mp3` (curated from the mascot packs; re-encode with `node scripts/transcode-sfx.mjs`). **All shipped audio is MP3, never Ogg/Opus** — Apple has no Ogg container before iOS/iPadOS 18.4, so Ogg silenced narration AND SFX on an older iPad (17.7) while only the mp3 music bed survived; guarded by `src/services/audioFormat.test.ts` (see `.claude/rules/audio-system.md`). Mute respects `progressStore.settings.sfxEnabled`. NEVER route SFX through `SimplifiedAudioController`. Cue files play in **full** (no Howler sprite), so a file's length = its playback length — keep cues short and trim curated clips, never ship a whole source track (PRD-07 cut multi-second clips, incl. a 47s "flip", down to short cues). Celebrations escalate by **tier** via `useCelebration().celebrateTier(tier)` (micro/streak/round/best/sticker/page/levelup/levelup-mini → confetti + matching SFX; `levelup-mini` is the non-interrupting mid-game level-up burst); the legacy `celebrate(intensity)` still works.
- **Routing**: React Router v7 in `App.tsx` (lazy-loaded route components), `useNavigate()` for navigation (but menus/games route through the themed transition system below, not raw `navigate`), NavigationAudioCleanup for audio cleanup (+ diagnostics route breadcrumbs) on route changes.
- **Menus & navigation**: menu/game navigation goes through `useTransitionNav()` → an opaque **wipe overlay** so the page swap happens fully covered; **raw `navigate()` bypasses it** (only NotFound / `RoundResultScreen` do that intentionally). The wipe obeys the same compositing-flicker rules as the persistent world — **the shared liveliness primitives and those rules: `.claude/rules/scene-and-world.md`**.
- **PWA / delivery / the target device**: network-only, **no service worker** — so **never design a feature around "works offline"**; a cold launch with no network fails at the document fetch. **The compatibility floor IS the child's device: an iPad Pro 2nd gen on iPadOS 17.7.11.** Check any new web/media API against **Safari 17**, not "latest Safari" — that is how Ogg audio shipped and silenced it — and the Vite build target is pinned to `['safari17','ios17']` for the same reason. **Caching/rewrite order, the manifest, `lazyWithReload`, the measured viewports and the harness build: `.claude/rules/pwa-and-device.md`** (device record: `docs/device-testing.md`).
- **Adult tools / bug reports**: the **"Til de voksne" corner button** (`AdultCorner`, global, bottom-right, a plain tap + `requirePin('adultMenu')`) opens the lazy `AdultSettings` two-pane surface. Three rules that a change here breaks silently — **the IA contract, snapdom's capture traps and the report flow: `.claude/rules/adult-surface.md`**:
  - The group/item structure is **DATA** (`src/config/adultSettingsIa.ts`, guarded), and **every irreversible action is TYPE-TO-CONFIRM** with a fixed Danish word — a PIN does not substitute for it.
  - A captured screenshot is a **computed-style clone, not a photograph**, so it can show an app that never existed; `stabilizeForCapture` exists for that and its options are A/B'd, not guessed.
  - Bug reports land in **Vercel Blob** under a short code, GET is **fail-closed** on `BUG_REPORT_READ_KEY`, and crashes auto-upload slim reports. **To debug one, use the `/debug-report` skill.**
- **Update banner** (PRD-09): a newer live build shows a **dismissible** pill; the apply-update is a **PIN-gated adult-menu item**, never a child-tappable reload.
- **Accounts / auth**: one adult account (Google OIDC + passkey) with N child profiles and local-first progress sync — see **`.claude/rules/auth.md`**. The app is HARD-GATED (`AuthGate` in `main.tsx`); `/api/tts-azure` + `/api/stt` require a 15-minute access JWT; `?nogate=1` bypasses both gates in DEV.
- **API endpoints**: the `api/*.ts` Vercel functions (paid TTS/STT proxies + bug-report storage + auth/profiles/progress) are a trust boundary — scoped CORS + origin allow-list + per-IP rate limit + no error-detail leaks, all via `lib/server-utils.ts`, and **mirrored in `dev-server.js`**. See `.claude/rules/api-endpoints.md`.
- **Env & secrets**: `.env.local` is the **only** home for several prod secrets, so a bare `vercel env pull` destroys them. That plus the Vercel CLI's env/provisioning traps (silent `--force` no-ops, `preview` needing an empty branch arg) is in `.claude/rules/env-and-secrets.md`.

## UI reference

**Screenshots** of every view (iPad + phone + overlays) live in `docs/ui-reference/` (see its README) — the baseline for UI/UX polish work; re-capture after visual changes.

## Verifying without the owner's iPad

Three rungs, and **a claim must name the rung it came from**: **(1)** headless Chrome (`cdp.mjs` — layout,
interaction, game logic, and `--audio-report`, which asserts audio actually made a sound), **(2)** real
WebKit with an iPad UA (`webkit.mjs` — the Safari engine, the app's iOS branches, and the codec table that
rung 1 structurally cannot catch; it can render but **cannot play audio at all**), **(3)** the owner's iPad
— the residue: whether the Danish sounds RIGHT, real touch feel, true iPadOS 17.7 behaviour. Speech
INPUT is drivable at rung 1 too — `mic.mjs` feeds Chrome a fake microphone from real Danish audio. App-wide
checking runs through `sweep.mjs --phase …` (`--selftest` first — it proves the guards fire).

**Unverified is not broken; say UNKNOWN.** Across the sweep sessions the probes' own defects outnumbered the
app's about five to one, every one a state that isn't a failure folded into the failure bucket — an
unreadable dependency, a deliberately silent one, or a feature that legitimately doesn't exist. And keep
assertions tight enough to fail: `xpAfter > xpBefore` passed on a build with `taskXp` zeroed.

The ladder table, the recipes, the DEV query params and the silence-vs-cancellation traps live in
**`.claude/skills/ui-screenshot/`**. No paid device farm removes the listening step (surveyed — see
`docs/device-testing.md`; don't re-research it).

## Conventions

- camelCase variables, PascalCase components
- **Never edit a file with a SHELL text pipeline — use the Edit tool.** Two separate corruptions, both
  silent, both worse than the line you meant to change:
  - a PowerShell pipeline (`Get-Content -Raw … -replace … | Set-Content`) re-encodes the whole file, so
    every `æøå` and `—` becomes mojibake — and EVERY file here is Danish. `git diff` showing a
    whole-file rewrite is the tell.
  - a `node -e "…"`/heredoc patch **command-substitutes any backtick in the replacement string** and
    silently drops what was inside it. Nearly every identifier in these docs is backticked, so this
    deletes exactly the words you were adding — it happened twice in one session (four table ids, then
    a constant name), and the file stays syntactically fine so nothing fails. If you must script a
    patch, single-quote the JS and make a missing anchor **exit non-zero** — that fail-fast is what
    catches the other trap here, that multi-line anchors never match this repo's CRLF endings.
- TypeScript strict mode
- Feature-based file organization
- Comic Sans MS for child-facing typography
- Danish language for all user-facing content
- Minimum 44px touch targets
- **No emoji ships in the UI** — baked art on child-facing surfaces, `lucide-react` on adult/dev ones.
  They render in the OS font, so they change shape between the iPadOS 17.7 floor device and a newer
  one. `src/config/noEmoji.test.ts` enforces it and **its allowlist is empty**; the only glyphs left in
  the tree are `console.*` log prefixes, which that guard excuses by rule. Never re-open the allowlist —
  add art plus a coverage test instead (see `.claude/rules/scene-assets.md`).
- **After fixing a bug, re-break the code to prove the new test/probe actually fails.** A test seeded
  with the wrong *shape* stays green while the product is broken — that is how the OAuth-claim bug
  shipped (it parked a raw session token where the real callback parks a signed one). Same trap: an
  unchecked `until()`/wait that times out silently makes every assertion after it vacuous. And a test
  that compares two sides which move TOGETHER (app vs. the prebake enumerator) passes vacuously when a
  fix is deleted from both — so also pin the value itself, not just the agreement. **The break must
  target what the test MEASURES**, and the specific test must be the one that flips: breaking something
  adjacent and watching the suite stay green proves nothing, which is how two vacuous tests survived a
  re-break pass in the accounts session. **A guard that greps SOURCE must strip comments before
  matching** — several here do (`noEmoji`, `authOverlayZ`, `rewardArtCoverage`), and a plain
  `src.includes('AUTH_Z.pin')` was satisfied by the prose comment explaining the fix, so deleting the
  fix left it green. The re-break is what exposes this; the comment is written by the same hand.
- **Another session may be working in this same tree.** When `tsc`/`npm test` fails in files your change
  never touched, run `git status` before touching anything — it's usually a parallel session mid-refactor.
  Leave their work alone and say whose the failure is: never "fix" it into a collision, never report their
  red build as your own result. **HEAD also moves under you**, so check `git log`, not just `git status` —
  part of your own work may already be committed by them, and reporting "nothing is committed" from memory
  of what you did is how a whole area got mis-reported as pending. The rest are all one hazard, that their
  `git add -A` takes the WORKING TREE:
  - **Never leave work staged, and don't rely on a clean index either** — an unstaged file is just as
    exposed. Stage and commit in ONE step; the protection is committing promptly, not tidiness.
  - **A shell error on a git command does NOT mean nothing happened.** A PowerShell here-string (`@'…'@`)
    passed to the **Bash** tool dies *after* `git add` and `git commit` have both run, leaving a commit with
    a truncated garbage message. Check `git log`/`git status` before retrying or you double-commit — use a
    bash heredoc there, and `@'…'@` only in PowerShell.
  - **A subset commit by explicit pathspec can leave YOUR OWN edit behind.** Re-check `git status` *after*
    one, not just before: anything still dirty that you touched is yours to commit now.
  - **They may also PUSH, and `master` is the deploy trigger** — a sibling's `git push origin master`
    carries every commit under HEAD, including yours. "Committed but not pushed" is NOT "not deployed":
    check `git rev-list origin/master..HEAD` before telling the owner something is still local, and don't
    leave a commit you wouldn't want shipped sitting on master.
  - **Verify the COMMITTED tree, not your working tree, before pushing** — otherwise their uncommitted WIP
    is silently part of what you claimed to verify. **If `git status` is empty the working tree IS HEAD**,
    so a green run already covers the commit; a throwaway checkout is only needed after a SUBSET commit of a
    dirty tree. If you make one (`git worktree add` at HEAD + a `mklink /J` junction to `node_modules`),
    **check the junction exists** — it fails silently, and then `tsc` "passes" because it never ran. Remove
    it with `git worktree remove`, never `Remove-Item -Recurse`: that FOLLOWS the junction and deletes
    through it into the REAL `node_modules`, and `-ErrorAction SilentlyContinue` hides the damage.
  - **A `node_modules` `@scope` that has gone missing is almost always your OWN interrupted delete**, not a
    colleague's install (the alphabetical cut-off is the signature) — it has been mis-blamed twice.
    `npm install` restores it, but ask first: it touches shared state.
- **A probe of an external service has THREE outcomes, not two.** Rate-limits, partial reads and
  fail-closed 403s must classify as UNKNOWN and retry with backoff — never fold into one of the real
  verdicts (a `.dk` whois rate-limit banner read as "domain registered" produced two false results
  here). Only match a response you positively recognise, and calibrate with a known-positive **and** a
  known-negative control, or the sweep is confidently wrong.
