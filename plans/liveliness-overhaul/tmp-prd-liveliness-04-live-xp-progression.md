# Liveliness PRD — Live Cross-Game XP Progression (rework)

**Date:** 2026-07-15
**Part of:** Liveliness & Journey Overhaul (see `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md`).
**Supersedes:** the *earning* and *visibility* portions of PRD-01. Everything PRD-01 built stays
(`progressStore` `progression` slice, `applyXp`, selectors, `useProgress`, `levelUpBus`/`LevelUpOverlay`/
`LevelUpWatcher`, `ProgressionCompanion`, the `RoundResultScreen` XP-meter beat, per-section bloom). This PRD
changes **when XP is granted (per task, live) and where it is shown (everywhere)**, and **re-roles stickers as
level-up trophies**.

---

## Context

PRD-01 shipped a global XP/level system, but as built it earns **only at the end of an 8-question round** and is
**visible only on the home page**. So during play there is no running progress, the cross-game level feels
absent, and answering a couple of questions then leaving banks nothing. The owner expected the opposite:
**progress that accrues per task, live, visibly, and carries across games** — the loop that keeps a 5-year-old
focused and coming back.

This rework makes the single shared level grow on **every completed task in any game**, shows it **live in a
compact ring in the game header (and on menus/home/result)**, celebrates level-ups **without interrupting play**,
and turns **stickers into the keepsake of a level-up** (so the two rewards no longer fire at the same cadence).

**Success looks like:** he answers a question → the header ring ticks up and a little "+3" flies into it; he
switches from Math to Alphabet → the *same* ring keeps climbing; a few tasks later it fills and pops ("Trin 5!")
without stopping the game; when the round ends he gets the big ceremony and a new sticker for the album.

---

## Guardrails (from roadmap, repeated for self-containment)

- iPad-first, no-scroll full-viewport, 44px+ targets, Danish, Comic Sans MS, token-driven, reduced-motion (keep
  audio/reward, drop motion). One TTS at a time; SFX a separate channel.
- **No adaptive difficulty**, and **XP must not depend on the difficulty setting** (fairness).
- Dev servers in **Windows PowerShell** (never WSL).

## Decisions locked with the owner (this session)

| Topic | Decision |
|---|---|
| Earning unit | **Per completed task** (question answered / pair matched / color board finished). |
| First-try | **Base + first-try bonus** (earn even after a wrong tap; small extra when first-try-perfect). |
| Round-end | **Bonuses only** at round end (perfect-round, new-best) — the per-task portion is NOT re-granted. |
| Anti-grind | **None** (single child; earning always requires completing real tasks). |
| Per-task feel | **Ring ticks + "+X" flyer** from the tapped answer into the ring. |
| Visibility | **Everywhere** — in-game header, section menus, home, round-result. |
| In-game form | **Compact ring + number** (coexists with the round-progress `ScoreChip`). |
| Mid-game level-up | **Flourish now, big finish later** — non-interrupting in-game burst + ring pop; full ceremony deferred to the result screen / next menu. |
| Pace | **Steady climb** (consistent effort per level; first level-up within a session or two). |
| Max level | **Climb forever** (companion reaches a final form, number keeps rising). |
| Persistence | **localStorage as-is** (survives close/reopen; rare iOS long-gap eviction accepted). |
| Currencies | **Level is primary** (album kept, home "Min Bog" shelf shrunk/relocated). |
| Sticker model | **Trophy of a level-up** (stickers stop dropping per-round/per-browse; a level-up grants one). |
| Task fairness | **Weighted per game** (per-task XP tuned for ~comparable XP/minute across games). |
| World bloom | **Keep, secondary** (auto-fed by per-task XP; level is the headline). |
| Browse screens | **Per new item explored** (small live XP per distinct new item; replaces the lump +6). |

---

## Current state (verified, with anchors)

- **Earning choke points are few, not 18.** `useRound.completeQuestion(firstTry)` (`src/hooks/useRound.ts:52`)
  fires **once per completed question** and already carries the first-try bit — used by **9 games**:
  UnifiedQuizGame's 7 configs (`alphabet.quiz`, `math.counting`, `math.patterns`, `ordleg.read`,
  `english.listen`, `english.word`, `english.translate`) + `ComparisonGame` + `MathOperationGame` +
  `SpellingGame` + `SpeakWordGame` + all 4 Farver games. `UnifiedMemoryGame` matches per-pair at
  `:362`/`:375` (no `useRound`; one board = one round). Browse screens grant in `maybeAwardExploration()`.
- **Store:** `applyXp(draft, section, amount)` (`src/services/progressStore.ts:537`) feeds BOTH `globalXp`
  (→ derived level) and section `bloom` in one commit; `grantXp` (`:579`); selectors `globalLevel` (`:586`),
  `xpProgressToNextLevel` (`:590`), `bloomFor` (`:607`); `markLevelCelebrated` (`:615`). `recordRoundResult`
  (`:451`) folds round XP via `roundXp` and `applyXp` at `:502-513`; per-round sticker grants at `:488`/`:493`.
  `sectionForGameId(gameId)` (`:684`) maps `gameId` → `SectionId` (colors.* → `colors`).
- **Curve today** (`src/config/progression.ts:11`): `xpToNext = min(260, max(20, 20 + 15*(level-1)^1.25))`.
  `roundXp` (`:57`) = `8 + 2*correct + (perfect?6) + (newBest?8) + 3*stickerCount + (pageCompleted?15)`.
- **Display today:** `ProgressionCompanion` (`src/components/common/ProgressionCompanion.tsx`) mounted only on
  `HomePage` (`src/components/home/HomePage.tsx:168`). `GameShell` header has one `score?: React.ReactNode`
  slot (`GameShell.tsx:29`, rendered in the Toolbar at `:131`, `justify-content: space-between`; phone-landscape
  branch `:110-129`). `RoundResultScreen` reads `outcome.xp` (`:86-88`) and emits `levelUpBus` (`:173`).
- **LevelUpWatcher** (`src/components/common/LevelUpWatcher.tsx`) currently fires the overlay whenever
  `globalLevel() > lastCelebratedLevel` **regardless of route** — it must be gated (see §5).

---

## Target design

### 1. Weighted per-task XP (`grantTaskXp`)

Add to `src/config/progression.ts` (pure, tunable, never difficulty-dependent):
```ts
// Base XP per completed task + first-try bonus, keyed by gameId (fallback 'default').
// Tuned so a few minutes of ANY game earns roughly comparable XP.
export const TASK_XP: Record<string, { base: number; firstTry: number }> = {
  default:            { base: 3, firstTry: 1 }, // quiz question, math op, comparison, laesordet, english, mic
  'ordleg.spelling':  { base: 4, firstTry: 2 }, // per completed word
  memory:             { base: 2, firstTry: 0 }, // per matched pair (many per board; no first-try notion)
  'colors.farvejagt': { base: 6, firstTry: 2 }, // per completed board (big task)
  'colors.ramfarven': { base: 5, firstTry: 2 }, // per correct mix
  'colors.nuancer':   { base: 5, firstTry: 2 }, // per completed shade-set
  'colors.quiz':      { base: 3, firstTry: 1 }, // per question
  browse:             { base: 1, firstTry: 0 }, // per NEW item explored
}
export function taskXp(gameId: string, firstTry: boolean): number {
  const t = TASK_XP[gameId] ?? TASK_XP.default
  return t.base + (firstTry ? t.firstTry : 0)
}
```

New store method (`src/services/progressStore.ts`), reusing `applyXp`:
```ts
grantTaskXp(gameId: string, opts: { firstTry: boolean }): XpGrantResult {
  const draft = structuredCloneState(this.state)
  const section = gameId === 'browse' ? /* caller passes real section, see §3 */ ... : sectionForGameId(gameId)
  const result = this.applyXp(draft, section, taskXp(gameId, opts.firstTry))
  this.commit(draft)
  return result
}
```
For `browse`, pass the section explicitly (browse screens know their section): make the signature
`grantTaskXp(gameId: string, opts: { firstTry: boolean; section?: SectionId })` and use `opts.section` when
`gameId === 'browse'`, else `sectionForGameId(gameId)`. Returns `XpGrantResult` so callers see `leveledUp`.

### 2. Round-end = bonuses only (avoid double-count)

Rewrite `roundXp` to grant **only extras** (per-task XP is now live):
```ts
export function roundXp(i: RoundXpInput): number {
  let xp = 0
  if (i.mistakes === 0) xp += 6   // perfect-round bonus
  if (i.anyNewBest) xp += 8       // new personal best
  if (i.pageCompleted) xp += 15   // a sticker page just completed (from a level-up sticker; see §2b)
  return xp                       // NO base, NO per-correct, NO per-sticker term
}
```
`recordRoundResult` keeps calling `applyXp(draft, section, roundXp(...))` (`:502-513`) so the round-end bonus
still feeds level + bloom and `outcome.xp` still exists for `RoundResultScreen`. Update the doc comment there.

### 2b. Stickers become level-up trophies

- **Remove** the per-round sticker grants in `recordRoundResult` (`grantSticker` at `:488` and the new-best
  bonus at `:493`) — `outcome.stickers` becomes `[]` for a normal round. Keep `pageCompleted` detection wired
  to the **level-up** sticker grant instead.
- **On a level-up**, grant exactly one sticker: reuse the existing private `grantSticker(draft)` (next-uncollected
  from the global pool → shiny duplicate when full). Do it where the level-up is committed — cleanest is a new
  helper `grantLevelUpSticker(): StickerAward` on the store (clone → `grantSticker(draft)` → commit → return),
  called by the level-up ceremony path (§5) so the sticker reveals inside the ceremony.
- Album (`/album`), `StickerReveal`, and `stickers.ts` are unchanged in shape — only the earning *trigger* moves.
  The album naturally becomes a "timeline of levels."
- Optional tunable (default OFF): also grant a sticker on a new personal best.

### 3. Earning wiring (the few choke points)

- **`useRound`** gains an optional `gameId` in `RoundConfig`, and `completeQuestion(firstTry)` calls
  `progressStore.grantTaskXp(gameId, { firstTry })` when set, storing the returned `XpGrantResult` on a ref and
  invoking an optional `onTaskXp?(result)` callback so the game can fire the "+X" flyer + mid-game flourish (§4,
  §5). This single edit covers all **9** `useRound` games. (Farver "questions" are boards/targets — grant fires
  once per board, which matches the `colors.*` per-task weights.)
- **`UnifiedMemoryGame`** match branch (`:375`) calls `grantTaskXp('memory', { firstTry: false })` per matched
  pair and spawns the flyer from the matched card.
- **Browse screens** (`AlphabetLearning:124`, `NumberLearning:150`, `FarverLearning:86`, `EnglishLearning:69`):
  in `maybeAwardExploration`, replace `grantXp(section, 6, 'browse-milestone')` with
  `grantTaskXp('browse', { firstTry: false, section })` on **each distinct new item** (not every Nth), and
  **drop the milestone sticker grant** (`awardSticker`). Consolidate the 4 identical handlers into one shared
  helper (e.g. `useBrowseXp(section)` in `src/hooks/`). A browse level-up still reveals its trophy via the
  ceremony.

### 4. In-game live indicator (`LevelRingMini`)

New `src/components/common/LevelRingMini.tsx`: a compact XP ring + level number (borrow the ring geometry from
`ProgressionCompanion.tsx:62-121`; reads `useProgress()` → `xpProgress()`/`globalLevel()`). Mount in `GameShell`
header **beside** the existing `score` slot — add a sibling `levelIndicator` render (default: `<LevelRingMini/>`
unless a game opts out) in the Toolbar at `GameShell.tsx:131`, with a phone-landscape compact variant (shrink or
hide the number) so it doesn't fight the title/score in the `:110-129` branch.

- **Ring ticks:** on any `progression.globalXp` change the ring animates to the new `fill` (framer, spring).
- **"+X" flyer:** a small floating "+N" that animates from the tapped answer toward the ring. Spawn it at the
  shared choke points only (UnifiedQuizGame correct branch `:413`; UnifiedMemoryGame match `:375`; Farver via
  `useRound.onTaskXp`) — ~3-4 insertion points, not per-game. Use the granted amount for N.
- **Reduced-motion:** ring updates statically (no spring, no flyer).

### 5. Mid-game level-up = flourish now, big ceremony deferred

- When a `grantTaskXp`/round grant returns `leveledUp` **while on a game route** (`routeKind(pathname) === 'game'`):
  fire a **non-interrupting** in-game burst — `celebrateTier('streak')` (or add a dedicated `'levelup-mini'` tier
  to `CelebrationEffect.tsx` `TIER_MAP`) + a ring "pop" on `LevelRingMini` + a short SFX. **Do NOT** emit
  `levelUpBus` and **do NOT** advance `lastCelebratedLevel`. Play continues.
- **Gate `LevelUpWatcher`** (`src/components/common/LevelUpWatcher.tsx`) so the full-screen `LevelUpOverlay` only
  fires on a **safe surface**: add `useLocation()` + `routeKind(pathname)` and skip scheduling while on a `game`
  route (unless the round-result screen is showing — see below). Thus a level crossed mid-game is celebrated big
  the moment he lands on a menu/home, or at the round-result screen.
- **`RoundResultScreen`**: trigger the deferred ceremony based on `progressStore.globalLevel() >
  state.progression.lastCelebratedLevel` (the crossing may have happened mid-round, so don't rely solely on
  `outcome.xp.global.leveledUp`). When it fires, grant the trophy sticker (§2b) and reveal it inside the ceremony,
  then `markLevelCelebrated`. Keep the existing XP-meter beat for the round's non-level XP.

### 6. Curve — steady climb, climb forever

Replace `xpToNext` in `src/config/progression.ts`:
```ts
// Steady climb: ~consistent effort per level, mild growth, bounded so late levels stay reachable.
// Climbs forever (no level cap); the companion reaches its final visual form via companionStageForLevel.
export const xpToNext = (level: number): number =>
  Math.min(160, 50 + 10 * Math.max(0, level - 1))   // L1→2=50, L2→3=60 … 160/level by ~L12
```
With a round now yielding ≈ per-task (8×~4 ≈ 24–32) + occasional bonuses, that's ~1.5–2 rounds/level early
(first level-up within a session or two) settling to ~4 rounds/level. Update `src/config/progression.test.ts`.
Companion final form via existing `companionStageForLevel` (`ProgressionCompanion.tsx:20`, final ≈ L13); the
number keeps rising.

### 7. Level is primary (menu re-rank)

- Add a level indicator to the **5 section menus**: render `<LevelRingMini/>` (or a small `ProgressionCompanion`)
  in `GameSelectionLayout` header near the mascot/title.
- Keep the home `ProgressionCompanion` as the headline; **shrink/relocate the home "Min Bog" shelf**
  (`HomePage.tsx`, the reward-shelf block ~`:350-436` in the original inline HomePage, now in
  `src/components/home/HomePage.tsx`) so the level leads. Album + earning stay fully intact.

### 8. Bloom & persistence (unchanged)

Bloom auto-feeds from every `applyXp` (so per-task XP grows it); it stays secondary to the level. Persistence is
localStorage + `flush()` on pagehide as today; iOS long-gap eviction is accepted (no IndexedDB mirror).

---

## Danish copy

No new closed-set narration required beyond PRD-01's `speakLevelUp` (already prebaked). The "+X" flyer is
non-verbal. Level badge/ring stay number-only. (If a dedicated `'levelup-mini'` SFX cue is added, it's SFX, not
TTS.)

---

## Files to touch

**Create**
- `src/components/common/LevelRingMini.tsx` — compact in-game/menu ring + number (+ "+X" flyer helper).
- `src/hooks/useBrowseXp.ts` (optional) — shared per-new-item browse XP helper.

**Edit**
- `src/config/progression.ts` (+ `progression.test.ts`) — `TASK_XP`/`taskXp`, new `xpToNext`, `roundXp` → bonuses-only.
- `src/services/progressStore.ts` — `grantTaskXp`, `grantLevelUpSticker`, `recordRoundResult` (drop per-round
  sticker grants; bonuses-only XP), keep `applyXp`/selectors.
- `src/hooks/useRound.ts` — optional `gameId` + grant in `completeQuestion` + `onTaskXp` surfacing.
- `src/components/common/UnifiedQuizGame.tsx` — flyer origin at correct branch (`:413`); pass `gameId` to `useRound`.
- `src/components/common/UnifiedMemoryGame.tsx` — per-pair `grantTaskXp('memory')` + flyer at `:375`.
- Browse screens (`AlphabetLearning`, `NumberLearning`, `FarverLearning`, `EnglishLearning`) — per-new-item XP,
  drop milestone sticker.
- `src/components/common/GameShell.tsx` — mount `LevelRingMini` in the header (+ phone-landscape variant).
- `src/components/common/GameSelectionLayout.tsx` — add level indicator.
- `src/components/home/HomePage.tsx` — shrink/relocate the "Min Bog" shelf.
- `src/components/common/LevelUpWatcher.tsx` — gate to safe surfaces via `useLocation` + `routeKind`.
- `src/components/common/RoundResultScreen.tsx` — trigger deferred ceremony on `globalLevel() > lastCelebratedLevel`;
  grant + reveal the trophy sticker there.
- `src/components/common/CelebrationEffect.tsx` — (optional) `'levelup-mini'` tier for the in-game flourish.
- `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md` — note this PRD supersedes -01 earning/visibility.

The 4 hand-rolled Farver games and both math hand-rolls need **no per-game edit** for earning — they already call
`useRound.completeQuestion`, so the `useRound` change covers them (only flyer origin is optional there).

---

## Verification

- `npm test`: update curve tests — `xpToNext(1)===50`, `xpToNext(2)===60`, cap `xpToNext(20)===160`;
  `taskXp('memory',false)===2`, `taskXp('colors.farvejagt',true)===8`, `taskXp('math.counting',true)===4`;
  `roundXp` excludes base/per-correct/per-sticker (e.g. a perfect no-best no-page round === 6).
- `npm run build` + `npm run lint` clean.
- `ui-screenshot` on an iPad viewport (Windows PowerShell: `npm run dev` + `npm run dev:api`):
  - Play a quiz → the header ring ticks + a "+X" flies on each correct task; switch to a different section's game
    → the SAME ring continues climbing (cross-game continuity).
  - Memory board → ring ticks per matched pair; Farver board → ring ticks per completed board.
  - Cross a level mid-game → non-interrupting burst + ring pop, play continues; finish the round → the full
    ceremony fires on the result screen and reveals exactly ONE trophy sticker. A round with NO level-up reveals
    NO sticker.
  - Section menus + home show the level; the "Min Bog" shelf is de-emphasized; `/album` still works.
  - Browse a "Lær …" screen → ring ticks per NEW item (re-tapping earns nothing).
  - `prefers-reduced-motion` → static ring updates, no flyer, ceremony still speaks; no console errors.
  - Force levels via `window.__progress.grantTaskXp('math.counting',{firstTry:true})` repeatedly in dev console.

---

## Embedded implementation reference (Appendix A) — verbatim current signatures

`src/config/progression.ts` (current): `xpToNext(level)`, `levelFromXp(totalXp): LevelInfo`, `bloomStage`,
`bloomFill`, `RoundXpInput { correct, total, mistakes, anyNewBest, stickerCount, pageCompleted }`, `roundXp(i)`.

`src/hooks/useRound.ts`: `RoundConfig { length; starThresholds?; stickerSetId? }` (add `gameId?`),
`completeQuestion(firstTry: boolean): RoundState` (`:52`), `RoundState { index, firstTryCorrect, streak,
longestStreak, done }`.

`src/services/progressStore.ts`: `applyXp(draft, section, amount): XpGrantResult` (`:537`, private — reuse),
`grantXp(section, amount, reason): XpGrantResult` (`:579`), `globalLevel()` (`:586`),
`xpProgressToNextLevel()` (`:590`), `bloomFor(section)` (`:607`), `markLevelCelebrated(level)` (`:615`),
private `grantSticker(draft, setId?)` (returns `{ award, completedSetId }`, `:307`), `recordRoundResult`
(`:451`), `sectionForGameId(gameId)` (`:684`). `XpGrantResult.global.leveledUp` is the signal.

`src/components/common/ProgressionCompanion.tsx`: ring geometry `:62-121`; `companionStageForLevel(level,
stageCount)` `:20`; props `{ size, level?, fill?, stage?, showBadge?, interactive?, celebrating?, sx? }`.

`src/components/common/GameShell.tsx`: `score?: React.ReactNode` (`:29`), Toolbar render (`:131`),
phone-landscape branch (`:110-129`).

`src/components/common/LevelUpWatcher.tsx`: fires on `globalLevel() > lastCelebratedLevel` after a `GRACE_MS`
(2500) defer — add route gating. `levelUpBus.emit({ level, section })`.

`src/components/common/CelebrationEffect.tsx`: `TIER_MAP` keys `micro|streak|round|best|sticker|page|levelup`;
`useCelebration().celebrateTier(tier)`.

`routeKind(pathname)` + `SECTION_MENU_PATHS` in `src/utils/menuPaths.ts` / `src/components/common/scene/routeKind.ts`.
