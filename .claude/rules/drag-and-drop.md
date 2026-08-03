---
paths:
  - "src/components/common/dnd/*.ts"
  - "src/components/common/dnd/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/config/colorContent.ts"
  - "src/utils/shuffle.ts"
---

# Drag-and-Drop Rules

## EVERY drag game also answers on a TAP, and vice versa

Owner, 2026-08-03, on the Farver games: drag worked, a plain tap did nothing. A 5-year-old taps. So
**a game must never accept only one of the two gestures**, and both must run the SAME resolve function —
never a second copy of the scoring, or the advance-lock/first-try/hint bookkeeping drifts between them.
Where the tap lives depends on which side is the child's CHOICE:

| game | drag | tap goes on |
|---|---|---|
| Farvejagt | object → circle | the **object** (`DraggableItem onActivate`) |
| Ram Farven | droplet → pot | the **droplet** |
| Nuancer | shade → slot | the **shade** → fills the leftmost EMPTY slot |
| Hvilken Farve? | object → swatch | the **swatch** (`DroppableZone onActivate`) — the single draggable is only the thing being placed, so tapping it can't name a colour |
| Stav Ordet | letter → the word ROW | the letter tile (unchanged; `TactileTile`'s own button) |
| Plus / Minus | answer tile → the `?` | the tile (unchanged; `AnswerTile`'s own button) |
| Hvad Mangler | answer tile → the `?` | the tile (unchanged) — engine opt-in `dragToPromptSlot` |

**Nuancer is the one game a tap can't fully express** (shade × slot is 2-D). It commits to the leftmost
empty slot rather than asking for a select-then-place first tap — that is the shape
`previewBeforeCommit` was removed for (an unscored first tap read as a broken game). Don't "fix" it into
two taps.

**A drag target must already exist in the prompt.** Sammenlign Tal, Tal Quiz, Bogstav Quiz, Læs Ordet
and the English quizzes stay tap-only: they ask a question rather than show a gap, so a drop zone there
would be invented furniture. `UnifiedQuizGame` therefore mounts **no DndContext at all** unless a config
sets `dragToPromptSlot` (guarded — see `dragActivation.test.ts`).

## One threshold, or one gesture answers twice

`DRAG_ACTIVATION_DISTANCE` (`dnd/dragActivation.ts`) is the single source: the PointerSensor's
activation constraint and `useTapActivate`'s "was this a tap?" test are complements of that one number.
Two independent values leave a band where a gesture is BOTH — a drag past dnd-kit's threshold that ends
back over its own tile fires `onDragEnd` **and** the browser's trailing click.
- `useTapActivate` returns `onClickCapture` too, which swallows that trailing click before a child
  `<button>` (AnswerTile / TactileTile) can see it. On desktop Chrome dnd-kit already suppresses it
  (measured); the guard is for **touch**, where the click is synthesized after teardown — the same
  late-click that made the audio modal press the board behind it (`audio-system.md`).
- **Compose dnd-kit's `onPointerDown`, never replace it.** `{...listeners}` already contains one;
  overwriting it kills dragging while the tap keeps working, and nothing fails.

The Farver games plus Stav Ordet, Plus/Minus and Hvad Mangler use **`@dnd-kit/core`** through shared
primitives in `src/components/common/dnd/` — **reuse those, don't re-implement**: `kidCollision`,
`useDragOnlySensors`, `DroppableZone`, `DraggableItem` (`inline` for tray layouts, `fill` when a sized
grid cell must pass its box through), and `useDragActive` (the shared
`activeId`/`overId` lift-and-breathe state + `onDragOver`/`clearActive` — wire it into the DndContext;
only `onDragStart` stays per-game). `DraggableItem` defaults to absolute `left/top%` placement (scatter
boards); pass **`inline`** for in-flow tray layouts (Hvilken Farve?, Nuancer, Ram Farven's palette) —
never wrap it in a `position: relative !important` hack. Any new drag game follows the same rules.
(Per-game tuning — round length, star thresholds, option/target counts — lives in each component's
tuning levers, not here.)

## The one that matters: `collisionDetection={kidCollision}`, never `closestCenter`

`closestCenter` never returns empty, so `over` is never null and every abortive drag (pick a tile
up, change your mind, release in empty space) scores as a real drop — brutal for 5–7-year-old motor
control. `kidCollision` returns `[]` when the pointer is over nothing, so **`handleDragEnd` must
treat `!over` as a spring-back** (return without scoring or breaking the first-try flag).

## Non-obvious gotchas (each one bit us once)

- **Guard the advance window.** Tiles stay draggable during the correct-answer flourish; a late drop
  can fail a perfect question. Set a ref synchronously on complete, check it at the top of
  `handleDragEnd`, clear it in per-question setup.
- **Moving droppables need `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`.**
  dnd-kit measures rects once at drag start; a target that animates during the drag (e.g. anything
  inside `PromptStage`, which idle-floats) is then judged at a stale location.
- **Never spread a responsive `sx` object into a raw inline `style`.** The object-valued breakpoints
  silently vanish and the element collapses. Use `<Box component={motion.div} sx={…}>`.
- **Never mutate shared config** (`src/config/colorContent.ts` etc.). No in-place
  `.sort(() => Math.random() - 0.5)` — use `shuffle()` (`src/utils/shuffle.ts`). Read a hue's
  canonical color from `COLOR_SWATCH[hue]`, not the first entry of a reshuffled object array.
- **Seed anti-repeat / difficulty refs to `null`, not a default state value** — otherwise the first
  question is wrongly constrained. Difficulty is static (`useDifficulty('colors')` + regenerate on
  change) and tunes content, never mechanics.

## Verifying

After any collision/drag change, drive the game with the `ui-screenshot` skill (it has a
dnd-kit drag recipe): run an **abort probe** (release in empty space → nothing scored) *and* a
**positive control** (drop on a target → it lands), so a passing abort proves real spring-back
rather than dead events.
