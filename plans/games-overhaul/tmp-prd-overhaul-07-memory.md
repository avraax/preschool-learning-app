# Overhaul PRD — Memory (`-07-`)

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Depends on:** Foundation PRD (`plans/games-overhaul/tmp-prd-overhaul-01-foundation.md`) — **already
implemented** (progress store, `useRound`, `RoundResultScreen`, `StickerReveal`, `sfxClient`,
celebration tiers, the `UnifiedQuizGame` round path). Math (`-02-`), Alphabet (`-03-`), Ordleg
(`-04-`), English (`-05-`) and Farver (`-06-`) all shipped on top of it. `SpellingGame.tsx` /
`ComparisonGame.tsx` are the proven hand-rolled round templates this PRD reuses.

> **Self-containment:** written so a fresh implement session builds it with near-zero re-exploration.
> Verbatim current signatures + exact `file:line` integration points are in **Appendix A**. Read this
> whole file plus the Foundation PRD before coding.

## Context

Memory is the **last** area in the overhaul and the only one untouched so far. It is a single
hand-rolled engine (`src/components/common/UnifiedMemoryGame.tsx`) driven by a thin per-variant
config (`src/components/learning/MemoryGame.tsx`), reached from the **Alfabetet** and **Tal**
section menus — it is **not** a front-page category.

Today every Memory board is **20 pairs / 40 cards** — far beyond a ~5yo's working memory — loops
endlessly and **auto-restarts** on completion, uses the **legacy** audio-completion handlers
(`handleCompleteGameResult` / `handleGameCompletion`) and `celebrate()` (no tiers), plays **no
SFX**, has **no rounds, no rewards, no progress memory**, and renders cards with **hardcoded colors**
(`#1976d2`, `#4caf50`, `#e8f5e8`, `#2e7d32`) that fall below the Principle-0 quality floor.

**Success looks like:** four right-sized Memory games (letters/numbers × 10-pair/20-pair) that each
finish in **one board = one round**, end on the shared `RoundResultScreen` (stars → "Ny rekord!" →
streak → sticker reveal → replay/album/back), drip stickers into the album, and use the celebration
**tiers** + **SFX** — with cards uplifted to the `AnswerTile` depth language across all 6 skins, and
identical reward language to the rest of the app.

**Static difficulty only** (standing constraint): the two board sizes are **two separate games**
(distinct routes/entries), **not** an in-game level picker. Tuning = editing named constants later.

### Scope — four games (was two)

| Game (menu title) | Route | Variant | Board | gameId |
|---|---|---|---|---|
| Hukommelse 10 | `/learning/memory/letters/10` | letters | 10 pairs | `memory.letters.10` |
| Hukommelse 20 | `/learning/memory/letters/20` | letters | 20 pairs | `memory.letters.20` |
| Hukommelse 10 | `/learning/memory/numbers/10` | numbers | 10 pairs | `memory.numbers.10` |
| Hukommelse 20 | `/learning/memory/numbers/20` | numbers | 20 pairs | `memory.numbers.20` |

One engine (`UnifiedMemoryGame.tsx`), one config factory (`MemoryGame.tsx`), parameterised by
`type` (letters/numbers) + `size` (10/20).

## Current state (with concrete weaknesses)

- **`MemoryGame.tsx`** (130 lines) — reads `:type` (`useParams`, `:49`), builds `lettersConfig`
  (`:53-92`) and `numbersConfig` (`:95-122`), picks one (`:125`), renders `<UnifiedMemoryGame
  config={…}/>` (`:127`). Letters source = 29-letter `DANISH_ALPHABET` shuffled, slice 20 (`:56-60`);
  numbers source = `NUMBERS` 1–20 (`:13`, `:98-100`). **Weaknesses:** no board-size dimension, no
  `gameId`, no round/reward config; back paths `/alphabet` (`:86`) and `/math` (`:116`).
- **`UnifiedMemoryGame.tsx`** (635 lines) — hand-rolled board engine.
  - Config interface `UnifiedMemoryConfig` (`:88-111`): `generateItems`, `getDisplayData`,
    `speakItem`, `speakMatchedItem?`, `title`, `instructions`, `backPath`, `theme`, `cardBackIcon`,
    `ScoreComponent`/`RepeatButtonComponent`/`RestartButtonComponent`. **No** `gameId`/`boardPairs`/
    `round`.
  - `initializeGame` (`:202-242`) builds pairs from `Math.min(20, sourceItems.length)` items
    (`:208`), shuffles 2× each into `cards`, `resetScore()`.
  - `handleCardClick` (`:244-396`): reveals a card, plays `speakItem`; on the 2nd card checks
    `firstCard.content === secondCard.content` (`:326`); **match** → mark matched, `incrementScore()`,
    `audio.handleCompleteGameResult({… autoAdvanceDelay:500})` (`:341-352`), and **`matchedPairs + 1
    === 20`** → `audio.handleGameCompletion({… resetAction: restartGame, autoResetDelay:3000})`
    (`:355-367`); **mismatch** → `setWrongPairIds` shake (`:371`), flip back. **Weaknesses:** the
    `=== 20` hardcode, legacy auto-advance/auto-restart handlers, **no `wrong`/`flip` SFX**, no
    mismatch/streak tracking, no round/reward.
  - Celebration via legacy `useCelebration().celebrate` (`:136`) — **no tiers**.
  - Card render (`:496-628`): `flip-container`/`flipper` rotateY CSS (`:14-68`); front uses
    `config.theme.gradient` + 4 corner ⭐ (`:527-575`); back uses **hardcoded** `#4caf50`/`#e8f5e8`/
    `#2e7d32` for matched + `config.theme.accentColor` (`:577-623`); `.memory-card-text` hardcodes
    `#1976d2` (`:60`). **Weakness:** below the `AnswerTile` depth bar; hardcoded colors break theming.
  - Grid (`:463-495`): portrait `repeat(5/8/10)`, landscape `repeat(8/10/10)`, fixed for 40 cards.

## Target experience

### A. One board = one round, ending on `RoundResultScreen`

**Before:** endless; on the 20th pair the board auto-restarts after a spoken completion line.
**After:** completing the board (all `P` pairs matched) finishes the round and shows the shared
hero result screen — exactly like the other hand-rolled games (`SpellingGame.tsx:378-384`,
`ComparisonGame.tsx:366-373`).

- Track locally (no `useRound` — see note): `matchedPairs`, `mismatches`, `matchStreak`,
  `longestMatchStreak`.
- `finishRound()` (on the final match):
  ```ts
  const outcome = progressStore.recordRoundResult(
    config.gameId,
    { correct: config.boardPairs, total: config.boardPairs + mismatches, longestStreak: longestMatchStreak },
    { starThresholds: config.starThresholds },
  )
  setRoundOutcome(outcome)
  ```
- Render: when `roundOutcome` is set, render `<RoundResultScreen outcome={roundOutcome}
  categoryId={config.theme.id} backRoute={config.backPath} onReplay={handleReplay} />` **in place of**
  the grid, inside `GameShell` (wrap the existing board JSX in `roundOutcome ? <RoundResultScreen/> :
  (…)`). RoundResultScreen plays its own round-complete / star / sticker SFX + the single spoken
  Danish summary + sticker reveal — nothing extra to fire here.
- `handleReplay()`: `stopCelebration(); setRoundOutcome(null); resetScore();` reset the four counters;
  `initializeGame()`.

> **Why not `useRound`:** `useRound` models N independent questions with a per-question `firstTry`
> flag. Memory is one board where you always eventually find every pair; the only skill signal is how
> many **mismatched turns** it took. Tracking `matchedPairs/mismatches/longestMatchStreak` locally and
> calling `recordRoundResult` once is cleaner and is the same "hand-rolled finishRound" depth the
> other games use. `useRound` stays unused here by design.

### B. Store mapping — stars from mismatches, match-streak as the record (ZERO Foundation change)

Owner decision: the explicit "beat your best" records are **stars** and **longest match-streak**;
**no** separate "fewest mistakes" line, and **no** change to `RoundResultScreen`/`progressStore`.

Feed `recordRoundResult` so its built-in maths produce exactly that (verified against
`progressStore.ts:248-312`):

| Input | Value | Effect |
|---|---|---|
| `correct` | `P` (board pairs; the board always completes) | `bestCount = max(_, P) = P` → constant; count-best fires **once ever** on first completion (a one-time positive "Rigtige: 0 → P" = "found all P pairs"), then **never a stray record line again** |
| `total` | `P + mismatches` | `mistakes = max(0, total − correct) = mismatches` → **stars scale with mismatches** |
| `longestStreak` | longest consecutive-match run | `bestStreak` → **"Længste stime"** record + spoken "X i træk" |
| `starThresholds` | per board size (below) | maps mismatch count → 1–3★ |

So the displayed records are **Stjerner** (fewer mismatches → more stars → "Stjerner: 1 → 2") and
**Længste stime** — matching the owner's choice with no shared-code edit.

**Star thresholds (in MISTAKES = mismatches; tunable constants, static difficulty):**
- 10 pairs: `{ three: 6, two: 14 }`  → ≤6 mismatches = 3★, ≤14 = 2★, else 1★
- 20 pairs: `{ three: 14, two: 30 }`

Stars are always ≥1 (no failure state — `recordRoundResult` guarantees it).

### C. Gameplay juice (per board)

- **Flip a face-down card:** `sfx.play('flip')` in `handleCardClick`, before/with `speakItem`
  (keep `speakItem` exactly as is — one card name spoken per reveal).
- **Match** (2nd card matches): `incrementScore()` (kept), **`celebrateTier('micro')`** (replaces the
  legacy `handleCompleteGameResult`; micro fires the `correct` SFX), a match **pop** (scale
  `[1, 1.08, 1]`) on the two matched cards, which stay revealed in green success styling.
  `matchStreak++`; `longestMatchStreak = Math.max(longestMatchStreak, matchStreak)`; if
  `matchStreak % 3 === 0` **and** it is **not** the final pair → `celebrateTier('streak')`.
- **Mismatch** (2nd card differs): **`sfx.play('wrong')`** (gentle), keep the existing
  `setWrongPairIds` shake + flip-back timing; `mismatches++`; `matchStreak = 0`.
- **Final match** → `finishRound()` (§A). **Remove** `handleCompleteGameResult` (`:341-352`) and
  `handleGameCompletion`/`restartGame` auto-restart (`:355-367`, `:398-401`) and the `=== 20`
  hardcode (`:355`) → use `config.boardPairs`.
- **Matched-card re-tap:** keep the existing `speakMatchedItem` branch (`:254-269`) for letters
  ("A som Ananas").

### D. Pairs-remaining indicator

The `ScoreComponent` already sits in the `GameShell` `score` slot. Show progress instead of a bare
count via `customLabel`: `customLabel={`Par: ${matchedPairs}/${config.boardPairs}`}`
(`ScoreChip.customLabel` overrides the format — see Appendix A). `incrementScore()` still drives
`matchedPairs` so the chip counts up as pairs are found.

### E. Card visual uplift (Principle 0 — `AnswerTile` depth language)

Keep the rotateY flip CSS (`:14-68`) but restyle the faces token-driven (no hardcoded colors), using
`darken()` / `hexToRgba()` from `theme/tokens/helpers` + `useTheme()` (read `theme.scene.dark`,
`theme.palette.success.main`), mirroring `AnswerTile.tsx`:

- **Face-down (front):** themed `config.theme.gradient`; 3px border in
  `hexToRgba(accent, dark?0.55:0.34)`; a coloured 3D **lip** `0 7px 0 ${darken(accent,0.3)}` plus a
  layered ambient shadow (`dark ? '0 12px 28px rgba(0,0,0,0.5)' : '0 10px 22px rgba(0,0,0,0.15)'`);
  keep a subtle motif (the `cardBackIcon` and/or corner ⭐) but make it read against the depth.
- **Face-up (content):** white top-light surface `linear-gradient(180deg,#FFFFFF 0%,#ECF1F8 100%)`;
  same accent border + lip; primary glyph (letter/number) + optional icon + secondary word in
  `theme.accentColor`.
- **Matched:** the `AnswerTile` "correct" treatment — border `success.main`, edge
  `darken(success,0.28)`, glow shadow `0 0 0 4px ${hexToRgba(success,0.45)}, 0 7px 0 …, 0 14px 30px
  ${hexToRgba(success,0.4)}`; surface `linear-gradient(180deg,#FFFFFF 0%,${hexToRgba(success,0.16)}
  100%)`; one-shot match pop.
- **Reduced motion** (`useReducedMotion()`): keep flips functional; skip the match pop + any sparkle
  (colour/glow still communicates the match), matching `AnswerTile`'s reduced-motion behaviour.
- **Delete** the hardcoded colors (`.memory-card-text` `#1976d2` at `:60`; `#4caf50`/`#e8f5e8`/
  `#2e7d32` at `:581-590`).

### F. Responsive board sizing (no-scroll, portrait + landscape)

`initializeGame` selects `config.boardPairs` items (replace `Math.min(20, …)` at `:208` with
`Math.min(config.boardPairs, sourceItems.length)`). Grid columns derive from board size:

- **10 pairs / 20 cards:** portrait `repeat(4/5/5)`; landscape `repeat(5/7/7)`.
- **20 pairs / 40 cards:** keep current portrait `repeat(5/8/10)`; landscape `repeat(8/10/10)`.

Keep `gridAutoRows:'auto'` + `aspectRatio:'3/4'` cards, `minHeight`/`maxHeight` clamps, ≥44px targets
(`.claude/rules/responsive-design.md`). Both sizes must fill the viewport without scrolling in both
orientations and in all 6 skins.

## Foundation hooks (how each game plugs in)

| Game | gameId | board | star thresholds (mismatches) | sticker pool | tiers fired | SFX |
|---|---|---|---|---|---|---|
| Hukommelse 10 (Bogstaver) | `memory.letters.10` | 10 | 3★≤6 / 2★≤14 | global | micro (match), streak (3-in-a-row), + round/best/sticker/page in result | **flip + wrong (added)** + result cues |
| Hukommelse 20 (Bogstaver) | `memory.letters.20` | 20 | 3★≤14 / 2★≤30 | global | same | flip + wrong + result cues |
| Hukommelse 10 (Tal) | `memory.numbers.10` | 10 | 3★≤6 / 2★≤14 | global | same | flip + wrong + result cues |
| Hukommelse 20 (Tal) | `memory.numbers.20` | 20 | 3★≤14 / 2★≤30 | global | same | flip + wrong + result cues |

- **Sticker pool = global** (no `stickerSetId`). `recordRoundResult` already awards **1 round sticker
  + a best-bonus** and detects **page-complete** — nothing extra per game.
- `celebrateTier` **already fires the tier's SFX** (`micro→correct`, `streak→streak-up`) — do **not**
  also `sfx.play` those. The **only** manual cues added are `sfx.play('flip')` (on reveal) and
  `sfx.play('wrong')` (on mismatch). All cue files already exist in `sfxClient`.

## Learning design

- **What it teaches:** visual working memory + symbol recognition (letters / numerals) + spoken
  reinforcement on every reveal and match. Picking pairs is pure recall, not reading — fits a
  pre-literate 5yo.
- **Right-sizing:** 20-pair was unwinnable as a memory exercise for a 5yo. **10 pairs** is the
  achievable everyday game (fast, completable, strong sense of finishing); **20 pairs** is the stretch
  game for a good day. Two separate games (not a picker) keeps difficulty static and parent-chosen.
- **Gentle, never-fail:** a mismatch only flips the cards back + plays a soft `wrong` SFX; it never
  ends the board or blocks progress. Stars are always ≥1. The match-streak record gives a
  "beat-your-best" goal without a timer.
- Honors the static-difficulty constraint (no adaptive logic, no in-game level select).

## Visual/asset spec

- **No new raster art, no new SFX files, no new audio/welcome strings.** The `memory` welcome string
  (`'Hukommelsesspil'`) already exists (`SimplifiedAudioController.ts:353`) and is reused by all four
  games. All SFX cues (`flip`, `wrong`, `correct`, `streak-up`, `star`, `sticker-reveal`,
  `round-complete`, `page-complete`) already exist in `sfxClient`.
- **Principle 0 (quality floor):** all card styling via theme tokens (`config.theme.*` /
  `useTheme()` / `darken`/`hexToRgba`); correct in **all 6 skins** incl. dark immersive scenes;
  `clamp()` sizing; **no-scroll** full-viewport in portrait + landscape; **reduced-motion** aware
  (flips kept, pop/sparkle skipped). `RoundResultScreen` is themed via `categoryId={config.theme.id}`
  and already meets the bar (shared with Math/Alphabet/Ordleg/English/Farver).
- Reuse `AnswerTile.tsx` as the literal depth reference (top-light surface, coloured lip, layered
  shadow, correct-state glow).

## Data & content (concrete, complete)

- **Letters:** keep `DANISH_ALPHABET` (29 letters) + `LETTER_ICONS` map (`MemoryGame.tsx:10`,
  `:16-46`) verbatim; `generateItems` shuffles and the engine slices `config.boardPairs` (10 or 20).
- **Numbers:** keep `NUMBERS` = 1–20 (`MemoryGame.tsx:13`); engine slices `config.boardPairs`
  (random 10 for the 10-pair game; all 20 for the 20-pair game).
- **Board sizes:** 10 and 20 pairs. **Star thresholds:** 10 → `{three:6,two:14}`, 20 →
  `{three:14,two:30}` (tunable constants). No word/number-list changes.

## Files to touch

**Modified**
- `src/components/common/UnifiedMemoryGame.tsx` — add `gameId`, `boardPairs`, `starThresholds` to
  `UnifiedMemoryConfig`; local round state (`matchedPairs`/`mismatches`/`matchStreak`/
  `longestMatchStreak`/`roundOutcome`); `finishRound` + `recordRoundResult` + `RoundResultScreen`
  branch; `handleReplay`; swap legacy `celebrate`/completion handlers for `celebrateTier('micro'/
  'streak')`; add `sfx.play('flip')` + `sfx.play('wrong')`; replace the `=== 20` hardcodes with
  `boardPairs` and the `Math.min(20,…)` slice; card visual uplift (depth tokens, remove hardcoded
  colors); board-size-aware grid columns; pairs-remaining `customLabel`.
- `src/components/learning/MemoryGame.tsx` — read `:size`; set `boardPairs`, `gameId =
  `memory.${type}.${size}``, per-size `starThresholds`; back paths unchanged (`/alphabet`, `/math`).
- `src/config/categoryThemes.ts` — replace the single `memory` entry in **alphabet** (`:62-68`) and
  **math** (`:117-123`) with **two** entries each: `memory10` → `…/letters|numbers/10` ("Hukommelse
  10") and `memory20` → `…/20` ("Hukommelse 20"), 🧠 emoji, keep the existing per-button gradient.
- `src/App.tsx` — change the route to `/learning/memory/:type/:size` (`:793`); default to size 20
  when the param is missing/invalid (old bookmarks). `MemoryGame` lazy import (`:48`) unchanged.
- `CLAUDE.md` — document the **four** Memory games (route `/learning/memory/:type/:size`, sizes
  10/20), the gameIds, one-board-per-round, and the mismatch→stars + match-streak scoring mapping.

**No new files. No new SFX/audio assets. No new welcome strings.**

**Reuse (do not reinvent)** — `RoundResultScreen` (`src/components/common/RoundResultScreen.tsx`),
`progressStore.recordRoundResult`/`RoundOutcome` (`src/services/progressStore.ts`),
`useCelebration().celebrateTier`/`celebrationDuration` (`src/components/common/CelebrationEffect.tsx`),
`sfx` (`src/services/sfxClient.ts`), `GameShell`, `AnswerTile` (depth reference),
`darken`/`hexToRgba` (`src/theme/tokens/helpers.ts`), `useReducedMotion`
(`src/hooks/useReducedMotion.ts`), `getCategoryTheme`/`categoryThemes`, `useGameState`, the
per-category `ScoreChip`/`RepeatButton`/`RestartButton` variants.
**`SpellingGame.tsx` is the literal template** for the hand-rolled round wiring (state, `finishRound`,
`handleReplay`, the `roundOutcome ? <RoundResultScreen/> : (…)` render branch).

## Verification (end-to-end, iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL; see
project memory). Then:

1. **Four games reachable:** Alfabetet + Tal section menus each show **Hukommelse 10** and
   **Hukommelse 20**; routes `/learning/memory/{letters,numbers}/{10,20}` load the right board size.
2. **Round + reward:** clearing a board shows `RoundResultScreen` (stars → "Ny rekord!" on a new best
   → streak readout → sticker reveal → "Spil igen" / "Se bog" / "Tilbage"); replay resets to a fresh
   board cleanly.
3. **Stars track mismatches:** few/no mismatches → 3★ (≤6 on a 10-pair board); a sloppy board → 1–2★
   per the thresholds. Stars never drop below 1.
4. **Match-streak record:** a longer run of consecutive matches → "Længste stime" record + spoken
   "X i træk"; a mismatch resets the running streak; every 3rd consecutive match fires a `streak`
   burst (not on the final pair).
5. **SFX:** `flip` on each reveal, gentle `wrong` on a mismatch; mute
   (`progressStore.settings.sfxEnabled`) silences SFX but **not** TTS; a missing file = silent, no
   error.
6. **Pairs indicator:** the score chip reads `Par: X/P` and counts up as pairs are found.
7. **Persistence:** stickers / stars / bests survive reload and are **separate per gameId** (a
   10-pair best doesn't overwrite the 20-pair best); private window → in-memory, no crash.
8. **Quality floor:** cards + result screen render at-or-above current polish in **all 6 themes**,
   portrait + landscape, **no scroll**, both board sizes; reduced-motion keeps flips but drops
   pop/sparkle; no hardcoded colors remain.
9. `npm run build` and `npm run lint` clean. Use the `ui-screenshot` skill to confirm layouts + zero
   console errors.

## Open questions resolved this session

- **Four games, not two:** each variant gets a **10-pair** and a **20-pair** game as **separate
  routes/entries** (not an in-game picker → static-difficulty rule preserved). Menu titles
  **"Hukommelse 10" / "Hukommelse 20"** in both sections.
- **Keep letters + numbers** variants; content auto-trimmed to board size.
- **Scoring = stars (from mismatches) + longest match-streak**, with **zero Foundation change** (the
  `correct=P` / `total=P+mismatches` mapping). **No** explicit "fewest mistakes" line.
- **Cards uplifted** to the `AnswerTile` depth language (token-driven, all 6 skins).
- **Sticker pool = global**; **board = one round**; **no `useRound`** (per-board model).

## Deferred / not in this PRD

A picture/emoji Memory variant; a third "hard" size; per-section sticker-set bias; persisting a
session-local "fewest mistakes" stat with its own ribbon line (would need the small RoundResultScreen
`countLabel`/`count-is-mistakes` tweak the owner declined); animated card dissolve on match; a Farver
Memory variant; any change to the letter/number content lists or `LETTER_ICONS`.

---

## Appendix A — Embedded implementation reference

Verbatim contracts of the code this PRD extends, cited from the repo at write time (2026-06-15).

### `UnifiedMemoryGame` config + loop — `src/components/common/UnifiedMemoryGame.tsx`
```ts
// config interface (:88-111) — ADD gameId/boardPairs/starThresholds:
export interface UnifiedMemoryConfig {
  gameType: 'letters' | 'numbers' | 'colors' | 'shapes'
  generateItems: () => string[]
  getDisplayData: (item: string) => MemoryItemDisplay   // { primary; secondary?; icon?; backDisplay? }
  speakItem: (item: string, audio: any) => Promise<string>
  speakMatchedItem?: (item: string, audio: any) => Promise<string>
  title: string; instructions: string; backPath: string
  theme: CategoryTheme            // has .id (categoryId), .accentColor, .gradient, .borderColor
  cardBackIcon: string
  ScoreComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  RestartButtonComponent: React.ComponentType<any>
  // ADD:
  // gameId: string                 // e.g. 'memory.letters.10'
  // boardPairs: number             // 10 | 20
  // starThresholds: { three: number; two: number }   // in MISTAKES (= mismatches)
}
```
Key integration points (current line numbers):
- `useCelebration()` destructure (`:136`) — add `celebrateTier`, `celebrationDuration`; pass
  `duration: celebrationDuration` into the `GameShell` `celebration` prop (`:435`).
- `useGameState()` (`:125`) already gives `score, incrementScore, resetScore, …`.
- `initializeGame` (`:202-242`): replace `Math.min(20, sourceItems.length)` (`:208`) with
  `Math.min(config.boardPairs, sourceItems.length)`; reset `mismatches/matchStreak/longestMatchStreak`.
- `handleCardClick` (`:244-396`): add `sfx.play('flip')` on reveal; **match** branch (`:331-368`) →
  drop `handleCompleteGameResult`/`handleGameCompletion`, do `incrementScore(); celebrateTier('micro');
  matchStreak++; longest = max(...); if (matchStreak%3===0 && matchedPairs+1 !== boardPairs)
  celebrateTier('streak'); if (matchedPairs+1 === config.boardPairs) finishRound()`; **mismatch**
  branch (`:369-390`) → add `sfx.play('wrong'); mismatches++; matchStreak = 0` alongside the shake.
- Render (`:421-631`): inside `GameShell`, branch `roundOutcome ? <RoundResultScreen … /> : (… board …)`.
- Grid (`:463-495`): derive `gridTemplateColumns` from `config.boardPairs`.
- Card faces (`:526-623`): restyle via depth tokens; remove `#1976d2` (`:60`), `#4caf50`/`#e8f5e8`/
  `#2e7d32` (`:581-590`).

### Hand-rolled round template — `src/components/ordleg/SpellingGame.tsx` (copy this shape)
```ts
// imports: RoundResultScreen; useReducedMotion; progressStore + RoundOutcome; sfx
const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)
const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

const finishRound = (firstTryCorrect: number, longestStreak: number) => {
  const outcome = progressStore.recordRoundResult('ordleg.spelling',
    { correct: firstTryCorrect, total: round.length, longestStreak },
    { starThresholds: { three: 0, two: 2 } })
  setRoundOutcome(outcome)
}
const handleReplay = () => { stopCelebration(); setRoundOutcome(null); round.reset(); resetScore(); generateNewWord() }

// GameShell celebration prop: { show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }
// render: roundOutcome ? <RoundResultScreen outcome={roundOutcome} categoryId="ordleg" backRoute="/ordleg" onReplay={handleReplay}/> : (… board …)
```
For Memory: `correct = config.boardPairs`, `total = config.boardPairs + mismatches`,
`longestStreak = longestMatchStreak`, `starThresholds = config.starThresholds`,
`categoryId = config.theme.id`, `backRoute = config.backPath`.

### `progressStore.recordRoundResult` / `RoundOutcome` — `src/services/progressStore.ts`
```ts
recordRoundResult(gameId: string,
  input: { correct: number; total: number; longestStreak: number },
  options?: { starThresholds?: { three: number; two: number }; stickerSetId?: string }): RoundOutcome
// internally (:253-256): mistakes = max(0, total - correct); stars = mistakes<=three?3 : mistakes<=two?2 : 1
//   → Memory: mistakes = (P + M) - P = M, so stars derive from the mismatch count M.
// bestCount = max(prev.bestCount, correct) (:276) → with correct=P it's constant (one-time first-completion record only).
// bestStreak = max(prev.bestStreak, longestStreak) (:273) → the match-streak record.
// RoundOutcome { stars, anyNewBest, newBests{streak,stars,count}, previousBests, longestStreak,
//                stickers: StickerAward[], pageCompleted, totals } — fed straight to RoundResultScreen.
// Awards 1 round sticker + a best-bonus + detects page-complete automatically (:282-294).
```

### `RoundResultScreen` — `src/components/common/RoundResultScreen.tsx`
```tsx
<RoundResultScreen outcome={RoundOutcome} categoryId="alphabet" backRoute="/alphabet" onReplay={() => void} />
// Renders INSIDE GameShell's body (replace the board). Plays its own confetti + round-complete/star/
// sticker SFX + ONE spoken Danish summary. Record ribbon lines (bestLines, :49-58): "Længste stime",
// "Stjerner", "Rigtige" — sliced to 2. For Memory only Stjerner + Længste stime move after the first
// completion. "Spil igen" → onReplay; "Se bog" → /album; "Tilbage" → backRoute.
```

### `celebrateTier` tiers — `src/components/common/CelebrationEffect.tsx`
```ts
const { celebrateTier, celebrationDuration, showCelebration, celebrationIntensity, stopCelebration } = useCelebration()
celebrateTier('micro' | 'streak' | 'round' | 'best' | 'sticker' | 'page')  // sets confetti + fires the tier's SFX
// micro→'correct', streak→'streak-up', round→'round-complete', best→'star', sticker→'sticker-reveal', page→'page-complete'
// Do NOT also sfx.play() those cues. The ONLY manual cues in this PRD are sfx.play('flip') + sfx.play('wrong').
```

### `sfx` cues — `src/services/sfxClient.ts`
```ts
import { sfx } from '../../services/sfxClient'
sfx.play('flip')   // light whoosh on card reveal
sfx.play('wrong')  // gentle, non-punishing on a mismatch
// All cues already exist: tap, correct, wrong, drop-snap, flip, streak-up, star, sticker-reveal, round-complete, page-complete.
// Mute respects progressStore.settings.sfxEnabled; missing file → silent no-op. NEVER route SFX through SimplifiedAudioController.
```

### Depth language — `src/components/common/AnswerTile.tsx` (visual reference)
```ts
import { darken, hexToRgba } from '../../theme/tokens/helpers'
const dark = theme.scene.dark
const lip = darken(accent, 0.3)                                   // coloured 3D rim
const ambientShadow = dark ? '0 12px 28px rgba(0,0,0,0.5)' : '0 10px 22px rgba(0,0,0,0.15)'
// idle surface:   'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)'
// idle border:    hexToRgba(accent, dark ? 0.55 : 0.34)
// resting shadow: `0 7px 0 ${lip}, ${ambientShadow}`
// correct: border=success.main; edge=darken(success,0.28);
//   surface=`linear-gradient(180deg,#FFFFFF 0%,${hexToRgba(success,0.16)} 100%)`;
//   shadow=`0 0 0 4px ${hexToRgba(success,0.45)}, 0 7px 0 ${edge}, 0 14px 30px ${hexToRgba(success,0.4)}`
// reduced-motion: skip the pop/sparkle (useReducedMotion()); colour/glow still communicates the match.
```

### `ScoreChip` — `src/components/common/ScoreChip.tsx`
```tsx
// customLabel takes precedence over format. Pairs-remaining indicator:
<ScoreComponent score={score} disabled={isScoreNarrating} onClick={handleScoreClick}
                customLabel={`Par: ${matchedPairs}/${config.boardPairs}`} />
// AlphabetScoreChip / MathScoreChip already wrap ScoreChip with the right category; they accept customLabel.
```

### `MemoryGame` configs — `src/components/learning/MemoryGame.tsx`
```ts
const { type, size } = useParams<{ type: 'letters' | 'numbers'; size: '10' | '20' }>()
const gameType = (type as 'letters' | 'numbers') || 'letters'
const boardPairs = size === '10' ? 10 : 20                          // default 20
const starThresholds = boardPairs === 10 ? { three: 6, two: 14 } : { three: 14, two: 30 }
// add to BOTH lettersConfig and numbersConfig:
//   gameId: `memory.${gameType}.${boardPairs}`, boardPairs, starThresholds
// lettersConfig: backPath '/alphabet' (:86); numbersConfig: backPath '/math' (:116) — unchanged.
// generateItems unchanged (engine slices boardPairs); DANISH_ALPHABET (:10) + LETTER_ICONS (:16-46) + NUMBERS (:13) kept.
```

### Route + section entries — `src/App.tsx`, `src/config/categoryThemes.ts`
```tsx
// App.tsx (:48 lazy import unchanged) — route (:793):
<Route path="/learning/memory/:type/:size" element={<MemoryGame />} />
// (MemoryGame defaults size→20 when the param is absent/invalid, for old /learning/memory/:type bookmarks.)
```
```ts
// categoryThemes.ts — alphabet.games (replace the single memory entry at :62-68) with TWO:
{ id: 'memory10', title: 'Hukommelse 10', emoji: '🧠', route: '/learning/memory/letters/10',
  gradient: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)' },
{ id: 'memory20', title: 'Hukommelse 20', emoji: '🧠', route: '/learning/memory/letters/20',
  gradient: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' },
// math.games (replace the single memory entry at :117-123) with TWO:
{ id: 'memory10', title: 'Hukommelse 10', emoji: '🧠', route: '/learning/memory/numbers/10',
  gradient: 'linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%)' },
{ id: 'memory20', title: 'Hukommelse 20', emoji: '🧠', route: '/learning/memory/numbers/20',
  gradient: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)' },
```

### Welcome string + rules (no changes needed)
- `GAME_WELCOME_MESSAGES.memory = 'Hukommelsesspil'` (`SimplifiedAudioController.ts:353`) — reused by
  all four games via `audio.playGameWelcome('memory')` (engine `:196`).
- Layout: no-scroll full-viewport, `aspectRatio:'3/4'` cards, landscape column overrides, ≥44px
  targets, `clamp()` typography (`.claude/rules/responsive-design.md`). Comic Sans for child-facing
  text; Danish only. Audio rules: one TTS at a time (no queue); SFX is the separate `sfx` channel —
  never route SFX through `SimplifiedAudioController`.
