# PRD-01 — Drag-and-drop correctness (Farver section)

**Priority:** P0 (actively mis-scores gameplay on every session)
**Scope:** Small–Medium
**Depends on:** none

---

## Context

Børnelæring is a Danish preschool learning web app (React 19 + TypeScript + Vite 8 + MUI v9,
`@dnd-kit/core` for drag, framer-motion) for children aged 5–7, iPad-first (touch), deployed on
Vercel. The **Farver** (colors) section has four drag-based games plus one tap-only browse:

- `src/components/farver/FarvejagtGame.tsx` — drag objects into a color circle (round = 5 boards).
- `src/components/farver/RamFarvenGame.tsx` — drag 2 droplets into a pot to mix a target color (round = 8).
- `src/components/farver/FarveQuizGame.tsx` — drag one object onto 1 of N color swatches (round = 8).
- `src/components/farver/NuancerGame.tsx` — drag 3 shades into slots, light→dark (round = 8).
- `src/components/farver/FarverLearning.tsx` — tap-to-hear browse (no drag; not in scope).

Shared drag infra lives in `src/components/common/dnd/`:
`useDragOnlySensors.ts`, `DraggableItem.tsx`, `DroppableZone.tsx`.
All four games use `collisionDetection={closestCenter}` and a single `PointerSensor` with an 8px
distance activation constraint.

Educational color content is data in `src/config/colorContent.ts` (spelling/grammar issues there are
handled in PRD-04, **not here**).

## Problems (with evidence)

### P1 — `closestCenter` judges every abortive drag as a real drop *(the big one)*

`closestCenter` returns the nearest droppable by center distance and never tests whether the pointer
is actually over a zone, so `over` is **never null**. **Confirmed live:** in all four games, a drag of
~28px released in empty space still registered a drop — Farvejagt "was dropped over droppable area
`target-zone`", Ram Farven `mixing-zone`, Hvilken Farve `color-blå`, Nuancer `slot-2`.

For 5–7-year-old motor control (pick a tile up, change your mind, put it back), essentially every
imperfect drag becomes a judged answer: a wrong drop, a broken first-try flag, an incremented hint
counter. In Farvejagt this makes a distant target "teleport-collect" and makes the well's hover
glow (`isOverWell`) true for the entire duration of *every* drag, so that cue is meaningless.
3★ = zero wrong drops across a whole 5-board round becomes luck, not skill.

`src/components/common/dnd/useDragOnlySensors.ts` shows the team already half-diagnosed this — the
8px constraint was added so a plain *tap* no longer snaps a tile into place — but the short-drag case
remains.

### P2 — Ram Farven's mixing pot renders at ~0px; the game's whole feedback loop is invisible

`RamFarvenGame.tsx` (~line 632) spreads a **MUI responsive `sx` object**
(`{ width: { xs: 144, sm: 168, … }, '@media …': {…} }`) into a raw framer-motion inline `style`,
cast with `as any`:
```tsx
style={{ ...circleSizeSx, position: 'relative' } as any}
```
React drops the object-valued properties → the motion.div auto-sizes to its border, and the
`DroppableZone` inside it (`width/height: '100%'`) collapses with it (~8px). **Confirmed live:** the
rendered game shows only the "Din blanding" label and a small ⬇ arrow — no pot, no fill, no
swirl-blend, no wrong-color fizz; `Tøm` floats under nothing. The game only "works" because P1 counts
the drop on the invisible zone anyway. (The goal swatch nearby uses `sx` correctly and renders fine —
compare the two.)

### P3 — Farvejagt: no advance-guard during the board-complete flourish

`handleBoardComplete` runs a ~700ms ring-spin flourish before advancing, but tiles stay draggable
(`disabled={!gameReady || item.returning}` never locks during the flourish). A wrong drop in that
window sets `firstAttemptRef.current = false` *before* the advance timer reads it → a perfect board is
recorded as failed. FarveQuiz/Nuancer already guard with an `isAdvancing` ref; RamFarven with
`committing`; Farvejagt has nothing.

### P4 — Farvejagt mutates shared config data in place; prompt color drifts

`FarvejagtGame.tsx` (~lines 177–197) sorts the shared `DANISH_OBJECTS` arrays **in place** with a
biased `.sort(() => Math.random() - 0.5)`. `getTargetColorHex()` then reads `DANISH_OBJECTS[color][0].hex`,
so the canonical prompt/circle/pip color for "rød" wanders between shades across boards, and after
playing Farvejagt the example-object order in FarverLearning is scrambled for the rest of the session.

### P5 — Secondary correctness nits
- **RamFarven never wires difficulty**: no `useDifficulty`/`difficultyFor('colors')` in the file, so
  the adult Let/Normal/Svær setting silently does nothing there (the other three games implement it).
- **RamFarven first mix can never be lilla**: `setupTarget`'s `avoid = prevHex ?? targetColor?.hex`
  reads the initial default state (lilla) on the first call, permanently excluding lilla from the
  first mix of every session/replay.
- **Farvejagt scatter overlap**: `generateRandomPositions` enforces min-distance in raw %-space
  (anisotropic) against a fixed 180px circle, so tiles overlap and can spawn on the circle edge —
  worse on phone landscape. Hard for small fingers to grab an individual tile.

## Goals / Non-goals

**Goals:** correct drop judging for imperfect drags; a visible, working Ram Farven pot; no
false-negative scoring from advance-window taps or mutated data; difficulty wired everywhere.

**Non-goals:** Danish color text fixes (PRD-04); reward/result-screen UX (PRD-09); the larger
drag-game de-duplication refactor (PRD-10 — but leave the code in a shape that eases it).

## Implementation plan

1. **Replace the collision strategy (P1).** Create one shared helper in `src/components/common/dnd/`,
   e.g. `kidCollision.ts`, that prefers `pointerWithin`, falling back to `rectIntersection` (so a drop
   just past a zone edge still lands). Return `[]` (no collision) when the pointer is over nothing, so
   games can treat "released in empty space" as a spring-back. Use it in all four games
   (`collisionDetection={kidCollision}`). Consider padding droppable hitboxes slightly for
   fat-finger generosity. **This changes every game's "released in empty space" path from
   auto-drop → spring-back — retest each game's happy path afterward.**

2. **Fix the Ram Farven pot (P2).** Replace the `style={{…} as any}` on the pot motion.div with a
   proper MUI surface, e.g. `<Box component={motion.div} sx={{ ...circleSizeSx, position: 'relative' }}>`.
   Delete the `as any`. Confirm the pot, fill, swirl-blend, wrong-color fizz, and `Tøm` button all
   render and animate.

3. **Add an `isAdvancing` guard to Farvejagt (P3).** Match FarveQuiz/Nuancer: set a ref synchronously
   when a board completes (before the flourish timer), ignore drops while set, clear it on the next
   board. Ensure `firstAttemptRef` is read only through this guarded path.

4. **Stop mutating shared data (P4).** Use a non-mutating shuffle (introduce a shared Fisher-Yates
   `shuffle<T>(arr): T[]` util — a good candidate for `src/utils/` — and reuse it across the Farver
   games). Read canonical prompt color from the `COLOR_SWATCH` map, not `DANISH_OBJECTS[color][0].hex`.

5. **P5 cleanups:** wire `useDifficulty`/`difficultyFor('colors')` into RamFarven's target count/pool
   like the sibling games; fix the first-target `avoid` seed (initialize `prevHex` to `null` so the
   first target is unrestricted); optionally make Farvejagt scatter measure the board via a ref and
   enforce px-based min-distance against the real circle rect.

## Acceptance criteria

- [ ] In every color game, picking a tile up and releasing it **in empty space springs it back** and
      does **not** score, break first-try, or advance a board (re-run the 28px abort probe).
- [ ] Ram Farven shows a visibly sized pot; dropping two droplets fills/blends it; a correct mix shows
      the recipe reveal; a wrong mix shows the wrong color then fizzes; `Tøm` empties a half-filled pot.
- [ ] A wrong drop during Farvejagt's board-complete flourish does not fail an otherwise-perfect board.
- [ ] The Farvejagt "rød" prompt/circle color is stable across all 5 boards of a round.
- [ ] Setting Svær in the adult menu changes RamFarven (more/harder targets); lilla can appear as the
      first target.

## How to verify

Run the dev servers (PowerShell) and drive each game with the `ui-screenshot` harness:
- Screenshot each board (`--url http://127.0.0.1:5173/farver/ram-farven --wait-for '#root > *'`).
- Script an abort-drag with synthetic PointerEvents (pointerdown → a few small pointermoves → pointerup
  in open space) and assert the round chip/text did **not** change.
- Screenshot Ram Farven and confirm a real circular pot is present (measure its rect — width should be
  ~144–200px, not ~8px).
- Check the harness "console errors"/"page exceptions" lines are clean.

## Risks / notes

- Switching collision strategy can subtly change which zone wins when zones are close (Hvilken Farve's
  4 swatches, Nuancer's 3 slots). Retest that a deliberate drop onto each specific zone still lands on
  that zone, not a neighbor.
- Nuancer's slots live inside `PromptStage`, which has perpetual idle-float animation; after switching
  to `pointerWithin`, droppable rects are measured at drag start — if accuracy feels off, set dnd-kit
  `MeasuringStrategy.Always` or suspend the float during a drag.
