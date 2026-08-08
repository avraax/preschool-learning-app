# PRD — Endless play: delete the round as a child-facing thing

Status: authored 2026-08-08, **NOT implemented**. Owner decision session; every open question in §4 was
answered by the owner before this was written.

Supersedes the round-end half of Reward Book PRD-01 (W7), Reward Horizon PRD-01 §4.5 and Reward Pacing
PRD-01's "deliberately not touched: `RoundResultScreen.tsx`". The **ceremony** those PRDs designed —
one picture on a solid screen, one prebaked line, the chapter second beat — survives **unchanged**; only
what fires it, and everything wrapped around it, is deleted.

---

## 1. Context — why this change

The same event is announced three times.

1. The **ring** in the game header fills all round, and flashes the won prize to full colour the moment
   it crosses a slot (`RewardRing.tsx` `FLASH_MS`).
2. The round then ends on **`RoundResultScreen`** — "Færdig!", three stars, a "Ny rekord!" ribbon, and a
   reward meter showing *the same next prize the ring was already showing*, with Spil igen / Tilbage.
3. The **sticker itself** lands later still, in a full-screen ceremony fired from that screen once its
   buttons arm — roughly 3–4 seconds after the round ended, and 30–90 seconds after the answer that
   actually earned it.

For a five-year-old only (3) means anything. (1) is a promise he cannot cash, (2) is an adult's summary
of a round he was not counting, and by the time (3) arrives the moment that earned it is gone. The
owner's words, seeing it on the iPad: *"the progress in the upper right circle can just continue on
another round … and the game itself can also show the celebration … and the sticker won also just pops
up individually."*

The existing design is deliberate and `rewards-and-progression.md` defends it in advance —
*"one quiet promise, one loud payoff"*, and of the result screen, *"It looks like clutter and is not."*
**That defence is overruled here on purpose.** The rule must be rewritten to record the reversal, not
left for a future session to re-derive from the old text (§9).

### 1.1 The model after this change

```
   answer  →  answer  →  answer  →  answer …                     forever
     │         │          │          │
     └─ ring fills a little each time (the ONLY ongoing signal)
                                     │
                              ring reaches full
                                     ↓  immediately, in-game, at the seam
                        ┌──────────────────────────┐
                        │      [ the sticker ]      │  ~3.4s, solid screen
                        │        "Delfin"           │  one prebaked line
                        └──────────────────────────┘
                                     ↓
                              play continues
```

One number, one book, one ring, one door — unchanged. What goes is **the round as an object the child
can perceive**: no boundary, no "Færdig!", no stars, no personal bests, no replay button, no round-end
confetti, no ring flash, no crossing chime. A game is left by the back button, which is already mounted
throughout play.

### 1.2 What this buys, beyond the simplification

- The payoff and the answer that earned it become **the same moment**, which is the whole point of a
  token economy at this age. The two-beat ("promise now, payoff later") is an adult's sense of pacing.
- It deletes the app's **only non-prebaked composed TTS line** (`RoundResultScreen.speakSummary` — "Godt
  klaret! Du fik N stjerne(r)", composed inline and therefore reaching live Azure on the child's iPad,
  against `audio-system.md`'s 8-step protocol).
- It deletes the **only in-game raw `navigate()`** (`RoundResultScreen.tsx:438`), so the
  "navigation always flows through the transition system" rule loses its exception.
- It removes three test-visible concepts (stars, bests, round bonus XP) with **zero** UI consumers other
  than the screen being deleted.

---

## 2. The small sticker under the big one (owner asked, answered)

The owner saw a second, smaller sticker below the big one in the ceremony and asked why.

That is **a second sticker earned in the same instant** — `RewardOverlay.tsx:328-340` trails extra owed
slots in at 74px behind the 230px headline, silently, with no extra speech. It is reachable today
because the ceremony is deferred to round end: a whole round pays up to `MAX_ROUND_XP = 62` against a
40 XP slot inside chapter 1, so one round can cross two slots and `grantPendingRewards()` hands both
over in one commit.

**This change removes the cause.** With the ceremony firing on the crossing itself, the largest single
XP event is one task — `taskXp(8, true) = 6`, worst case `taskXp(1, true) = 41` — against a 40 XP slot,
so a double is unreachable from ordinary play.

**Keep the trail code.** It stays reachable from a cross-device CRDT merge (the XP ledger is a
G-Counter; two devices that each played offline sum). Deleting it would let a merge swallow a sticker
with nothing shown. §7 turns this into a pinned test rather than a comment.

---

## 3. Decisions (owner, 2026-08-08 — do not re-litigate)

| # | Decision |
|---|---|
| D1 | **`RoundResultScreen` is deleted.** No round-end surface of any kind, in any game. |
| D2 | **Stars, star thresholds, personal bests and "Ny rekord!" are deleted entirely** — including from the adult pane. Nothing keeps recording them. |
| D3 | **Round-end bonus XP (`roundXp` +6 perfect / +8 new best) is deleted.** The owner **accepts the resulting ~20% slower sticker pace**. Do NOT re-tune `xpToNext`, `REWARD_XP` or `FAST_SLOTS` to compensate. |
| D4 | **The mid-game ring flourish on a crossing is deleted** — the prize colour flash, the bigger level-up pop, and `sfx.play('sticker-reveal')`. The ring keeps its fill and its ordinary per-grant pop. The ceremony is the entire announcement. |
| D5 | **The ceremony is visually unchanged** — full screen, one picture at 230px, the count badge on the frame, one prebaked line, `STICKER_MS` dwell. Only its **trigger** moves: immediately, in-game, at the seam. |
| D6 | **Chapter/book completion keeps its second beat**, same treatment. |
| D7 | **A game with a finite content pool cycles the whole pool before repeating** — never the same item twice within a cycle. Applies to memory boards and every bag game. |

---

## 4. What "immediately, in-game" means precisely

### 4.1 The seam already exists in all ten games

Every `useRound` game's advance path is the same three lines, inside the post-answer timer — **after**
the dwell and `stopCelebration()`, **before** the next question is generated, with the advance lock
still held:

```ts
const r = round.completeQuestion(firstAttemptRef.current)   // ← grants taskXp + xpBus.emit HERE
if (!r.done && r.streak % 3 === 0) { celebrateTier('streak'); mascotBus.emit('streak') }
if (r.done) finishRound(...) else generateNewQuestion()
```

`UnifiedQuizGame.tsx:585-613` · `MathOperationGame.tsx:349-368` · `ComparisonGame.tsx:320-336` ·
`SpellingGame.tsx:444-459` · `FarvejagtGame.tsx:358-367` · `RamFarvenGame.tsx:373-382` ·
`NuancerGame.tsx:248-257` · `FarveQuizGame.tsx:285-294` · `SpeakWordGame.tsx:718-728` (async, not a
timer) · `UnifiedMemoryGame.tsx:420-431` (the final-pair branch).

So the trigger is **one edit per game at a line that already exists**, and the input lock is the
advance lock the game already holds — released by the generator, which we defer.

### 4.2 The trigger reads the store cursor, never `leveledUp`

`globalLevel() > progression.lastCelebratedLevel`, exactly as `RoundResultScreen.tsx:175-181` did. Not
`grant.global.leveledUp`: the cursor also catches a crossing produced by a cross-tab write or a CRDT
merge, and it is the same value `owedRewards()` and `RewardWatcher` agree on.

### 4.3 The arm delay is not optional

Today `RewardOverlay`'s root is `onClick={dismiss}` with no arm. That was safe when the ceremony opened
on `RoundResultScreen`, after the child had already sat through the star beats. It is **not** safe once
the overlay opens ~1.1–2.0 s after a correct tap, in the middle of play, exactly where the finger is —
an excited tap-burst would dismiss the sticker before `StickerReveal` finishes its spring.

This is the single largest new risk in the change. The precedent is the result screen's own
`buttonsReady` gate (`:406-420`) and PRD-09 P1 before it (*"the reward moment is seen before it can be
dismissed"*). **Carry the reasoning across rather than losing it with the file.**

---

## 5. Work stages

### W1 — Ceremony plumbing (no visible change; ships green on its own)

**`src/services/rewardBus.ts`** — add `onDone?: () => void` to `RewardEvent`. It fires exactly once, on
dismiss *and* on the empty-ceremony bail-out. Two emits collapsed by `RewardOverlay.tsx:145-149` (which
keeps the highest level) must not drop the first callback — hold a set of pending callbacks.

**`src/components/common/RewardOverlay.tsx`** — two behavioural changes, zero visual:
- `dismiss()` (`:152-168`) invokes `onDone` after `markLevelCelebrated` + `progressSync.push`. The
  `owed.length === 0` bail-out (`:185-189`) already routes through `dismiss()`, so it is covered.
- **`TAP_ARM_MS = 700`** (§4.3): an `armed` state flipped by a timer, `onClick={armed ? dismiss : undefined}`.
  Keep `cursor: 'pointer'` so the surface still reads as tappable. No visual change.

**NEW `src/hooks/useRewardCeremony.ts`**

```ts
const ceremony = useRewardCeremony()
await ceremony.celebrateIfOwed(section)   // resolves immediately when nothing is owed
```

- Crossing check per §4.2. Emits `{ level: globalLevel(), section, onDone }`.
- Resolves `RESUME_MS = 250` after `onDone`, so a dismissing tap cannot be followed by a second tap
  landing on a freshly-generated board.
- Owns a mounted ref; **on unmount the promise is cancelled, never resolved**, so no deferred
  `generateNewQuestion()` can fire over the next screen. This is what makes the deferral safe in all ten
  games at once, and retires the per-game `mountedRef` hazard `game-development.md` documents.
- **It never grants.** `grantPendingRewards()` stays the overlay's job — the only grant point in the app.

### W2 — Games become endless; `RoundResultScreen` is deleted

**`src/hooks/useRound.ts` → `src/hooks/useTaskRun.ts`.** It survives as a per-task XP + streak counter,
not a round.
- `RoundConfig{length, starThresholds?, gameId?}` → `TaskRunConfig{tasksInRound, gameId}`.
  `starThresholds` is deleted here (its only forward was to `recordRoundResult`; `SpeakWordGame.tsx:426`
  is the one caller that passes it).
- `RoundState` keeps **`index`** (four games use it as a `chargeKey`: `UnifiedQuizGame.tsx:774`,
  `NuancerGame.tsx:373`, `MathOperationGame.tsx:487`, `ComparisonGame.tsx:559`) and **`streak`** (the
  every-3rd milestone). Delete `firstTryCorrect`, `longestStreak`, `done`, `enabled`, `reset()`.
- `completeQuestion` → `completeTask(firstTry)`, keeping the `grantTaskXp` + `xpBus.emit` block
  (`:72-78`) **verbatim** — `taskXp` is unchanged (D3 removes only `roundXp`). Additionally returns
  `crossedLevel`, read off the store cursor.
- **Add `thenContinue(next: () => void)`** — the one place the seam lives. If the last task crossed,
  `await ceremony.celebrateIfOwed(section)` then `next()`; otherwise call `next()` synchronously. Owns
  the cancellation. Ten games get one line instead of ten copies of an async dance — the same
  "don't re-fragment a shared primitive" rule `game-authoring.md` applies to `usePromptBag`.

**Round-length constants keep their values AND their names** — `ALPHABET_ROUND`, `ENGLISH_ROUND`,
`SPELLING_ROUND`, `NUANCER_ROUND`, `FARVEJAGT_ROUND`, `COLORS_QUIZ_ROUND`, `READING_ROUND_LENGTH`,
`ROUND_MIXES`, and the bare `8`s. They now mean *"the `taskXp` normaliser and the bag's seam window"*.
Re-document them in place; a rename touches ~25 sites for no behavioural gain. Keeping **one value per
game feeding both** is what stops the normaliser, the bag window and the pool floor drifting apart.

**`src/components/common/UnifiedQuizGame.tsx`** (largest single edit):
- Config `round?: RoundConfig` → `tasksInRound?: number` (default 8). Delete the `!round.enabled`
  endless branch (`:589-592`) — everything is endless now. Delete `audioOnly` (see W3).
- Delete `roundOutcome` (`:274`), `finishRound` (`:634-651`), `handleReplay` (`:654-663`),
  `degradedThisRoundRef` (`:278-279`), the `RoundResultScreen` import (`:33`) and render (`:791-797`),
  and the `roundOutcome ?` guards on `promptStage` (`:771`) and the difficulty effect (`:454-456`).
- Seam (`:595-606`):
  ```ts
  const r = run.completeTask(firstAttemptRef.current)
  if (r.streak > 0 && r.streak % 3 === 0 && !r.crossedLevel) {
    celebrateTier('streak', { sfxRate: 1 + Math.min(r.streak, 12) * 0.06 }); mascotBus.emit('streak')
  }
  run.thenContinue(() => generateNewQuestion())
  ```
  Suppressing the streak beat on a crossing is deliberate: one loud payoff, not two celebrations stacked
  in the same 200 ms — the same argument `RewardRing.tsx:142-151` records for deleting `levelup-mini`.
- `mascotBus.emit('round')` (`:602`) goes. The mascot's `round` pose survives with a real trigger —
  `RewardOverlay.tsx:199` already emits it.

**The eight other render sites**, identical shape each time (delete `roundOutcome` / `finishRound` /
`handleReplay` / the import + render + the `roundOutcome ?` guards; rewrite the seam line):
`UnifiedMemoryGame.tsx:612-618` (its seam is different — W6), `MathOperationGame.tsx:602-608`,
`ComparisonGame.tsx:498-504`, `SpellingGame.tsx:516-522`, `SpeakWordGame.tsx:808-814`,
`FarvejagtGame.tsx:508-514`, `RamFarvenGame.tsx:509-515`, `NuancerGame.tsx:496-502`,
`FarveQuizGame.tsx:359-360`.

Two need care:
- **`SpeakWordGame.tsx:699-733`** — `handleResult` is async with a live mic. The await sits between
  `runSpellingSequence(word)` and `setPhase('idle')`; `speech.prime({silent:true})` and
  `endingRef.current = false` must run **after** the ceremony resolves, or the mic re-opens under the
  overlay. `handleReplay`'s `phase`/`coach` resets move into the resume path.
- **`SpellingGame.tsx:435-460`** — the seam is two timers deep behind `mountedRef`. The hook's
  cancellation supersedes the inner check; leave the existing one in place rather than unpicking it here.

**Delete** `src/components/common/RoundResultScreen.tsx`, `DevRoutes.tsx`'s `DevRoundResult` (`:46-101`
+ imports `:7`, `:11`), `App.tsx:53` (lazy import) and `App.tsx:319` (`/dev/round-result`). Nothing in
`.claude/skills/ui-screenshot/` references that route.

### W3 — Delete the round-end economy and its schema residue

**`src/config/progression.ts`** — delete `RoundXpInput`, `roundXp` (`:130-140`), `MAX_ROUND_XP` (`:154`)
with its comment block. `taskXp` (`:119-120`) and `BROWSE_TASK_XP` untouched. **Per D3, do not re-tune
`xpToNext` / `FAST_SLOTS` / `REWARD_XP`.**

**`src/services/progressStore.ts`** — delete `recordRoundResult` (`:580-656`), `RoundResultInput`,
`RoundResultOptions`, `RoundOutcome`, `DEFAULT_THRESHOLDS`, the `roundXp` import (`:37`), `getGame`
(`:401-403` — zero non-test consumers), and `totals.totalStars` (`:164`). The surviving grant points are
`grantTaskXp`, `grantXp` (the `?rewards=n` dev seed) and `grantPendingRewards`.

**`src/config/difficulty.ts`** — `StarThresholds`, `STAR_THRESHOLDS` (`:78-82`), `starThresholdsFor`
(`:83`) and `memoryStarThresholds` (`:278-283`) all become dead; delete. `STAR_THRESHOLDS` is not part
of `TUNING`, so the "no dead level" guard (`difficulty.test.ts:171-184`) is unaffected.

**The `degraded` flag.** Its only consumer is the `newBests` suppression in `recordRoundResult`
(`:613-625`). The W4 degraded-mode *product behaviour* — an unanswerable audio-only board reveals its
own answer — is driven straight off `audio.narrationHealthy` (`UnifiedQuizGame.tsx:757`,
`MathGame.tsx:55`), never off `config.audioOnly`, and is fully preserved. So delete
`RoundResultOptions.degraded`, `degradedThisRoundRef`, **and** `config.audioOnly` (`:203`,
`MathGame.tsx:96`, `EnglishListenGame.tsx:65`), which otherwise becomes an unread config field — the
exact "silently dead flag" shape this repo's guards exist to catch.

**Schema — strip the dead fields, keep `SCHEMA_VERSION = 4`.** This is load-bearing:
`normalizePersisted` (`progressSchema.ts:483`) returns `null` for any `version !== 4` and
`progressStore.attach()` (`:245`) then falls through to `defaultPersisted()` — there is no migration
path by design (accounts release = clean sheet). **A v5 bump would wipe every child's book on update.**
Unknown keys are ignored, so an existing v4 blob still loads and the stale fields simply drop on the
next commit.
- `progressSchema.ts`: delete `PerGameStats` (`:71-77`), `emptyGameStats` (`:177-183`), `perGame` from
  `ProgressState` (`:100`) and `PersistedProgress` (`:152`), `totalStars` from both `totals` (`:102`,
  `:154`), and their blocks in `defaultPersisted` (`:207-208`), `derive` (`:305-311`) and
  `normalizePersisted` (`:522-537`). **Keep `totals.totalStickers`** — derived, free, and pinned.
- `progressMerge.ts`: delete `mergePerGame` (`:219-239`) + its call (`:354`), the `totals` max (`:355`),
  and drop `perGame`/`totals` from `contentFingerprint` (`:184-185`).
- `api/progress.ts` imports both modules (`:19-23`, `:109`, `:139-148`) but names no field — no server
  change. A rolling deploy is safe: an old client can push a doc carrying the removed keys and the new
  merge drops them. The fingerprint shape change costs exactly one extra push per device.
  `progressInvariantViolations` (`:347-376`) touches none of them, so there is no 422 risk.

### W4 — The ring keeps its fill and its ordinary pop, and nothing else

**`src/components/common/RewardRing.tsx`**, in the `xpBus` subscription (`:125-157`):
- Delete `FLASH_MS` (`:75`), the `flash` state + `flashTimer` + `shownRef` (`:97-100`), the
  `if (leveledUp) setFlash(...)` block (`:133-140`), the flash-clear effect (`:159-161`), and
  `sfx.play('sticker-reveal')` (`:155`).
- Collapse the pop to one amplitude: `scale: [1, 1.14, 1]`, `duration: 0.35` — drop the
  `leveledUp ? 1.35 : 1.14` branch (`:128-131`).
- Simplify the centre: `art = next ? rewardArt(next.reward.id) : uiArt.sparkle`; `bookFull = !next`;
  `centreStyle = bookFull ? {filter:'none',opacity:1} : silhouette`.
- The `flourish` prop loses its only use — delete it and the argument at `GameShell`'s call site.
- **Rewrite the header comment (`:39-53`)**: the two-beat it describes is now ceremony-only. Say so, or
  the next session restores the flash as a missing beat.

The `rewardSurfaces.test.ts` ring guards (`:125-141`, `:188-209`) assert geometry and the absence of a
second text node — unaffected.

### W5 — `RewardWatcher` becomes a pure safety net

**Keep the `game`-route gate.** Its meaning inverts but its value goes up: it now means *"on a game
route, the in-game seam owns the trigger."* Removing it creates a real race — `GRACE_MS` is 2500 and the
seam fires at `DWELL_FACT` 2000 / `DWELL_CORRECT()` 1100–1400 ms after the tap, so the watcher would
land inside the same window and sometimes open the ceremony mid-question instead of at the seam,
non-deterministically per game. The gate removes that by construction.

- **Reduce `GRACE_MS` to ~800 ms.** Its old job was letting `RoundResultScreen`'s direct emit win the
  ordering; on a menu the watcher is now the primary path and 2.5 s is dead air.
- Rewrite the header (`:8-20`, which names `RoundResultScreen` three times). The remaining cases are
  exactly: a reload before the overlay played, a tab closed inside the 250 ms write debounce, a
  cross-tab grant, and **the child tapping Back during the dwell before the seam fires** (the advance
  timer is cleared on unmount, so that crossing lands on the next menu).
- **Browse XP fires immediately too.** `useBrowseXp` (`src/hooks/useBrowseXp.ts:22-23`) calls
  `ceremony.celebrateIfOwed(section)` after a short beat so the item echo isn't cut. This makes
  "immediately, in-game" true everywhere and leaves the watcher genuinely net-only.

### W6 — Full-pool cycling (D7), and Memory's board turnover

**`src/config/promptBag.ts` already cycles the whole pool** — `refill()` (`:109-149`) deals a shuffle of
the *entire* pool as one pass and `next()` walks it; `window` only constrains the **seam between
passes**. So the eight bag games already satisfy D7. Two changes:
- **Clamp the window below the pool**: `Math.min(Math.max(2, window ?? 2), Math.max(2, pool.length - 1))`,
  recomputed inside `reset()` too. This removes the degenerate `idx < 0` fallback (`:120-121`, live
  today for Nuancer: window 8 over a 6-hue pool) **and** makes a real trap structurally unreachable —
  **with `window === pool.length`, `recent` holds the last n−1 draws, exactly one candidate survives at
  every position, and the new pass is forced to repeat the previous pass in the same order, forever.**
  (This is the intuitive reading of "never twice within a cycle" and it is wrong; do not set it.)
- Rewrite the doc block (`:62-79`) to lead with the property that is now the product rule: **the PASS is
  the cycle** — every item dealt exactly once before any repeat; the window governs only the seam. The
  current text explains everything in terms of "a round of 8".
- **Call sites unchanged** — all eight keep `window: <the same constant>` (`AlphabetGame.tsx:37`,
  `EnglishListenGame.tsx:39`, `EnglishWordGame.tsx:40`, `LaesOrdetGame.tsx:47`, `SpellingGame.tsx:111`,
  `FarveQuizGame.tsx:117`, `NuancerGame.tsx:102`, `FarvejagtGame.tsx:123`). `RamFarvenGame`'s own
  `makeTargetBag` (`colorMixing.ts`) is already a full-pass bag and stays exempt.

**Keep the "pool ≥ round length" guards** (`difficulty.test.ts:562-573`, `colorContent.test.ts:75-76`)
byte-identical, and **restate the reason**. The original justification ("a single round has to repeat
itself") dies with rounds, but the replacement is stronger: **in endless play the pool size IS the
repeat period.** A 5-word Læs Ordet pool means those five words on a loop of five, forever — worse than
it ever was inside a bounded round. The rule becomes *"a level's pool is its CYCLE LENGTH; below
`<game>_ROUND` the loop is visibly short"*.

**`UnifiedMemoryGame` — the actual new behaviour.** It does **not** use a bag today: `initializeGame`
(`:243-249`) does `shuffle(pool).slice(0, boardPairs)` per board, i.e. re-draws with replacement across
boards.
- **NEW `src/config/boardBag.ts`** — pure, Node-importable, `.ts` specifiers (it must be unit-testable:
  `game-development.md`'s "if a test needs to read a list, it belongs in `src/config/`").
  `makeBoardBag(pool, { rnd })` → `deal(n): T[]`. Walks one shuffled pass, refills only on exhaustion,
  and when a refill happens **mid-board** it skips items already dealt to the current board, returning
  them to the head of the next pass — so a single board can never show a duplicate pair. 29 letters at
  15 pairs gives boards of 15 / 14+1 / … which is exactly D7.
- `UnifiedMemoryGame.tsx`: hold the bag in a ref keyed on `config.gameType`; `dealBoard()` uses
  `bag.deal(config.boardPairs)` instead of `shuffle(sourceItems).slice(...)`. `config.generateItems()`
  becomes the *pool* — drop its now-redundant `shuffle` at `MemoryGame.tsx:52, 95`.
- **Auto-deal on the final pair** (`:420-431`): replace `setTimeout(() => finishRound(), 700)` with a
  `BOARD_TURNOVER_MS ≈ 700` beat (it exists precisely so the last match registers) →
  `await ceremony.celebrateIfOwed(section)` → `dealBoard()`. The board must not deal under the overlay:
  `isProcessing` is already `true` through match resolution (`:374`, cleared `:462`), so putting the
  await **before** `setRevealedCards([]); setIsProcessing(false)` spans the ceremony for free.
- Mid-board crossings (a non-final pair): the same await in the match branch, after `sfx.play('match')`
  and the pop are set, so the last match registers first.
- Delete `mismatchesRef`, `longestMatchStreakRef` (both fed only `recordRoundResult`), `finishRound`,
  `handleReplay`, `roundOutcome`, `config.starThresholds`. Keep `matchStreakRef` (the every-3rd
  `celebrateTier('streak')`) and keep suppressing it on the final pair — the turnover is its own beat.
- `restartGame` (the RestartButton) stays and draws from the same bag.
- `MemoryGame.tsx`: drop `memoryStarThresholds` / `starThresholds` (`:8, 41, 48, 91`).

### W7 — Tests

**Rewrites**
- `rewardSurfaces.test.ts:85-94` (the "no second door on `RoundResultScreen`" guard) → **the file does
  not exist** (`existsSync`, same shape as the `ScoreChip` guard at `:122`).
- `progression.test.ts:162-169` (`roundXp`) → delete. `:171-201` (`MAX_ROUND_XP`) → rewrite as a
  **`taskXp`-only crossing pin**: the biggest single task is `taskXp(1,true) = 41`, so no task can cross
  two slots at any XP (`gained <= 1`) — which also documents that the overlay's trailing-grant loop is
  **merge-only, not dead** (§2).
- `progression.test.ts:291-335` (pacing) → drop the `roundsToFillAt(MAX_ROUND_XP)` row (`:310`); keep
  `roundsToFillAt(REWARD_XP) = 252` and `roundsToFillAt(8 × taskXp(8,true)) = 210` as the only two pins,
  and record in the comment that the round bonus is gone and the owner accepted the pace (D3).
- `progressStore.test.ts:396-418` → delete; replace with a **grant-point cardinality guard**
  (`progressStore.ts` contains no `roundXp` / `recordRoundResult`; XP is granted at exactly the
  surviving methods). `:78-135` keeps working via `grantTaskXp` but drops the `outcome.*` assertions
  (`:88`, `:126-129`) and re-pins `:129` from 62 → 48 (`8 × taskXp(8,true)`).
- `progressStoreProfiles.test.ts:87-96` (detached zero-outcome) and `:337-372` (degraded) → delete;
  `:322-325` re-pointed once `totals` leaves the wire.
- `narrationHealth.test.ts:111-129` → replace with an **inverted guard on the reveal**: keep the wiring
  pinned at `MathGame` / `UnifiedQuizGame` (`:86-96` unchanged), and turn "no other game may claim
  `audioOnly`" into "no other component may contain a `narrationHealthy ? undefined :` reveal". Same
  invariant, re-pointed at what is now load-bearing.
- `progressMerge.test.ts:325-377`, `progressAdoption.test.ts:55-61, 98, 138` → drop removed fields.
- `promptDraw.test.ts:157` — `length:\s*${constant}` → `tasksInRound:\s*${constant}`; the rest stands.
- `difficulty.test.ts:67-78` — drop `STAR_THRESHOLDS` from "the shared spine is exactly this";
  `:575-587` (`memoryStarThresholds`) → delete.
- `promptBag.test.ts` — the pins survive the clamp (Nuancer 6/window 8→5 and Farvejagt 6/window 5 both
  keep `after`/`distinct`), but re-run to confirm.

**New guards — these are what carry the decision**
1. **`RoundResultScreen.tsx` does not exist.**
2. **No component renders stars or a record** — sweep `src/components/**/*.tsx` (comments stripped via
   the existing `codeOf` helper) for `uiArt.star`, `uiArt.trophy`, `Ny rekord`, `★`, `⭐`: zero hits.
   This is the guard that stops a "small celebration screen" growing back.
3. **The ceremony has exactly one primary trigger** — `rewardBus.emit(` appears in exactly two files:
   `useRewardCeremony.ts` and `RewardWatcher.tsx`.
4. **The trigger reads the store cursor**, not `leveledUp` (§4.2).
5. **Seam wiring, per game** — for each of the ten files, the continuation goes through
   `thenContinue(` / `celebrateIfOwed(`, **exactly once**, and no `if (r.done)` / `finishRound(`
   survives. Cardinality matters: two continuation sites means one path skips the ceremony.
6. **The ceremony is armed** — `TAP_ARM_MS` present and `onClick` guarded (§4.3).
7. **`makePromptBag` never freezes** — for a pool ≥ 3 with `window` requested at or above `pool.length`,
   two consecutive passes must not be identical.
8. **`boardBag`** — over 29 letters at 15/board: every item appears once before any repeat; no board
   contains a duplicate; a mid-board refill never duplicates within the board.

Run these through **`/re-break`**, particularly 2 and 5 — both are `includes`-shaped and therefore the
likeliest to be vacuously green.

### W8 — Probe, sweep and docs

- **`.claude/skills/ui-screenshot/round-probe.js` is already stale**: it detects round end by a
  `/Se bog/i` button removed on 2026-08-05 (`:10`, `:39`), so `resultScreen` is *permanently false* and
  `sweep.mjs:299` currently reports **every** game as "round never ended". New success criterion: drive
  N tasks and assert **XP moved by ≥ `taskXp × N`** (the `sweep.mjs:309` floor of 30 stays valid for 8
  tasks) plus **advances ≥ N**; drop `resultScreen` entirely.
- **Add a ceremony probe**: seed `?rewards=n` to land just under a slot, play to the crossing, assert
  `[data-reward-overlay]` appears **in-game** and the board does not advance beneath it
  (`data-reward-beat` + `document.elementFromPoint` at the board centre returning the overlay).
- **`sweep.mjs:285-311`** — remove `resultScreen` from the verdict; keep `UNSOLVABLE_BY_CYCLING` and the
  UNKNOWN-on-unreadable-store rule.
- **`CLAUDE.md`** ~`:75-80`: "bounded rounds of 8 → `RoundResultScreen`" → endless task play;
  "navigation always flows through the transition system / `RoundResultScreen`" → the transition system
  alone.
- **`.claude/rules/rewards-and-progression.md`**: delete the whole "Rounds & art" section (`:146-171` —
  26 lines about a screen that no longer exists); rewrite the ceremony bullets (`:139-142`) around the
  in-game trigger, the arm delay and watcher-as-net; drop `RoundResultScreen.tsx` from the front-matter
  `paths` (`:11`) and add the new hook; fix the "`roundXp` is bonuses-only" sentence (`:97-101`) and the
  ring's "full-colour flash on a crossing — that beat teaches the whole system" bullet, now the opposite
  of the truth. **Record the *why* for every deletion, especially the arm delay and the reversal in §1.**
- **`games-catalog.md`**: the closing "Shared shape" paragraph (`:91-94`); the pool rule (`:62-73`)
  restated as the cycle-length rule (W6).
- One-liners: `game-authoring.md:43-50`, `game-development.md:62` (`round` comes from `RewardOverlay`
  now), `scene-and-world.md:96`, `layout-contract.md:31`, `responsive-design.md:42` (drop
  `RoundResultScreen` from the compact-variant lists), `games-memory.md:22-24` (one board = one round →
  endless boards from a full-pool bag), `docs/ui-reference/README.md:43, 108`.
- Historical PRDs get a **superseded note, not a rewrite** (repo convention): `reward-pacing` §11/§12,
  `reward-horizon` §4.5, `reward-book` W7, `docs/prd/PRD-09-reward-and-result-ux.md`.

---

## 6. Order and shippability

W1 ships green alone (no visible change). W2 is the cut-over and must land with W3 and W7's rewrites in
the same commit — deleting `recordRoundResult` and its callers is not separable. W4, W5, W6 and W8 are
each independently shippable after W2. Suggested commits: `W1 plumbing` · `W2+W3+W7 the cut` ·
`W4 quiet ring` · `W5 watcher` · `W6 cycling + memory turnover` · `W8 docs & probe`.

---

## 7. Risks

- **The ceremony opens where the finger is** (§4.3). Mitigated by `TAP_ARM_MS`, the deferred generator
  and `RESUME_MS`. **Verify with a deliberate tap-burst on device, not a screenshot.**
- **Audio collision at the seam.** The correct-answer echo/fact is fire-and-forget and the ceremony's
  reward line will cancel whatever is still playing (one channel, no queue). At `DWELL_FACT` = 2000 ms
  the longest facts are essentially done, so this is acceptable — and deferring the next question means
  the reward line is never cut *by* the game, which is the direction that matters.
- **No stopping cue.** `plans/reward-horizon/research-progression-evidence-2026-08-02.md:766-772`
  explicitly names `RoundResultScreen` as the app's natural break under the ICO Age Appropriate Design
  Code reasoning. Endless play removes it; the ceremony is now the only pause. **Record this as a
  decision in the rule**, so a future audit finds the choice rather than the gap.
- **Slower pace is intended** (D3). If it later feels wrong, the lever is `xpToNext`/`FAST_SLOTS` in
  `progression.ts` — one constant, pinned by `progression.test.ts`. Do not reintroduce a round bonus.

## 8. Orphans

- `uiArt.star`, `uiArt.trophy` lose their last consumers. Follow the `flame` precedent
  (`src/assets/ui/index.ts:10`): **delete from the map, leave the `.webp` in git, record why** — an
  unused symbol there is exactly the silently-reappearing fallback the de-emoji work removed. Update
  `noEmoji.test.ts:56`'s inventory comment.
- SFX `'round-complete'`, `'star'`, `'sticker-reveal'` lose their last callers — remove from `SfxCue`,
  `SFX_FILES` and the volume map (`sfxClient.ts:33-35, 61-63, 91-93`). The mp3s can stay under
  `public/sounds/ui/`.
- `CelebrationEffect`'s `round` / `best` / `sticker` / `levelup-mini` tiers (`:191-193`) were already
  callerless; this change makes it permanent. **Prune now**, with the note at `:204-208`.
- `useGameState`'s `resetScore` loses its last caller once `handleReplay` goes (`score` already has no
  reader — `UnifiedQuizGame.tsx:253-256`). Flag as a follow-up, not part of this change.

## 9. Invariants that must survive

- `collectedFromLevel(level) = level − 1`; the gap to `grantedSlots` **is** a pending ceremony.
- `rewardNumber()` = `grantedSlots` is the child-facing number; **`globalLevel()` appears nowhere**,
  child- or adult-facing.
- **The number is never a distance** — no denominator or "n to go" on any child-facing surface.
- **Rewards are granted ONLY by the ceremony**, every owed slot in one commit.
- **Exactly one door to `/album` per surface**, and it is the ring's own tap.
- The in-game header holds **the ring and nothing else**.
- `taskXp` stays normalised ("a round is a round") and **XP is never difficulty-dependent**.
- `REWARD_PATH` is **append-only and never shuffled**; `FROZEN_FIRST_45` untouched.
- **Two XP tiers only, never a third.**
- `SCHEMA_VERSION` stays **4** (§W3 — a bump wipes the book).

## 10. Out of scope

Re-tuning the curve (D3). Any new round-end surface, in any form, including a "small card". Adaptive
difficulty. Time-based levers of any kind (daily caps, session limits, come-back-tomorrow). A second
door to Min Bog. Reordering the reward path. Changing the ceremony's visual design (D5).

## 11. Verification

1. `npm run lint` · `npm test` · `npm run build` (don't commit the `src/config/version.ts` churn).
2. **`/re-break`** on new guards 2 and 5 (§W7).
3. `npm run dev` + `?nogate=1`; `?rewards=8` seeds just under the chapter-1 boundary. Play Bogstav Quiz
   past the crossing: the ceremony opens **in-game**, the board does not advance under it, a tap-burst
   does not dismiss it early, and play resumes on the next question — never a "Færdig!".
4. Play 20+ answers in one sitting in a quiz and in a memory board: no round boundary is observable, no
   memory item repeats until the pool is exhausted, and a completed board re-deals itself.
5. `ui-screenshot` rung 1 + rung 2 (WebKit, iPad UA) on one quiz, one dnd game, one memory board and one
   browse; `--audio-report` to confirm the ceremony still speaks exactly one line.
6. Rung 3 (owner's iPad, iPadOS 17.7) for the tap-burst and the mic game. **That residue stays UNKNOWN
   until he plays it.**
