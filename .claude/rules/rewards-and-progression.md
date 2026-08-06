---
paths:
  - "src/services/progressStore.ts"
  - "src/config/progression.ts"
  - "src/config/stickers.ts"
  - "src/config/progressSchema.ts"
  - "src/config/progressMerge.ts"
  - "src/components/hub/*.tsx"
  - "src/components/common/Reward*.tsx"
  - "src/components/common/rewardRingGeometry.ts"
  - "src/components/common/RoundResultScreen.tsx"
  - "src/components/common/StickerReveal.tsx"
  - "src/hooks/useRound.ts"
  - "src/hooks/useBrowseXp.ts"
  - "src/hooks/useProgress.ts"
  - "src/components/rewardSurfaces.test.ts"
  - "api/progress.ts"
---

# The Reward Book & progression

**ONE track — one reward slot.** Reward Book PRD-01, extended by Reward Horizon PRD-01 and re-tuned by
Reward Pacing PRD-01. `progressStore` (`src/services/progressStore.ts`, **per-child** localStorage key
`bornelaering-progress:<profileId>`, schema **v4**, **INERT until `profileStore.attach()`**,
private-mode-safe) is the single source of truth: collected rewards, per-game bests, lifetime stars,
`progression` (`globalXp` + per-section `bloom` + `lastCelebratedLevel` + `explored`). Read it via
`useProgress()` (`useSyncExternalStore`). **Everything else is DERIVED** in the pure, Node-importable
`src/config/progression.ts`.

## The three definitions that carry the model

Each has its own way of going wrong.

- `collectedFromLevel(level) = level - 1` is **THE mapping** (level 1 = an empty book) — never recompute
  it inline. The invariant is an **inequality** (`grantedSlots ≤ collectedFromLevel(globalLevel())`) and
  the gap IS a pending ceremony; `progressInvariantViolations` guards it.
- `rewardNumber()` = `grantedSlots` is **THE child-facing number**, on every surface. **NEVER show
  `globalLevel()` anywhere, child- OR adult-facing** — it is always the number + 1, so it can only ever
  contradict whatever sits beside it (an adult "Niveau" row shipped for one review cycle and the owner
  read it as a bug on sight). Consequence, and it is correct: a mid-game crossing flashes the prize in the
  ring but does **not** move the number — that happens in the ceremony, with the sticker.
- **The number is never a DISTANCE.** No denominator, percentage or "n to go" on any child-facing surface
  — only the ring's fill signals nearness. The honest "n af N" belongs in the adult pane and nowhere else.

Both of the last two are guarded by `src/components/rewardSurfaces.test.ts`, which reads the components
as source.

## The path

**Chapters of 9, and its totals are DERIVED.** `REWARD_SLOTS`/`CHAPTER_COUNT` live in
`src/config/stickers.ts` beside `REWARD_CHAPTERS` (NOT in `progression.ts`, which must not import it —
the dependency points the other way and a cycle has to survive plain Node too), so **adding a chapter is
data + art + prebake, no code** (recipe:
`plans/reward-horizon/tmp-prd-reward-horizon-01-one-number-one-book.md` §10).

- **APPEND-ONLY, forever.** `firstAt` is keyed by reward id and `rebuildCollected` walks slots through the
  path, so inserting or reordering silently re-assigns every existing child's book; `stickers.test.ts`
  pins the frozen prefix and the totals as literals.
- **The ORDER MUST NEVER BE SHUFFLED** (no `shuffle()`, no random pick, anywhere): determinism is what
  lets the ring preview a prize before it's earned.
- **The book ENDS at its last authored chapter.** The old gold pass (wrapping past the end into shiny
  duplicates) is deleted, so `owedRewards()` clamps at the cap and the merge caps the cursor too (the XP
  ledger is a G-Counter, so two devices that each filled the book offline sum past the end). A full book
  means it is time to add a chapter, not to recycle a prize.

## The curve

`xpToNext` = `REWARD_XP` for the first `FAST_SLOTS`, **×3 after** — **two tiers only, never a third**
(that is the grind more chapters exist to avoid). `FAST_SLOTS` is one chapter's worth, so **chapter 1 and
only chapter 1** is one-sticker-per-round: dense-then-thin is the recommended shape for a token system
(establish on continuous reinforcement, then thin), and "the first page is fast" is a rule a child can
experience. After that a sticker costs ~3 rounds, and the ring moves ~38% per round (it was ~115% — a
spinner that reset, not a progress meter).

- **Whole-book totals are DERIVED — don't quote one anywhere.** It moves every time a chapter is
  appended, and CLAUDE.md carried a hard-coded "72-slot / 7920 XP / ~172 rounds" for exactly as long as it
  took to add one. `xpForSlots(REWARD_SLOTS)` is the number; `progression.test.ts` pins it as a literal so
  growing the book stays a deliberate act.
- **`xpForSlots(n)` is the ONE definition** of "XP to have been awarded n slots" — it was hand-copied in
  four places including the shipping `?rewards=n` dev seed, so a tier change silently corrupted the
  screenshot baseline. Pinned as LITERALS in `progression.test.ts` (a derived pin agrees with itself while
  the product regresses).
- The curve is **convex**, so two devices that each played offline can sum to more slots than their summed
  XP justifies and `progressMerge`'s clamp fires on valid data — pinned by its CONVEXITY test, and the
  clamp is what keeps `grantedSlots ≤ collectedFromLevel(globalLevel())` true.
- `taskXp(tasksInRound, firstTry)` normalises so **ANY completed round ≈ one reward** whatever its length
  ("a round is a round"), `roundXp` is **bonuses-only** (perfect/new-best, carried into the next prize),
  and **nothing is difficulty-dependent** (fairness). XP is granted PER COMPLETED TASK, live, at three
  choke points — `useRound.completeQuestion`, `UnifiedMemoryGame`'s match branch, and `useBrowseXp` (gated
  on **persisted** `progressStore.markBrowsed` so browse XP isn't re-farmable) — each pinging `xpBus` →
  `RewardRing`.

## Surfaces

**All read `progressStore.nextReward()`** so they can never disagree.

- `RewardRing` (game header + home + section menus): centre = the next prize as a **silhouette**, the arc
  fills around it, full-colour flash on a crossing — that beat teaches the whole system — plus the flat
  count badge. **It is a GAUGE with a gap at the bottom and the badge seated in the gap**, because on a
  closed ring the badge is inside the swept path by construction: at bottom-right it occluded **fill
  29%→46%**, a quarter of the range in the middle of it, and no offset tuning fixes that. Every quantity
  is DERIVED in the pure `rewardRingGeometry.ts` (gap from the badge's own subtend + the rounded linecap,
  badge seated ON the ring path) and unit-tested with no DOM at each shipped size, pinned as a literal
  list naming its call sites.
- **No "+N" flyer** — at ~4% of the arc per answer the numeral means nothing to a pre-reader, and it was a
  second number on a 46px control. A mid-game crossing is **one soft `sfx.play('sticker-reveal')`**, never
  confetti: one quiet promise, one loud payoff.
- Min Bog (`/album`, `StickerAlbum`): icon-only chapter chips auto-opened at the current chapter,
  unreached chapters dimmed but **tappable**, slots in path order, exactly **one** glowing `next`
  silhouette and every later slot a **blank** plate.
- **The ring is the ONLY door to Min Bog** — home, every section menu AND every game tap through to
  `/album` (owner 2026-08-03; the in-game ring used to pass no handler, on the reasoning that a stray tap
  mid-play must do nothing — but the shared back button sits ~40px away in that same header and already
  leaves the game on a stray tap, so it protected nothing and only made one control behave differently per
  screen. Don't re-mute it). What must never come back is a SECOND entrance on one screen (two objects
  meaning "your rewards" is the confusion this model exists to remove) — `rewardSurfaces.test.ts` asserts
  exactly one `/album` route per surface, the ring's own tap. The in-game header holds the ring and
  **nothing else**: the per-question `ScoreChip` pip row is deleted.

## The ceremony

**Rewards are granted ONLY by the ceremony**: `progressStore.grantPendingRewards()` hands over every owed
slot in one commit (normally 1; a perfect+new-best fast-tier round can cross 2) → app-root `RewardOverlay`
(`rewardBus`).

- **ONE PICTURE ON A SOLID SCREEN** (Reward Pacing D6): a near-solid scrim, the sticker at 230px, its
  Danish name, and the count **folded into the frame's corner** — nothing else. The "Nyt klistermærke!"
  banner and the 3×3 chapter dot grid are **deleted** (two texts around one picture is the clutter; nine
  dots answer a question a 5-year-old can't read, and Min Bog answers it properly). The count is moved,
  **never deleted** — the grant happens at the start of the beats effect, so dropping it would let the
  number change while nobody is looking.
- Chapter/book completion is a **SECOND BEAT** (companion stage-up + headline on its own screen), not more
  rows in the same column. It is the one extra tier (`celebrateTier('page')`, fired when beat 2 opens),
  and the companion clamps on `COMPANION_STAGES` (the baked stages a world ships), **deliberately not
  `CHAPTER_COUNT`** — the book grows and the art doesn't, and it must never regress.
- Dwells are **measured, never guessed** (`STICKER_MS` = the longest `rewardLine` clip + ~250ms element
  startup). It speaks **exactly one** prebaked line; beat 2 is silent and the chapter line plays across
  both.
- `RewardWatcher` is gated OFF `game` routes so the ceremony never interrupts play (it fires on the next
  menu); `RoundResultScreen` emits directly, keyed on the **store cursor**
  (`globalLevel() > lastCelebratedLevel`, **NOT** `outcome.xp.leveledUp` — the crossing is usually
  mid-round), and `lastCelebratedLevel` **starts at 1** so the empty book isn't celebrated.

## Rounds & art

Rounds are bounded (`useRound`, default 8, no timer; wrong answers only break a question's first-try flag)
and end on `RoundResultScreen` (stars → a **wordless** "Ny rekord!" ribbon → reward meter → replay/back),
whose buttons stay `pointer-events:none` until they animate in and whose beats **fast-forward** on a tap
via a keyed `<Fragment>` remount (framer won't reschedule an already-pending delayed animation just by
lowering its `delay`). A round played in the W4 degraded audio mode passes `degraded` and records no
personal best — see the narration-health section in `.claude/rules/audio-system.md`.

**That screen was TRIMMED on sight, 2026-08-05 ("way too many elements") — from 11 elements to 5, and the
principle generalises to any child-facing surface: the reader is five and cannot read.** What went, and
why none of it should be "restored":

- The record **delta lines** (`Længste stime: 0 → 6`, `Stjerner: 0 → 2`) — numeric arrows in small text
  are adult telemetry. They did NOT move to the adult pane; they no longer exist (owner). `previousBests`
  survives in `RoundOutcome` only because `anyNewBest` feeds `roundXp`'s new-best bonus.
- The **streak readout row** (`6 i træk!` + the flame) — it restated the ribbon, in text, after the streak
  had already been celebrated *during* play. It is still **spoken** in `speakSummary`: hearing works for a
  pre-reader where reading does not, which is what made the row the redundant half. `uiArt.flame` was its
  only consumer and is deleted with it rather than left exported as a dead symbol.
- **"Se bog"** — a second door to Min Bog on a screen whose header already shows the ring. The one-door
  guard only inspected the files that RENDER a ring (`GameShell`/`GameSelectionLayout`), so it structurally
  could not see a door added by a screen drawn INSIDE one; `rewardSurfaces.test.ts` now also asserts
  `RoundResultScreen` has **zero** `/album` routes (re-broken).

What deliberately stayed: the **stars** (the score, and the only thing a pre-reader reads instantly) and
the **reward meter with the next prize's silhouette** — wordless, and the "this round earned that" link to
the ring the child watched all round. It looks like clutter and is not.

Reward art: `rewardArt(id)` from `src/assets/rewards/` (glob manifest) — **every surface renders it
unconditionally, there is no glyph fallback**, so `rewardArtCoverage.test.ts` keeps that safe; a new reward
SUBJECT must also pass the silhouette test in `.claude/rules/scene-assets.md`.

DEV: `?rewards=<n>` seeds the book at any point, including past the end (which must be indistinguishable
from a full book).

## Persistence

The **persisted** form is a composition of CRDTs (`src/config/progressSchema.ts` v4 + `progressMerge.ts`,
both PURE and shared with `api/progress.ts`) from which the read model is DERIVED, so cross-device sync can
never violate the invariants. Merge algebra + the G-Counter/epoch rules: `.claude/rules/auth.md`. **There
is NO v3 migration** — the accounts release was a deliberate clean sheet, and `utils/storageReset.ts`
sweeps the old keys once per device.

**A new `settings` field must be COPIED EXPLICITLY in `normalizeSettings`, or it is silently dropped on
load.** That function builds a fresh object from `defaultSettings()` and copies field by field, so an
addition to the `ProgressSettings` interface type-checks, persists, round-trips through the pane's own
read, and then vanishes the moment the document is re-hydrated. This shipped the "Flydende grafik" toggle
doing NOTHING with every unit test green (the setting was written, read back from `localStorage` by the
test, and never reached the renderer). An OPTIONAL field whose absence means the default needs no schema
bump and no migration — that is the `themeId` / `smoothGraphics` pattern — but it still needs the copy.
The tell is that the pane shows the right value while behaviour doesn't change; check the normaliser
before anything else, and prefer an end-to-end check over a unit test that only re-reads storage.

The word **"trin" no longer appears anywhere** child- or adult-facing.
