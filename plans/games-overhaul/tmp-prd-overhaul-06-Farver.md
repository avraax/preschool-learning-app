# Overhaul PRD — Farver (Colors) `-06-`

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Depends on:** Foundation (`tmp-prd-overhaul-01-foundation.md`) — **already implemented** — plus the
Math/Alphabet/Ordleg/English overhauls that proved the round → `RoundResultScreen` → sticker path
(see `SpellingGame.tsx` for the canonical **hand-rolled** integration this PRD mirrors).
**Implement in a fresh session** using only this PRD + the Foundation PRD. Near-zero re-exploration —
the verbatim signatures and `file:line` integration points are in **Appendix A**.

---

## Context

Farver is the **most bespoke** area and the **biggest juice opportunity** in the program — two
drag-and-drop games with real tactile potential that today feel flat. Both are **endless** (no finish,
no stars, no stickers), use the **legacy** `celebrate(intensity)` API (no SFX, no tiers), and hardcode
UI chrome (`#fef3c7` board, colored chips, `window.innerWidth` sizing) — violating the token-driven
theming floor and Principle 0. The colors themselves are **educational data** and must NOT become
themeable; only the chrome around them moves to tokens.

This is the 6th area, so the SFX/juice/round systems are mature and battle-tested. The job is to give
both games:
- **Bounded rounds** that finish and reward (stars + a shared-album sticker + "beating his best").
- **Real drag juice** — snap/pop on drop, scatter-in, drop SFX, animated color blending.
- **Never-fail scaffolding** so a stuck 5yo always progresses (hint costs a star, never blocks).
- **Token-driven chrome** across all 6 skins, no-scroll, portrait + landscape.

**Success looks like:** he plays a short, satisfying color round; correct drops *snap* with a pop and a
sound; in Ram Farven two droplets *swirl and merge* into the target and it tells him "rød + blå =
lilla"; the round finishes after a fixed set; he sees his stars vs his best and earns a sticker into the
shared album — all at or above the polish of the rest of the app.

---

## Current state

| Game | Route | File | Mechanic | Engine |
|---|---|---|---|---|
| Farvejagt (Color Hunt) | `/farver/jagt` | `FarvejagtGame.tsx` | Drag the target-colored emoji items from a scattered board into a central circle; ignore distractors | hand-rolled (dnd-kit) |
| Ram Farven (Color Mixing) | `/farver/ram-farven` | `RamFarvenGame.tsx` | Drag 2 of 5 source droplets into a mixing circle to make a target color | hand-rolled (dnd-kit) |

Both are listed as "learning-based" in `.claude/rules/game-development.md`, but they are really
**task-based** (there's a right answer). Shared dnd primitives: `src/components/common/dnd/DraggableItem.tsx`,
`DroppableZone.tsx`.

### Farvejagt — current loop & weaknesses (cited)
- 6 colors (`rød, blå, grøn, gul, lilla, orange`) with a Danish object database (`DANISH_OBJECTS`,
  `FarvejagtGame.tsx:32-81`). Each board = one target color: 5-6 target items + **2 per other color**
  distractors → **~16 items** (`generateGameItems`, `:210-255`; distractor `.slice(0, 2)` at `:227`).
- **Endless:** board complete → `handleGameCompletion` auto-resets to a new color after 3s
  (`:315-335`). Never finishes, never rewards, no best.
- **Legacy celebration:** `celebrate(score > 5 ? 'high' : 'medium')` (`:321`), **no SFX** on correct or
  wrong (wrong is silent — just a CSS shake, `:398-431`).
- **Hardcoded chrome:** board background `#fef3c7` (`:551`), the target-color chip & a grey "Start
  forfra" button (`:509-535`), `DroppableZone` hardcodes a red hover tint (`DroppableZone.tsx:29`).
- Correct drop snaps the item to dead-center `(50,50)` and piles them (`:373-378`) — no tidy landing,
  no pop, no progress feedback.

### Ram Farven — current loop & weaknesses (cited)
- 5 source droplets (`rød, blå, gul, hvid, sort`, `RamFarvenGame.tsx:79-85`), 6 targets (`lilla,
  orange, grøn, lyserød, grå, lyseblå`, `:98-105`), 12 mixing rules (`:108-121`).
- **Endless:** correct mix → `initializeGame()` picks a new target after 3s (`:265-296`). No finish/reward.
- **Instant, un-animated mix:** the zone background just flips to the result color (`:434-441`); the
  blend has no transition/swirl — the roadmap's headline juice gap.
- **Silent wrong-attempt:** wrong combo just resets the pot with an encouragement (`:297-331`), no SFX,
  no "what did I make?" feedback.
- **No undo:** colors auto-commit when the 2nd droplet lands (`:260-262`); a single mis-drag forces a
  wasted attempt — there's no way to empty the pot.
- **Non-responsive sizing:** `window.innerWidth` read directly for the mixing-zone size (`:430-431`) —
  breaks the responsive-design rule and doesn't react to rotation.
- **Legacy celebration**, no SFX, no rounds/stickers.

---

## Target experience

Both games keep their core mechanic (owner: **keep both, overhaul only — no merge/removal**) and gain
the foundation reward loop + real juice. Neither uses a timer. Both keep the entry **welcome** + the
`ColorRepeatButton` "🎵 Hør igen" affordance. Both keep their **spoken color reinforcement** (the
incidental learning) and migrate **all chrome to theme tokens** (educational color hexes stay as data).

### Farvejagt — target

**Round model.** A **round = 5 boards** (5 color-hunts). Each completed board = **1 question** for the
round. After the 5th board → `RoundResultScreen`. (`gameId: 'colors.farvejagt'`.)

**Board.** Slightly calmer: **5-6 target items + 1 distractor per other color ≈ 11-12 items** (change
the distractor `.slice(0, 2)` → `.slice(0, 1)` at `FarvejagtGame.tsx:227`). Target color avoids an
immediate repeat (existing `selectRandomTarget`).

**Loop (before → after):**
- *Scatter-in (NEW):* when a board loads, items animate into place with a staggered spring (Framer
  Motion `initial/animate` on each item wrapper), instead of appearing instantly.
- *Correct drop (CHANGED):* the item **snaps + pops** into a tidy **ring** inside the target circle
  (arrange collected items evenly around the circle, not piled at center) with a spring scale-pop, fires
  `sfx.play('drop-snap')`, and keeps the spoken reinforcement `"{objectNameDefinite} er {colorName}"`
  (e.g. "æblet er rød"). `celebrateTier('micro')` replaces the legacy per-item handling.
- *Progress ring (NEW):* a ring of **pips around the target circle** (one pip per target item) fills as
  each correct item lands, so board progress reads at a glance (e.g. 3 of 5 pips lit). Pips use the
  educational **target hex** when lit, a neutral token tint when unlit; animate each fill with a small
  spring (reduced-motion → instant fill). Sits on the circle's perimeter, scales with the circle.
- *Wrong drop (CHANGED):* item **bounces back** (existing shake) **+** `sfx.play('wrong')` (gentle;
  currently silent) **+** the corner guide reacts. Breaks the board's first-try flag. Item stays on the
  board.
- *Hint (NEW, never-fail):* after **2 wrong drops on the current board**, gently **pulse a correct
  (target-colored) item** (Framer pulse; reduced-motion → static glow ring via box-shadow). Using the
  hint costs a star (first-try already broken by the wrong drops). Mirrors `SpellingGame`'s slot hint.
- *Board complete (CHANGED):* when all target items are collected, the **ring of collected items does a
  short celebratory spin/pop** (board "sub-win") before the round advances. Then
  `round.completeQuestion(firstTry)`; streak milestone → `celebrateTier('streak')`; if `done` →
  `finishRound`, else **scatter-in the next board**.

**Chrome (CHANGED):** board background, the target prompt, borders, and score area all read from
`getCategoryTheme('colors')` + `useTheme()` (`theme.scene`, `theme.customShadows`) — correct in all 6
skins. Keep a **target-color prompt** ("Find alle røde ting") as a token-styled pill whose accent is the
**educational target hex** (data), so the prompt visibly carries the color a non-reader is hunting (the
dashed target-circle border already encodes it — keep that). Score chip shows **round progress** (boards
done / 5) via `ColorProgressChip`.

**REMOVED:** the endless auto-reset (`handleGameCompletion` path), the grey **"Start forfra"** button
(replay now comes from `RoundResultScreen`), the hardcoded `#fef3c7` board bg, the legacy
`celebrate(intensity)` call, and the dead-center pile. Board progress is shown **both** by the items
accumulating in the collected ring **and** the new pip ring around the target circle.

### Ram Farven — target

**Round model.** A **round = 8 mixes** (8 targets). Each correct mix = **1 question**. After the 8th →
`RoundResultScreen`. (`gameId: 'colors.ramfarven'`.)

**Loop (before → after):**
- *Droplet into pot (CHANGED):* dragging a droplet into the pot keeps the spoken color name (existing
  `audio.speak(droplet.colorName)`) and a soft `sfx.play('tap')` on landing. Pot holds up to 2.
- *Tøm-knap (NEW):* a token-styled **"Tøm"** (empty) button appears whenever the pot has ≥1 droplet and
  is not mid-commit; tapping it pours the pot out (clears `mixingZone`, restores the droplets' `isUsed`)
  so a mis-dragged droplet isn't a forced wrong attempt. Min 44px.
- *Animated blend (CHANGED, headline juice):* when 2 droplets are in the pot, they **swirl together and
  the pot fills with the blended color over ~600ms** (Framer Motion: droplets converge + rotate, the
  pot's background animates), then resolve — replacing today's instant background flip. Fire
  `sfx.play('drop-snap')` as the blend lands.
- *Correct (CHANGED):* `celebrateTier('micro')`, then a **recipe reveal (NEW)** — briefly show
  `🔴 + 🔵 = 🟣` style (the two source swatches → "=" → the target swatch) and speak **"rød og blå
  bliver lilla"**. Then `round.completeQuestion(true-or-first-try)` → next target / `finishRound`.
- *Wrong (CHANGED):* the pot still **shows the (wrong) blended result color briefly**, `sfx.play('wrong')`
  (gentle), and speaks **"Den blev {resultColorName}, prøv igen"** (if the combo has no rule, "Prøv en
  anden blanding"), then the droplets **fizz out** and the pot resets. Breaks first-try.
- *Hint (NEW, never-fail):* after **2 wrong mixes on the current target**, **pulse/highlight the 2
  correct source droplets** (the recipe for the target; reduced-motion → static glow). Costs a star.

**Chrome (CHANGED):** replace the `window.innerWidth` sizing (`:430-431`) with responsive `sx` (clamp /
breakpoint values), and route the pot border, target presentation, and Tøm button through tokens. Score
chip shows **round progress** (mixes done / 8) via `ColorProgressChip`.

**REMOVED:** endless `initializeGame()` auto-advance, instant background flip, silent wrong attempts,
`window.innerWidth` reads, legacy `celebrate(intensity)`.

---

## Foundation hooks

Both games are **hand-rolled** → they call `useRound` + `progressStore.recordRoundResult` + render
`RoundResultScreen` directly (NOT via `UnifiedQuizGame`). Copy `SpellingGame.tsx`'s wiring verbatim
(`:114-117`, `:249-264`, `:340-345`, `:378-384`).

| Hook | Farvejagt | Ram Farven |
|---|---|---|
| **Round config** | `useRound({ length: 5, starThresholds: { three: 0, two: 2 } })` | `useRound({ length: 8, starThresholds: { three: 0, two: 2 } })` |
| **gameId** | `'colors.farvejagt'` | `'colors.ramfarven'` |
| **Question = ** | one board fully collected | one correct mix |
| **first-try broken by** | any wrong drop OR hint used on that board | any wrong mix OR hint used on that target |
| **Sticker set** | **global pool** (`recordRoundResult` with no `stickerSetId`) | **global pool** |
| **Star thresholds** | 3★ = 0 mistakes, 2★ ≤ 2, else 1★ (default) | same |
| **SFX cues fired** | `drop-snap` (correct land), `wrong` (bad drop), `tap` (grab, optional), + result-screen cues | `tap` (droplet in), `drop-snap` (blend lands), `wrong` (bad mix), + result-screen cues |
| **Celebration tiers** | `micro` per correct drop; `streak` on first-try streak %3; `round`/`best`/`sticker`/`page` handled inside `RoundResultScreen` | identical mapping per correct mix |

`recordRoundResult` returns a `RoundOutcome`; store it in `roundOutcome` state and render
`<RoundResultScreen outcome={...} categoryId="colors" backRoute="/farver" onReplay={handleReplay} />` in
place of the board (see `SpellingGame.tsx:378-384`). `handleReplay` = `stopCelebration()` →
`setRoundOutcome(null)` → `round.reset()` → reset board/score → start a fresh first board/target.

The result screen already fires `round-complete` / `star` / `sticker-reveal` / `page-complete` SFX, the
"Ny rekord!" ribbon, the streak readout, the `StickerReveal`, and a single spoken Danish summary — the
games do not duplicate any of that.

---

## Learning design

- **Farvejagt teaches color discrimination + the color word** (Danish definite-article noun + color):
  hearing "æblet er rød" while dropping a red apple binds object→color→word. Calmer ~12-item boards
  reduce visual overwhelm for a 5yo without removing the discrimination challenge. The pulse-hint
  guarantees he never gets stuck on a color he can't spot.
- **Ram Farven teaches color theory** (primary mixing + tint/shade with white/black). The **recipe
  reveal** ("rød og blå bliver lilla") turns trial-and-error into an actual taught rule — the single
  biggest learning upgrade here. The droplet-pulse hint teaches the recipe when stuck; the Tøm button
  removes accidental-failure frustration.
- **Static difficulty (mandatory):** 5 boards / 8 mixes, fixed item counts, fixed mixing rules — all
  constants, tunable only by editing code. No adaptive difficulty, no level pickers.
- **Never-fail:** wrong drops/mixes never end the round or punish beyond breaking first-try (a star).
  Stars are always ≥1. Hints always resolve a stuck state.

---

## Visual / asset spec (Principle 0 — match or exceed)

- **No net-new art** — emoji items, droplet shapes, and the existing dnd primitives are reused. All
  improvements are motion + token chrome.
- **Depth & motion:** correct-drop snap-pop and the Ram Farven blend use Framer Motion springs (not
  linear). Collected-ring layout uses transform positioning around the circle. Match `AnswerTile`'s
  tactile feel; use `theme.customShadows` / `theme.scene` for surfaces so immersive skins get depth and
  flat skins stay clean.
- **Token-driven chrome only:** board background, prompt pill base, pot border, Tøm button, score area
  → `getCategoryTheme('colors')` (`accentColor` / `borderColor` / `hoverBorderColor`) + `useTheme()`
  (`theme.scene.dark` for light-on-dark text, `theme.customShadows`). **Educational color hexes stay as
  data** (the item/droplet/target colors and the dashed target-circle border, which must show the real
  hunted/target color). `DroppableZone`'s hardcoded red hover tint (`DroppableZone.tsx:29`) should be
  made neutral/overridable so it doesn't clash with non-red targets (e.g. accept an `overColor` via
  `data`/prop, or use a neutral white-alpha tint).
- **All 6 themes, portrait + landscape, no scroll.** Replace every `window.innerWidth` read with
  responsive `sx` (`{ xs, sm, md, lg }` or `clamp()`), per `.claude/rules/responsive-design.md`.
- **Reduced motion:** scatter-in, snap-pop, blend swirl, board-complete spin, and both pulse-hints all
  degrade to instant/static (use `useReducedMotion()`, as `SpellingGame.tsx:77` does). SFX + spoken
  reinforcement + reward still land.
- **Comic Sans MS** for child-facing text; **44px+** touch targets (the Tøm button included).

---

## Data & content

**Reuse all existing color data verbatim** — it is the educational content and stays hardcoded:
- Farvejagt: `DANISH_OBJECTS` + `COLOR_TARGETS` (`FarvejagtGame.tsx:32-91`). **No content change** beyond
  the distractor count (`.slice(0, 2)` → `.slice(0, 1)`, `:227`).
- Ram Farven: `primaryColors` (`:79-85`), `possibleTargets` (`:98-105`), `mixingRules` (`:108-121`).
  **No change.**

New tunable constants (top of each file, commented as tuning levers):
```ts
// Farvejagt
const ROUND_BOARDS = 5            // boards (questions) per round
const DISTRACTORS_PER_COLOR = 1   // was 2 → calmer ~12-item board
const WRONG_DROPS_BEFORE_HINT = 2 // pulse a correct item after this many wrong drops on a board

// Ram Farven
const ROUND_MIXES = 8             // correct mixes (questions) per round
const WRONG_MIXES_BEFORE_HINT = 2 // pulse the 2 correct droplets after this many wrong mixes
const BLEND_MS = 600              // swirl/merge animation duration
```

**Recipe-reveal text (Ram Farven):** derive from the two source `colorName`s + the target `name`, e.g.
`` `${a} og ${b} bliver ${target}` `` → "rød og blå bliver lilla". For tint/shade recipes this reads
naturally too ("rød og hvid bliver lyserød", "sort og hvid bliver grå").

**Wrong-mix text (Ram Farven):** if the combo has a `mixingRules` entry → `` `Den blev ${result.name}, prøv igen` ``;
otherwise `'Prøv en anden blanding'`.

Sticker awarding is entirely inside `recordRoundResult` (global pool) — no per-game sticker data.

No `gameId`s collide: `colors.farvejagt`, `colors.ramfarven` are new keys in `progressStore.perGame`.
No new `GAME_WELCOME_MESSAGES` entries needed (`farvejagt` / `ramfarven` already exist,
`SimplifiedAudioController.ts:355-356`).

---

## Files to touch

**Modified**
- `src/components/farver/FarvejagtGame.tsx` — round wiring (`useRound`, `recordRoundResult`,
  `RoundResultScreen`), scatter-in, snap-pop ring + `drop-snap`, wrong-drop `wrong` SFX, pulse-hint,
  board-complete flourish, token chrome, remove auto-reset + "Start forfra", `ColorProgressChip`, switch
  `celebrate` → `celebrateTier`.
- `src/components/farver/RamFarvenGame.tsx` — round wiring, animated blend + `drop-snap`, recipe reveal,
  wrong-mix feedback + `wrong` SFX, Tøm button, droplet pulse-hint, responsive sizing (drop
  `window.innerWidth`), token chrome, `ColorProgressChip`, `celebrate` → `celebrateTier`.
- `src/components/common/dnd/DroppableZone.tsx` — make the hardcoded red `isOver` tint
  (`:29`) neutral/overridable so it works for any target color (small, shared change — verify no other
  caller regresses; current callers are only these two games).
- `src/config/version.ts` — bump (every overhaul commit bumps it; follow the existing pattern there).
- `CLAUDE.md` — update the **Farver** bullet to describe the overhauled games (rounds, gameIds, juice),
  matching how the Math/Alphabet/Ordleg/English bullets were updated.

**Reuse (do NOT reinvent)**
- `useRound` (`src/hooks/useRound.ts`), `progressStore.recordRoundResult` + `RoundOutcome`
  (`src/services/progressStore.ts`), `RoundResultScreen` (`src/components/common/RoundResultScreen.tsx`),
  `useCelebration().celebrateTier` (`src/components/common/CelebrationEffect.tsx`), `sfx`
  (`src/services/sfxClient.ts`), `useReducedMotion` (`src/hooks/useReducedMotion.ts`),
  `useGameState` (`src/hooks/useGameState.ts`), `ColorScoreChip` / `ColorProgressChip`
  (`src/components/common/ScoreChip.tsx`), `ColorRepeatButton` (`src/components/common/RepeatButton.tsx`),
  `DraggableItem` / `DroppableZone`, `GameShell`, `getCategoryTheme('colors')`, the audio hook
  (`useSimplifiedAudioHook`) and its `speak` / `speakColorHuntInstructions` /
  `speakColorMixingInstructions` / `playGameWelcome` methods.
- Mirror `SpellingGame.tsx` end-to-end for the hand-rolled round/result/replay structure — it is the
  reference implementation.

**No new files.** No new SFX files (`drop-snap`, `wrong`, `tap` already exist in the palette).

---

## Verification (end-to-end, iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL, see
project memory). Then:

1. **Farvejagt round:** complete 5 boards → `RoundResultScreen` appears in place of the board with
   correct stars for 0 / 2 / 3 wrong-drop boards, the choreography plays, **Spil igen** restarts a fresh
   5-board round, **Tilbage** returns to `/farver`, **Se bog** opens `/album`.
2. **Farvejagt juice:** items scatter-in on each new board; a correct item snaps+pops into the ring with
   the `drop-snap` sound; a wrong item bounces back with the gentle `wrong` sound; after 2 wrong drops a
   correct item pulses (static glow under reduced-motion); board-complete plays the ring flourish.
3. **Ram Farven round:** complete 8 mixes → result screen; stars reflect wrong mixes; replay/back/album
   work.
4. **Ram Farven juice/learning:** two droplets swirl and the pot fills over ~600ms with `drop-snap`; a
   correct mix shows the recipe ("rød og blå bliver lilla", spoken); a wrong mix briefly shows the wrong
   result color, plays `wrong`, says "Den blev …, prøv igen", then fizzes out; **Tøm** empties a 1-droplet
   pot; after 2 wrong mixes the 2 correct droplets pulse.
5. **Persistence / best:** earn a sticker → reload → album + stars + per-game bests survive; beat a prior
   streak/stars/count → "Ny rekord!" shows old→new; private window → no crash (in-memory only).
6. **Quality floor:** both games render correctly and look at-or-above current polish in **all 6 themes**,
   portrait + landscape, **no scroll**; no `window.innerWidth`-driven layout glitches on rotation;
   reduced-motion degrades gracefully (SFX + reward still land). Educational colors look correct (the
   `DroppableZone` hover tint no longer forces red on non-red targets).
7. **SFX/mute:** cues fire on their triggers; the global SFX mute (home settings,
   `progressStore.settings.sfxEnabled`) silences SFX but not TTS.
8. `npm run build` and `npm run lint` clean. Use the `ui-screenshot` skill to confirm layouts + zero
   console errors on both routes in at least the default + one immersive skin.

---

## Open questions resolved this session

| Decision | Choice |
|---|---|
| Lineup | **Keep both** games, overhaul only — no merge/removal |
| Farvejagt round | **5 boards** per round (each board = 1 question) |
| Farvejagt board density | **~12 items** — 5-6 targets + **1** distractor per other color |
| Ram Farven round | **8 mixes** per round (each correct mix = 1 question) |
| Star thresholds (both) | Foundation default — 3★ = 0 mistakes, 2★ ≤ 2 |
| Scaffolding | **Never-fail hint in BOTH** — pulse correct item / correct droplets after 2 misses; costs a star |
| Sticker pool | **Global** (no per-section bias) |
| Ram Farven mix moment | **Animated blend (~600ms) + attempt feedback** ("Den blev X, prøv igen") |
| Farvejagt drag juice | **Snap+pop into ring**, **scatter-in on new board**, **wrong-drop bounce + gentle SFX**, **pip progress ring around the target circle** (added on owner follow-up) |
| Extra polish | **Ram Farven recipe reveal**, **Ram Farven "Tøm" button**, **Farvejagt board-complete flourish**, **keep spoken color reinforcement** |
| Chrome / theming | **Token-driven chrome** (board bg, chips, borders, sizing); **educational color hexes stay as data**; replace `window.innerWidth` with responsive `sx` |

---

## Appendix A — Embedded implementation reference (so a clean session needs no re-exploration)

Verbatim contracts of the code this PRD extends. Cited from the repo at write time (2026-06-15).

### Round hook — `src/hooks/useRound.ts`
```ts
export interface RoundConfig { length: number; starThresholds?: { three: number; two: number }; stickerSetId?: string }
export interface RoundState { index: number; firstTryCorrect: number; streak: number; longestStreak: number; done: boolean }
export interface UseRound {
  enabled: boolean; length: number; state: RoundState
  completeQuestion: (firstTry: boolean) => RoundState   // returns fresh state synchronously
  reset: () => void
}
export const useRound: (config?: RoundConfig) => UseRound
```
- `completeQuestion(firstTry)` increments `index`, updates `streak`/`longestStreak`, sets `done` when
  `index >= length`. Returns the new state so you can branch immediately (advance vs finish vs streak).

### Progress store — `src/services/progressStore.ts`
```ts
interface RoundResultInput { correct: number; total: number; longestStreak: number }
interface RoundResultOptions { starThresholds?: { three: number; two: number }; stickerSetId?: string }
progressStore.recordRoundResult(gameId: string, input: RoundResultInput, options?: RoundResultOptions): RoundOutcome
// RoundOutcome: { gameId, correct, total, mistakes, stars(1-3), longestStreak,
//   previousBests{streak,stars,count}, newBests{...}, anyNewBest, stickers: StickerAward[],
//   pageCompleted: {id,title,emoji}|null, totals{totalStars,totalStickers} }
```
- `correct` = first-try-correct count; `total` = round length; `mistakes = total - correct`. Omit
  `stickerSetId` for the global pool. Persists + awards inside (1 round sticker + bonus on any new best).

### Result screen — `src/components/common/RoundResultScreen.tsx`
```tsx
<RoundResultScreen outcome={RoundOutcome} categoryId="colors" backRoute="/farver" onReplay={() => void} />
```
- Renders INSIDE `GameShell`'s body (replace the board when `roundOutcome` is set). Fires all reward
  beats itself (confetti, star/sticker/round/page SFX, ribbon, streak readout, `StickerReveal`, one
  spoken Danish summary). Buttons: **Spil igen** (`onReplay`), **Se bog** (`/album`), **Tilbage**
  (`backRoute`).

### Celebration tiers — `src/components/common/CelebrationEffect.tsx`
```ts
useCelebration() => {
  showCelebration, celebrationIntensity, celebrationDuration,
  celebrate(intensity?: 'low'|'medium'|'high'),     // legacy — being replaced
  celebrateTier(tier: 'micro'|'streak'|'round'|'best'|'sticker'|'page'),  // sets confetti + fires SFX
  stopCelebration()
}
// Pass to GameShell: celebration={{ show: showCelebration, intensity: celebrationIntensity,
//                                    duration: celebrationDuration, onComplete: stopCelebration }}
```
- `micro` → low confetti + `correct` SFX (use per correct drop/mix). `streak` → `streak-up`. `round`/
  `best`/`sticker`/`page` are handled by `RoundResultScreen` — don't double-fire them in the game.

### SFX — `src/services/sfxClient.ts`
```ts
import { sfx } from '../../services/sfxClient'
sfx.play('drop-snap' | 'wrong' | 'tap' | 'correct' | ... , { rate?, volume? })
// Cues used here already exist: 'drop-snap', 'wrong', 'tap'. Missing file → silent. Mute via
// progressStore.settings.sfxEnabled (read live). Never route through SimplifiedAudioController.
```

### Score chips — `src/components/common/ScoreChip.tsx`
```tsx
<ColorScoreChip score onClick disabled />                  // stars format "{n} ⭐"
<ColorProgressChip score target onClick disabled />         // progress format "{score}/{target}"  ← use for round progress
```
Both are `category="colors"` (orange) pre-configs of `ScoreChip`.

### dnd primitives — `src/components/common/dnd/*`
```tsx
<DraggableItem id position={{x,y}} disabled data>{children}</DraggableItem>  // position is % (absolute)
<DroppableZone id style className data>{children}</DroppableZone>            // isOver tint hardcoded red at line 29 — make neutral/overridable
// In a DndContext: onDragStart(e: DragStartEvent), onDragEnd(e: DragEndEvent) with event.over?.id
```

### Audio — `src/hooks/useSimplifiedAudio.ts` / `src/utils/SimplifiedAudioController.ts`
```ts
const audio = useSimplifiedAudioHook({ componentId: 'FarvejagtGame', autoInitialize: false })
audio.isAudioReady; audio.updateUserInteraction(); audio.cancelCurrentAudio()
audio.playGameWelcome('farvejagt' | 'ramfarven')                  // welcome strings already registered
audio.speak(text: string): Promise<string>                       // generic Danish TTS (use for recipe/wrong text)
audio.speakColorHuntInstructions(phrase: string): Promise<string> // Farvejagt instruction ("Find alle røde ting")
audio.speakColorMixingInstructions(targetColor: string)           // "Lav {x} farve ved at blande farverne"
```
- Keep the existing **instant-load / welcome-then-instructions** pattern already in both files
  (`FarvejagtGame.tsx:258-312`, `RamFarvenGame.tsx:124-216`) — `revealBoard()` shows the playable board
  immediately, the welcome narrates over it, and `hasInteractedRef` suppresses a late welcome once the
  child drags. Do not disturb that gate; just hang the round logic off the existing handlers.

### Theme — `src/config/categoryThemes.ts`
```ts
import { getCategoryTheme } from '../../config/categoryThemes'
const t = getCategoryTheme('colors')   // { accentColor, borderColor, hoverBorderColor, gradient, name, games, ... }
// + useTheme() for theme.scene.dark (light text on immersive skins) and theme.customShadows.
```

### Reference implementation to mirror — `src/components/ordleg/SpellingGame.tsx`
The canonical **hand-rolled** round game. Copy its structure:
- Round + state: `const round = useRound({ length, starThresholds })`, `firstAttemptRef`,
  `const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)` (`:114-117`).
- Finish: `finishRound()` calls `progressStore.recordRoundResult(gameId, {...}, {...})` →
  `setRoundOutcome(outcome)` (`:249-256`).
- Replay: `handleReplay()` = `stopCelebration()` → `setRoundOutcome(null)` → `round.reset()` →
  `resetScore()` → start fresh (`:258-264`).
- Advance: on each completed question `const r = round.completeQuestion(firstTry); if (!r.done && r.streak>0 && r.streak%3===0) celebrateTier('streak'); if (r.done) finishRound(r.firstTryCorrect, r.longestStreak); else nextQuestion()` (`:340-345`).
- Render: `{roundOutcome ? <RoundResultScreen .../> : gameReady && current && ( ...board... )}` (`:378-385`).
- Never-fail hint precedent: `slotWrongRef` + `hintTileId`, pulse vs static glow under
  `useReducedMotion()` (`:88-89`, `:312-319`, `:476-535`).
