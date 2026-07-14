# Drag-and-Drop Rules

The Farver games are the app's only drag games. They use **`@dnd-kit/core`** through shared
primitives in `src/components/common/dnd/` — **reuse those, don't re-implement**: `kidCollision`,
`useDragOnlySensors`, `DroppableZone`, `DraggableItem`, and `useDragActive` (the shared
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
