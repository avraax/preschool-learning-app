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
  - "src/components/common/StickerReveal.tsx"
  - "src/hooks/useRewardCeremony.ts"
  - "src/hooks/useTaskRun.ts"
  - "src/hooks/useBrowseXp.ts"
  - "src/hooks/useProgress.ts"
  - "src/components/rewardSurfaces.test.ts"
  - "api/progress.ts"
---

# The Reward Book & progression

**ONE track — one reward slot.** Reward Book PRD-01, extended by Reward Horizon PRD-01, re-tuned by
Reward Pacing PRD-01, and **cut down by Endless Play PRD-01**. `progressStore`
(`src/services/progressStore.ts`, **per-child** localStorage key `bornelaering-progress:<profileId>`,
schema **v4**, **INERT until `profileStore.attach()`**, private-mode-safe) is the single source of
truth: collected rewards and `progression` (`globalXp` + per-section `bloom` + `lastCelebratedLevel` +
`explored`). Read it via `useProgress()` (`useSyncExternalStore`). **Everything else is DERIVED** in the
pure, Node-importable `src/config/progression.ts`.

## THE ROUND IS NOT A CHILD-FACING THING (Endless Play PRD-01, owner 2026-08-08)

**This reverses what the rest of this file used to defend**, and the reversal is deliberate — it is
recorded here so nobody re-derives the old design from its own justification.

The same event was announced three times: the ring flashed the won prize to full colour, the round then
ended on `RoundResultScreen` (Færdig! · three stars · a "Ny rekord!" ribbon · a reward meter showing the
prize the ring had *already* shown), and the sticker itself landed later still — 3–4s after the round
ended and 30–90s after the answer that earned it. For a five-year-old only the sticker means anything.
This file used to argue that as *"one quiet promise, one loud payoff"*, and of the result screen,
*"It looks like clutter and is not."* **Overruled.** The two-beat is an adult's sense of pacing.

What is gone, permanently: `RoundResultScreen` (**no round-end surface of any kind, in any form,
including a "small card"**), stars and star thresholds, personal bests and "Ny rekord!", the round-end
bonus XP (`roundXp` / `MAX_ROUND_XP`), the ring's crossing flash and crossing chime, and the
`degraded` flag that only ever suppressed a best. `useRound` is now `useTaskRun`.

- **The ceremony fires AT THE SEAM, in-game** — `useTaskRun.thenContinue()` awaits it between "the task
  completed" and "generate the next question", with the advance lock still held, so the board can never
  deal itself under the overlay. Memory does the same around `BOARD_TURNOVER_MS`; `useBrowseXp` after a
  short echo beat. All of them go through `useRewardCeremony`, which **never grants** — that stays
  `grantPendingRewards`, in the overlay, the one grant point.
- **The trigger reads the STORE CURSOR** (`globalLevel() > lastCelebratedLevel`), never
  `grant.leveledUp`: the cursor also catches a cross-tab write or a CRDT merge, and it is the value
  `owedRewards()` and `RewardWatcher` agree on.
- **`TAP_ARM_MS` is not a nicety.** The ceremony opens ~1.1–2.0s after a correct tap, where the finger
  already is; without the arm an excited tap-burst dismisses the sticker before it appears. Same
  reasoning as the result screen's old `buttonsReady` gate.
- **A promise from `celebrateIfOwed` is CANCELLED on unmount, never resolved.** That single rule is what
  makes deferring the generator safe in all ten games at once, and it retires the per-game `mountedRef`
  ghost-prompt hazard.
- **The pace is ~20% slower and the owner accepted that** (D3). Do not re-tune `xpToNext` / `REWARD_XP`
  / `FAST_SLOTS` to compensate, and never reintroduce a round bonus.
- **A game with a finite pool cycles the WHOLE pool before repeating** (D7) — `promptBag` already did
  (the PASS is the cycle); Memory now does too, via `src/config/boardBag.ts`.
- **NO STOPPING CUE, and that is a decision.**
  `plans/reward-horizon/research-progression-evidence-2026-08-02.md:766-772` named `RoundResultScreen`
  as the app's natural break under the ICO Age Appropriate Design Code reasoning. Endless play removes
  it; the ceremony is now the only pause. Recorded so a future audit finds the choice, not the gap.

## The three definitions that carry the model

Each has its own way of going wrong.

- `collectedFromLevel(level) = level - 1` is **THE mapping** (level 1 = an empty book) — never recompute
  it inline. The invariant is an **inequality** (`grantedSlots ≤ collectedFromLevel(globalLevel())`) and
  the gap IS a pending ceremony; `progressInvariantViolations` guards it.
- `rewardNumber()` = `grantedSlots` is **THE child-facing number**, on every surface. **NEVER show
  `globalLevel()` anywhere, child- OR adult-facing** — it is always the number + 1, so it can only ever
  contradict whatever sits beside it (an adult "Niveau" row shipped for one review cycle and the owner
  read it as a bug on sight). The gap it opens is now momentary: the ceremony fires at the seam, so the
  number ticks up seconds after the crossing rather than at the end of a round.
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
- `taskXp(tasksInRound, firstTry)` normalises so **a notional round ≈ one reward** whatever its length
  ("a round is a round") and **nothing is difficulty-dependent** (fairness). `tasksInRound` is no longer
  a length — nothing counts down — it is the normaliser AND the prompt bag's no-repeat window, one value
  per game feeding both. XP is granted PER COMPLETED TASK, live, at three choke points —
  `useTaskRun.completeTask`, `UnifiedMemoryGame`'s match branch, and `useBrowseXp` (gated on
  **persisted** `progressStore.markBrowsed` so browse XP isn't re-farmable) — each pinging `xpBus` →
  `RewardRing`. **There is no round-END XP** (see the endless-play section above).

## Surfaces

**All read `progressStore.nextReward()`** so they can never disagree.

- `RewardRing` (game header + home + section menus): centre = the next prize as a **silhouette**, the arc
  fills around it, plus the flat count badge. **The ring fills, and that is all it does** — the
  full-colour crossing flash (which this file used to call "the beat that teaches the whole system"),
  the bigger level-up pop and the soft crossing chime are all DELETED (Endless Play D4). The ceremony
  fires immediately now, so it is the entire announcement and the ring has nothing to promise; its
  absence is the change, not a missing beat.
  **It is a GAUGE with a gap at the bottom and the badge seated in the gap**, because on a
  closed ring the badge is inside the swept path by construction: at bottom-right it occluded **fill
  29%→46%**, a quarter of the range in the middle of it, and no offset tuning fixes that. Every quantity
  is DERIVED in the pure `rewardRingGeometry.ts` (gap from the badge's own subtend + the rounded linecap,
  badge seated ON the ring path) and unit-tested with no DOM at each shipped size, pinned as a literal
  list naming its call sites.
  **`size` is the ring's ONE dimension — resizing it with `sx` ships a broken ring.** `sx` reaches only
  the outer Box, while the svg, the centre art (`size * 0.52`) and every badge quantity derive from
  `size`; a smaller box then flex-shrinks the inner div on ONE axis while the absolutely-positioned svg
  keeps its own width, so the ring's circle and its silhouette end up on different centres. Home shipped
  exactly that at phone landscape (measured 7.5px apart, ~21% of the diameter — owner report 323FF), and
  nothing downstream could catch it because a size reached that way never enters `SHIPPED_RING_SIZES`.
  Branch on the viewport and pass `size`/`compact`, as `GameShell` does; `rewardSurfaces.test.ts`
  forbids the `sx` shape at every call site.
- **No "+N" flyer** — at ~4% of the arc per answer the numeral means nothing to a pre-reader, and it was a
  second number on a 46px control.
- Min Bog (`/album`, `StickerAlbum`): icon-only chapter chips auto-opened at the current chapter,
  unreached chapters dimmed but **tappable**, slots in path order, exactly **one** glowing `next`
  silhouette and every later slot a **blank** plate.
- **The ring is the ONLY door to Min Bog** — home, every section menu AND every game tap through to
  `/album` (owner 2026-08-03; the in-game ring used to pass no handler, on the reasoning that a stray tap
  mid-play must do nothing — but the shared back button sits ~40px away in that same header and already
  leaves the game on a stray tap, so it protected nothing and only made one control behave differently per
  screen. Don't re-mute it). What must never come back is a SECOND entrance on one screen (two objects
  meaning "your rewards" is the confusion this model exists to remove) — `rewardSurfaces.test.ts` asserts
  exactly one `/album` route per surface, the ring's own tap. The in-game header holds the ring plus the
  static `ProfileBadge` and **nothing that measures performance**: the `ScoreChip` pip row is deleted.
- **`ProfileBadge`** (`src/components/common/ProfileBadge.tsx` — home, the section menus, Min Bog AND
  every game): the active child's baked animal portrait with their first letter, at PARITY with the
  ring's size, **OUTERMOST — past the ring, not before it** (owner reversed the original ordering,
  2026-08-09; the cost is that the untappable badge holds the corner the tappable ring used to). It
  renders as a bare cutout: **no plate, no ring, no border behind the portrait** — the picker's tile
  backing shipped here by mistake and read as a dim grey circle on the painted world, and the reward
  ring beside it has no backing either. Guarded by a fill COUNT (the letter's white disc is the only
  one). It is the child-facing half of the
  profile system (owner, 2026-08-09); before it, the active child was visible only behind "Til de
  voksne", so a two-child household could play a whole session as the wrong child. It is **static,
  untappable and progress-blind**, and that is enforced rather than conventional — `profileBadge.test.ts`
  fails the build if it imports `useProgress`/`progressStore`/`xpBus`, grows an `onTap`, animates,
  renders the name as text, or goes missing from any surface that renders a ring. **That guard is why
  "the ring and nothing else" could be narrowed**: the old rule's real subject was a second progress
  meter, and a portrait measures nothing. `pointerEvents: 'none'` is load-bearing (it sits ~8px from
  the ring, which navigates), and switching stays behind `requirePin('switchProfile')` — a 5-year-old
  must not be able to tap their own face into a sibling's book. An unnamed profile shows the portrait
  with NO letter (`src/config/profileInitial.ts`); there is no placeholder glyph and no avatar fallback.

## The ceremony

**Rewards are granted ONLY by the ceremony**: `progressStore.grantPendingRewards()` hands over every owed
slot in one commit → app-root `RewardOverlay` (`rewardBus`). It normally hands over exactly 1: with the
round bonus gone the biggest single XP event is one task (9 XP against a 40 XP slot), so the overlay's
**trailing-grant** row — extra owed stickers behind the headline — is now reachable ONLY from a
cross-device CRDT merge. It is KEPT, and `progression.test.ts` pins that as *merge-only, not dead*.

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
- **The tap is ARMED** (`TAP_ARM_MS`) — see the endless-play section above; without it the overlay
  dismisses under the tap-burst that opened it.
- `RewardWatcher` is a **pure safety net** and is still gated OFF `game` routes — the meaning inverts
  ("on a game route the in-game seam owns the trigger"), and removing the gate creates a real race with
  the seam's own 1.1–2.0s dwell. Its grace is ~800ms, not 2.5s, now that no result screen has to win an
  ordering. `lastCelebratedLevel` **starts at 1** so the empty book isn't celebrated.

## Art

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
