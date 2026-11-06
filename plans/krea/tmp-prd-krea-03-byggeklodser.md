# PRD — Krea 03: Byggeklodser (3D block building)

Status: authored 2026-11-06. **NOT implemented.** Builds on the shipped Krea section
(`tmp-prd-krea-01-section-and-drawing.md`) and copies Perleplade's shape (`tmp-prd-krea-02-perleplade.md`):
a free mode that earns nothing, and a copy-a-model mode that earns task XP, both through one resolver.
Everything in PRD-01 §2.1 (rewards, session-only persistence, the spoken discard confirm) and §5 applies
unchanged. Supersedes nothing. Art prompts: `plans/krea/byggeklodser-art-prompts.md`.

**This is the first 3D in the app.** W1 is a throwaway-proof spike that **stops for the owner's iPad**
before any art or content is made (§2.10).

---

## 1. Why

The owner's son (5) loves block-building in Roblox: stacking coloured blocks, building with different
elements, and **turning the build in 3D and zooming in and out**. Building is how a 5-year-old already
plays; the app's job is to make the building itself the learning act (memory: education first):

- **Copying a model is spatial reasoning**, the skill block-play research ties to early maths.
  Better block copiers at 3 score higher in early maths later (Verdine et al. 2014,
  https://www.sciencedaily.com/releases/2013/09/130924091804.htm). Children 4–8 copy layer by layer and
  favour stable intermediate states (Landau et al. 2024,
  https://ecrhub.org/publications/young-childrens-copying-block-constructions-significant-constraints-highly-complex).
- **Model size:** published Duplo copy tasks for 4–8-year-olds use models of **4, 6 or 8 blocks**, and
  children still make frequent errors (https://escholarship.org/content/qt1sf2c7jf/qt1sf2c7jf.pdf).
- **Mental rotation is the real difficulty step at 5.** 4-year-olds are at chance; from 5, errors rise
  with the angle (https://doc.rero.ch/record/312832). So a model seen **from a different angle** than
  the build is a genuine Svær, and a model that **turns with the camera** is the right Normal.
- **Position words** (oven på, under, ved siden af, foran, bagved) are core Danish preschool language;
  the help line ties them to the block the child is about to place.
- **Counting and colour names** carry over from Perleplade (legend numerals, colour named on pick).

Gestures (research 2026-11-06):
- NN/g (ages 3–12): under 5 needs "very simple physical interactions"; precise dragging to a spot
  is hard; offer both drag and tap; targets ≥ 2 cm (https://www.nngroup.com/articles/children-ux-physical-development/).
- Pinch and multi-finger rotation are the **least** reliable gestures for 4–6
  (https://core.ac.uk/download/288380419.pdf, https://diposit.ub.edu/dspace/bitstream/2445/128111/1/684570.pdf).
  So: **one-finger drag turns the view**, zoom has **big buttons**, and pinch is a bonus.

Comparable apps:
- **Minecraft Education on iPad:** tap a spot places a block, hold mines it, drag looks around. Users
  call hold-to-mine imprecise.
- **Toca Blocks:** a pencil tool to place, an eraser to remove, no score, no fail.
- **LEGO Builder's Journey:** reviewers' main pain is a camera that snaps back and picking the wrong
  brick.
- **LEGO DUPLO World:** reviews name poor snap detection and hard-to-find bricks.
- **Osmo Tangram:** copies a target with hints that fade by level, which is the same fade Perleplade
  ended up with.

From our own play-test: Perleplade's copy-from-the-card-only was "a bit hard" (owner, 2026-10-17), which
is why its on-board help fades by level (`KREA_BEADS.guide`). This game does the same (§2.4).

## 2. Decisions — dated 2026-11-06, do not re-litigate

### 2.1 The game
1. **Tile "Byggeklodser"**, gameId `krea.blocks`, route `/krea/klodser`, the **10th tile in "Farver og
   Krea"**, after Perleplade (`doors.ts`).
2. **Two modes in one picker:**
   - **Free build** on an island: no XP, no ✓, no finish, like Fri Tegning and Perleplade's free board.
   - **Build what you see** (copy a model): earns XP when the model is complete.
3. **Three free islands:** **græs · sne · strand**. Same rules, different clay ground and sky.
4. **Models: 12 per level, 36 in all** (draft list §2.6). The picker shows the current level's 12 models
   plus the 3 islands. Islands come first.
5. **Saving: session only**, exactly as the rest of Krea (`kreaSession`). Nothing is stored, and the
   privacy text is unchanged. A build survives leaving and coming back in the same session.
6. **After a model is done, "next" goes on** to the picker. There is no "keep building on it"; free build
   is where extending happens.

### 2.2 Building
7. **Elements: cubes + 4 special blocks: tag (roof), vindue, dør, hjul.**
   - A special's direction is **set automatically** (§4.6). There is never a "rotate the piece" step.
   - **Window, door and wheel have a fixed look**: blue glass in a white frame, a brown door, a black
     tyre.
   - **The roof takes the picked colour.**
   - Models may use specials, and the legend counts them ("1 dør").
8. **Colours: all 13 Krea crayons (`PALETTE_13`) at every level.** Colour isn't the difficulty; space is.
   Picking a colour or a special **speaks its name**.
9. **Attaching: any face, no physics** (Minecraft-like). Tap a face of a block, or the island, and the
   new block attaches on that side. Overhangs and bridges are fine, and nothing falls or topples.
10. **Placing: pick once, place many.** Tap a colour in the tray, and every tap on a face places that
    block until something else is picked. **Dragging a block from the tray also places one** (house
    rule: both gestures). Both go **through one resolver**.
11. **Deleting: an eraser tool + undo**, like Krea's drawing games.
    - Eraser on: tapping a block removes it with a little "poof".
    - Picking a colour or a special turns the eraser off.
    - Undo takes back the last place or removal, and is unlimited within the piece.
12. **Discard confirm**, spoken (PRD-01 §2.1.4 pattern). Title **"Ny ø?"**, line **"Vil du have en ny ø?
    Dine klodser forsvinder."** It is asked only for unfinished work, and never after a model's ✓.

### 2.3 Levels (the axis is the view and the model size; XP is the same at every level)

| | Let | Normal | Svær |
|---|---|---|---|
| Camera, models | **Fixed angled 3D view**: no turning, no zoom | one-finger turn + zoom (clamped) | same as Normal |
| Camera, free build | **two big turn arrows, 90° a step**, no zoom | one-finger turn + zoom | same |
| Model card | same fixed view as the build | **turns with the child's camera** (always the same side) | **its own angle**; the child can **drag the card** to turn it, independently |
| Plate help | the model's **bottom layer, faintly in colour** | a **neutral outline** of the footprint | **nothing**, copy from the card |
| Model size | 3–5 blocks, **every block visible from the fixed view** | 5–8 blocks | 8–14 blocks |
| Free island | 6×6 | 8×8 | 10×10 |
| Height cap (free) | 8 | 8 | 8 |
| Model plate | 5×5 | 6×6 | 8×8 |

13. **Turning (Normal/Svær):**
    - One-finger drag on the build area spins around the build ("simple rotate, like Roblox").
    - Tilt is held between low and high, never under the island.
    - **Zoom is clamped between a fixed min and max**, with big **+ / −** buttons. Pinch also zooms.
    - There is no panning: the camera always looks at the island's centre.

### 2.4 Copying a model
14. **The model is shown as a live 3D card beside the island**, with a **legend** of block chips and
    numerals under it ("3" next to a red cube). Tapping a chip **speaks the number** (existing bare-number
    clips) and briefly glows the placed blocks of that kind.
15. **The model is anchored**: it stands centred on the model plate, and the plate help (table above)
    shows where.
16. **A block that doesn't belong bounces back** with a soft sound, and the world stays unchanged. That
    means a wrong colour, a wrong kind, or a cell that isn't in the model. **Never a buzzer, never red,
    never "forkert".**
17. **After 2 misses, help appears:** a see-through **ghost of one correct next block**, the right tray
    item glows, and a **spoken position-word line** names it ("Sæt en rød klods oven på den blå").
    - Words used: **oven på, under, ved siden af, foran, bagved**. **Left/right are out** (many 5-year-olds
      don't have them yet).
    - "Foran" and "bagved" are worked out from the current camera, so "foran" is always nearest the child.
    - The ghost stays until that cell is filled; then the miss count resets.
18. **Done:** the last block placed → the ✓ pulses → press:
    - XP is granted on the press (Krea rule).
    - The model **rises a little, does one slow full turn, and lands with a bounce** (the turntable),
      with `krea-tada` and one describing line. This is the only moment Let's view turns.
    - Then the seam (ceremony if the ring filled), then **next** → picker, session cleared.

### 2.5 Look
19. **Blocks: soft clay toy cubes, subtle**: matte, rounded edges, a faint uneven surface, soft light,
    in the app's soft-3D clay style. **Straight cubes**, so a tower looks tidy. No studs (LEGO's look),
    no pixel textures (Minecraft's look). Blocks are geometry in code; colours are exact.
20. **The build stands on a floating clay island** (grass, snow or sand) under a painted sky, like the
    child's own little world. The island grows with the plate size. Gemini paints the sky backdrops and
    the flat textures (island tops and sides, window/door faces, wheel hub); everything 3D is code (§4.7).
21. **Owner, 2026-11-06:** "it's important this looks awesome." The owner will render Gemini art on
    request. W2 stops for a look check.

### 2.6 Model list (draft — the owner may swap names; the implementer may adjust block counts within the level's range)

| Let (3–5, fixed view) | Normal (5–8) | Svær (8–14) |
|---|---|---|
| tårn (3) | hus med dør og vindue | slot |
| trappe (3) | bil med fire hjul | lastbil |
| snemand (3) | båd | pyramide (3×3 + 2×2 + 1) |
| blomst (3) | hund | skib |
| træ (4) | stol | hus med to etager |
| hus (4: klods, vindue, 2 tag) | bord | tog med vogn |
| bil (4: 2 klodser + 2 hjul) | tårn med tag | giraf |
| fyrtårn (4) | traktor | brandbil |
| raket (4) | kirke | ko |
| robot (5) | sofa | bro med søjler |
| bro (5) | rutsjebane | fyrtårn med hus |
| tog (5: 3 klodser + 2 hjul) | raket med finner | robot med arme |

Each has one **describing line** (never praise; `flot/smuk/dygtig` fail the build), e.g. "Se, et højt
tårn!", "Se, bilen er klar til at køre!", "Se, raketten er klar til at flyve!".

### 2.7 Release and process
22. **Behind a staging gate** until the owner releases it (the old `boatGate`/`kreaGate` shape, §4.10).
    In the release that ships it, the tile gets the "new" stars (`newThisRelease.ts`, 1.4).
23. **W1 is a spike that stops for the owner's iPad**: speed, heat, and whether he can aim and turn.
    Art and models come after.

### 2.8 Decided by the author, stated as assumptions (change freely)
- `useTaskRun({ tasksInRound: KREA_TASKS_IN_ROUND, gameId })`, one `completeTask(true)` per model.
  Free build has no `useTaskRun`.
- **The hint ghost is chosen**: a missing cell that can be placed now (touches the island or a placed
  block), lowest layer first, then nearest the camera. Its reference block for the line: the block
  **below** (→ "oven på") first, then a horizontal neighbour ("ved siden af"/"foran"/"bagved" by
  camera), then the block **above** ("under"). The reference block glows too, so "den blå" is never
  ambiguous even when there are several blue ones.
- **At Normal/Svær, a hidden ghost turns the camera**: if the ghost cell can't be seen from the
  current view, the camera eases (≈600 ms) to the nearest azimuth that shows it.
- **At Normal, dragging the card turns the main camera** (they are linked). At Svær the card starts
  135° from the camera at a fixed 30° tilt.
- **Faint grid lines on the island**, drawn in code, help aim. There are no studs.
- **Tray layout:** the 13 colours as small clay-cube chips plus a row of 4 specials, then eraser and undo,
  in the studio's right-hand column (held tools on the right, owner rule). Chips ≥ 56 px.
- **Phone works but is not the target**, as with Perleplade. It is measured, not tuned for.
- **Mascot and music:** as in the other Krea games. No ambience loop.

## 3. What changes in code

| Path | Change | |
|---|---|---|
| `package.json` | `three` pinned to an exact version; `@types/three` dev | edit |
| `src/config/blocksGate.ts` (+test) | `showsBlocks(tier, isDev, isHarness)`, truth-tabled (shape: `git show 26781b6^:src/config/kreaGate.ts`) | new |
| `src/config/kreaBlocks.ts` (+test) | pure data: `BlockKind`, models as **per-layer string grids** + legend + special facings, 3 islands, level table re-export, derived legend counts, **line enumerators** (welcome, names, confirm, describing, every reachable hint line) | new |
| `src/components/krea/blocks/blockWorld.ts` (+test) | pure: world state, **`resolvePlacement` (the ONE resolver)**, remove, action list/undo, model match + completion, miss counter, hint choice + relation word, attachable faces, facing rule, visibility from a view, serialise | new |
| `src/components/krea/blocks/cameraRig.ts` (+test) | pure: azimuth/tilt/zoom clamps, the Let fixed pose, 90° steps, camera-relative foran/bagved/ved siden af, "view that reveals cell" | new |
| `src/components/krea/blocks/engine/BlockScene.ts` | three.js, imperative, outside React: ONE renderer, island, `InstancedMesh` per kind, ghost, plate help layer, lights + shadow, raycast pick → `{cell, normal}`, scissor viewports (card, tray chips, thumbs), **on-demand render**, `dispose()` | new |
| `src/components/krea/blocks/engine/clay.ts`, `geometry.ts`, `textures.ts` | rounded box, wedge, wheel; seeded clay normal map; Gemini texture loading | new |
| `src/components/krea/blocks/BlockStage.tsx`, `BlockTray.tsx`, `ModelCard.tsx`, `ModelLegend.tsx`, `CameraButtons.tsx` | React wrappers: pointer handling (tap/turn/pinch), dnd-kit drop, context loss | new |
| `src/components/krea/ByggeklodserGame.tsx` | the game, reusing `StudioControls` (done/next/eraser/undo), `KreaPicker`, `NewPaperConfirm`, `kreaSession`, `useOccludeWorld` | new |
| `src/App.tsx` | lazy `/krea/klodser`, gated | edit |
| `src/config/doors.ts`, `categoryThemes.ts` (`krea` games, `title` directly above `route`) | the 10th tile, filtered by the gate | edit |
| `src/config/kreaRelease.test.ts` | its exact route list + "no gate" assertion: add `/krea/klodser` as the ONE gated exception, **to be removed at release** (§4.10) | edit |
| `src/config/difficulty.ts` | `KREA_BLOCKS` table (§2.3), `TUNING['krea.blocks']`; all three levels distinct | edit |
| `src/config/kreaPhrases.ts`, `KREA_WELCOME_TITLES`, `GAME_WELCOME_MESSAGES`, `shared-narration-clips.js`, `auditClips.ts` | welcome, 4 special names, confirm, 36 describing lines, hint lines | edit |
| `src/services/sfxClient.ts` + `public/sounds/ui/` | `block-place` (soft clay plop), `block-remove` (poof), `block-back` (gentle bounce), `block-turn` (soft tick per 90° step) | edit/new |
| `src/assets/games/krea/blocks/` + `index.ts`; `assets/themes/icons/games/krea.blocks.webp` | skies, island textures, special faces, tile icon | new |
| `usageEvents.ts` `ROUTE_EVENTS`, `rewardSurfaces.test.ts` `SEAM_GAMES`, `kreaPhrases.test.ts`, `kreaBack.test.ts`, `doorWiring.test.ts`, `newThisRelease.ts` | registration (each fails or lies without it) | edit |
| `.claude/rules/games-krea.md` | a Byggeklodser section within the budget (§4.11) | edit |

## 4. The traps — read this before you write any of it

### 4.1 One WebGL context, rendered on demand
- **Exactly one `WebGLRenderer` per game mount.** The island, the model card, the tray chips and the
  picker thumbnails are all drawn by it: the card through a **scissor viewport** aligned to the card's
  DOM rect (re-measured on resize), and the chips and thumbnails rendered once to a render target →
  `readPixels` → a cached blob URL. Several contexts on iOS is the memory-crash path
  (https://bugs.webkit.org/show_bug.cgi?id=290623).
- **Render on demand, never a continuous `requestAnimationFrame` loop.** Render on a state change, a
  camera move, a resize, or while an animation is running, then stop. The app at rest must cost ~0
  (`animation-and-performance.md`). Measure with `perf.mjs`: 0 frames at rest.
- **Cap DPR at 2** (one tuning constant; the spike may lower it to 1.5 if the iPad runs hot).
  `antialias: true`, and measure that too.
- **`webglcontextlost`**: `preventDefault()`, show the static sky, and on `restored` rebuild from
  `blockWorld` state. All truth lives in the pure world, never in the GPU. iOS 17.0.x had a context-loss
  flood tied to `setPixelRatio(devicePixelRatio)`
  (https://discourse.threejs.org/t/three-js-broken-on-ios-17-with-context-lost/58025); UNKNOWN on 17.7.11,
  so make it survivable.
- **Dispose on unmount**: geometries, materials, textures, render targets, `renderer.dispose()` +
  `forceContextLoss()`, canvas to 0×0. **StrictMode's dev double-mount** runs that on a canvas that stays
  mounted, the same trap Farvelæg hit (`games-krea.md`): create the renderer in the effect, not in render.

### 4.2 Bundle and build
- `three` loads **only in the `/krea/klodser` route chunk**. Import from `three` core plus specific
  files; don't use `import * as THREE`, and don't use the addons barrel. Guard: the built main/entry chunk
  must not contain `WebGLRenderer` (read `dist/`, don't reason about it).
- Current three is **WebGL2-only**; Safari 17 has WebGL2. No WASM, no workers, no `eval`, so the CSP
  (`script-src 'self'`) is fine. Check Safari 17 for any API you add (`pwa-and-device.md`).
- `OrbitControls` is **not** used: it captures the pointer and can't tell a placing tap from a turn.
  `cameraRig.ts` is ours (§4.4).

### 4.3 One resolver for tap and drag
- `resolvePlacement(world, target, held, mode) → { placed } | { bounce: reason }` is the **only** path
  that changes the world for a placement. It is called from:
  - a tap on a face, with the held item from the tray
  - a drop of a dragged tray item
- **Drag from the tray:** the tray item is a `DraggableItem`, and **the whole stage is ONE
  `DroppableZone`**. The target cell comes from a **raycast at the real pointer**, not dnd-kit's delta
  (Perleplade's lesson). The ghost shows the target cell live while dragging, with raycasts throttled to
  one per frame. On touch, aim at a point a fixed px **above** the finger (Perleplade's `heldBeadLiftPx`
  idea), or the fingertip hides the cell. Use the same aim point for the ghost and the drop. Sensors
  `useDragOnlySensors`; `wasWobbledTap` makes a wobbled drag a tap.
- **No transform on a `DraggableItem` ancestor** (WebKit drift, `drag-and-drop.md`).
- A dropped special or colour **does not change the held selection** (dragging is one-off; tapping a
  tray item is the sticky pick).

### 4.4 Tap vs turn vs pinch on the stage
- One pointer: down → if it moves more than `TAP_SLOP_DISTANCE` (24 px, `dragActivation.ts`) it is a
  **turn** for the rest of the gesture. On up, if it never became a turn, it is a **tap**, and it places
  or erases on **pointer-up** (never on down, or every turn starts by placing a block).
- Two pointers → pinch zoom. Cancel any pending tap, and nothing places until all fingers lift.
- Let models: the stage ignores turn gestures entirely. Let free build: turns only through the 90°
  arrows (animated ~300 ms).
- `touch-action: none` on the stage, non-passive `touchmove`/`gesture*` `preventDefault` (iOS page zoom),
  one pointer id tracked, as in the Krea canvas.

### 4.5 Picking faces
- `raycaster.intersectObject(instancedMesh)` gives `instanceId` + face normal. Target = that block's cell
  + the normal rounded to an axis. A hit on the island top → cell `(x, 0, z)`.
- **Rounded edges skew normals**: round the **world** normal to its dominant axis. Never trust a
  near-edge normal raw, or a tap near an edge places diagonally.
- **Nothing attaches to a roof or a wheel.** A tap on one is a soft no-op (in model mode it is a miss
  only if a block was held).
- Out of bounds (outside the plate, above the height cap, an occupied cell) → `bounce`, `block-back`,
  world unchanged.

### 4.6 Special blocks' facing (no rotate step, ever)
- **On a side face:** window and door face outward (along the normal); the roof slopes down outward;
  the wheel's axle lies along the normal.
- **On a top face or the island:** facing = the camera's nearest horizontal axis (towards the child). A
  wheel there → bounce: **a wheel needs a side face.**
- **Model mode: the facing snaps to the model's** for that cell, so a child never misses for direction.
- Window and door are full cells: anything can attach to them. Roof and wheel: nothing (§4.5).

### 4.7 The look: what is code, what is Gemini
- **Gemini paints flat pictures only.** 3D shapes are code: rounded boxes (radius ≈ 0.08 of a cell), a
  wedge for the roof, a squat cylinder for the wheel. The clay feel is the material:
  - `MeshStandardMaterial`, roughness ≈ 0.9, metalness 0
  - a **seeded** procedural normal map, subtle, so undo/resume look identical
  - colours from the crayon palette's drawn values (`brushes.ts`), so a red block is Krea's red
- **Gemini textures must be FLAT-LIT** (no baked shadow or highlight), because the 3D lights them. A
  baked highlight on a window face would sit wrong whenever the build turns. The art prompts say so in
  every line.
- **No tiling needed:** an island top is at most 10×10 cells, so one 1024 px texture is stretched over
  it. The grid lines are drawn in code on top.
- Lighting: hemisphere + one directional key from the top-left (the art style's key light) with **one
  soft shadow map** (1024). Measure it in the spike. The fallback is a blurred contact-shadow plane.
- The sky is a **DOM backdrop behind a transparent canvas** (`alpha: true`, premultiplied), not a 3D
  skybox. The island floats in front of it.

### 4.8 Models: data and guards (`kreaBlocks.test.ts`)
- Authored as **per-layer string grids** (layer 0 = bottom), one char per cell, with a legend map
  (`r` → red cube, `D` → door facing south …). Legend counts are **derived**, never typed.
- Tests:
  - every model's size is inside its level's range
  - every model fits its level's model plate
  - every model is **connected to the island** (each block reachable by face adjacency from layer 0), or
    it can't be built with any-face attaching
  - no wheel on a top-only cell, nothing stacked on a roof or wheel
  - **Let: every block has a visible face from the fixed view** (a pure grid ray-march in `blockWorld`)
  - legend counts ≤ 100 (the prebaked numbers)
  - 12 distinct ids per level, and each has a describing line
- The level ranges come from `KREA_BLOCKS` in `difficulty.ts`, never re-typed in the test.

### 4.9 Audio
- The **8-step protocol** in `audio-system.md` for every new line, then `audit:approve-all`, and say the
  clips are **approved-but-unheard**.
- **Hint lines are whole prebaked sentences, never stitched.** The enumerator walks every model, every
  cell, every neighbour relation that cell could be described by, and emits only **reachable** lines
  (not 13 × 5 × 17 combinations).
- **Danish forms:**
  - "Sæt en rød klods", but "Sæt et rødt tag" (neuter: rødt, blåt, gult, grønt, hvidt, sort, brunt,
    lyserødt, lyseblåt, lysegrønt; orange, lilla and beige don't inflect)
  - "et vindue", "en dør", "et hjul"
  - definite reference: "den røde", "den blå", "den hvide", "døren", "vinduet", "hjulet", "det røde tag"
  - Put the forms in one table in `kreaPhrases.ts`, unit-tested per colour.
- Colour names reuse `KREA_COLOR_NAME` clips. New: the 4 special names, welcome "Byggeklodser", the "Ny
  ø?" line, 36 describing lines, the hint lines.
- Picking is fire-and-forget (a fast picker cancels the earlier name, correctly). **Never `await`
  narration** to pace the turntable or the hint.
- SFX on `sfx`, MP3, calm set (`project_calm-sfx-approved`): **one press = one sound**. Bake levels
  with the LUFS scripts. `block-turn` plays once per 90° step at Let, never continuously while dragging.

### 4.10 The gate vs the Krea release guard
- `kreaRelease.test.ts` asserts the **exact** `/krea*` route list and that none is gated. A gated
  `/krea/klodser` fails it. Add it as an explicitly listed **pending-release exception** with a comment
  to delete at release. Don't loosen the regex for every route.
- Gate **every** surface: the route (redirect home on production), the tile in `doors.ts`/the door menu,
  the picker deep link (`?motiv=`), and the usage event. `BL_TIER` defaults to production under
  `npm run dev`, which is why the gate takes `isDev`.
- **Menu:** Farver og Krea goes from 9 to 10 tiles. `balancedRows` gives 5+5 on iPad landscape and 4/3/3
  in portrait. Verify it fits all four skins on the iPad, both orientations, and phone.

### 4.11 Guardrail budget
- `npm run context:check` is at **48000 / 48000** for the worst-case component edit, and
  `games-krea.md` is already 6.9 KB. Adding a section there may make a Krea edit the new worst case.
  **Net-zero:** trim `games-krea.md` (move Perleplade's narrative detail back to its PRD §10) to fit the
  new section, or `contextBudget.test.ts` fails. A separate `blocks` rule scoped to
  `src/components/krea/blocks/**` would load **on top of** `games-krea.md` (its glob is `krea/**`), so
  it costs the same.

### 4.12 Session
- `kreaSession` key per child × `krea.blocks` × item (`fri-graes`, `fri-sne`, `fri-strand`, model ids).
  The value is the **action list**: undo works and resume replays exactly. Colours are stored by
  **palette id, not index**. Clear on next-after-done, confirm-yes, profile switch and resetAll, the
  same lifecycle as Perleplade.
- The held selection and the camera pose are **not** persisted. On resume, the camera resets to the
  level's default.

### 4.13 Layout
- The stage is the **flex remainder** after the tray column and (model mode) the card column, measured
  and never a tuned percentage (`layout-contract.md`). The camera **fits the island to the measured
  stage** (fit distance from the plate's bounding sphere and the stage's aspect), and zoom clamps are
  multiples of that fit, so they hold on every screen.
- Measure in WebKit (`webkit.mjs`): flex sizing differs from Chrome.
- The canvas buffer = stage CSS size × DPR (≤ 2). Resize via `ResizeObserver`, one render after.

## 5. What must NOT change
- **Free build earns no XP**, has no ✓ and no "next". Nothing grades, scores or compares a build.
  Narration describes, never praises ("flot/smuk/dygtig" fail `kreaPhrases.test.ts`).
- **XP never depends on difficulty.** Rewards are granted only by the ceremony, at the seam.
  `rewardNumber()`, never `globalLevel()`. **No build goes into Min Bog or the world.**
- **Nothing persists beyond the session**; the privacy text is unchanged. `SCHEMA_VERSION` unchanged.
- **One audio at a time, no queue; never await narration.**
- **No adaptivity**: the level is the adult's setting, never the child's performance. The 2-miss hint
  is help, not a level change.
- No emoji, no `content-visibility`, no Ogg, no framer infinite loops. Navigation only via
  `useTransitionNav()`.
- The other nine Farver og Krea tiles keep their order.

## 6. Work stages (one commit each, each green on its own)
- **W0 — Art** (parallel with W1, owner renders): `byggeklodser-art-prompts.md` already exists. The
  implementer keys/optimises and shows a contact sheet. Nothing is wired before W2.
- **W1 — Spike, staging only. STOP for the owner's iPad.**
  - Gate, route, tile (placeholder icon), `three` in the route chunk.
  - `blockWorld` + `cameraRig` (pure, tested), `BlockScene` with a **placeholder** island (a plain green
    clay slab) and plain rounded cubes in the 13 colours.
  - Tap and drag placing through the resolver, eraser, undo, turn (Normal), 90° arrows (Let free), zoom
    clamps, on-demand render, dispose, context-loss rebuild, session.
  - Report: frames at rest = 0, ms per frame while turning, memory after 10 open/close cycles, the main
    chunk free of three, and the DPR used.
  - Owner checks on the iPad: does it run smoothly and cool, can he aim a block, can he turn it.
- **W2 — The look + free build complete.** Clay material, specials (geometry + Gemini faces + facing
  rules), the 3 islands + skies, grid lines, light + shadow, tray chips rendered by the scene, picker
  cards for the islands, "Ny ø?" confirm, SFX, names on pick (prebaked). **Stop for the owner's look
  check** ("it must look awesome").
- **W3 — Models as data.** `kreaBlocks.ts` with all 36 models + every §4.8 guard + `KREA_BLOCKS` in
  `difficulty.ts`.
- **W4 — Build what you see.** Model card (scissor viewport; Let fixed, Normal linked, Svær independent +
  draggable), legend + spoken numbers + glow, plate help per level, bounce, the 2-miss hint (ghost, tray
  glow, camera reveal, position-word line), done → turntable → XP → seam → next. Hint and describing
  lines prebaked.
- **W5 — Guards, docs, screenshots.** `games-krea.md` (net-zero, §4.11), `docs/ui-reference/` shots,
  menu fit at 10 tiles, PRD §10 progress log. Release (deleting the gate, the 1.4 stars) is a later,
  owner-triggered commit.

## 7. Verification

**Rungs 1–2** (`ui-screenshot`, `webkit.mjs` iPad UA, `perf.mjs`, `--audio-report`):
- Stage fit at every level on iPad landscape/portrait and phone; the island fills the stage; nothing
  overlaps the tray or the card.
- A synthetic tap and a synthetic drag place the same block in the same cell; a turn gesture never
  places; a pinch never places.
- Bounce leaves the world unchanged. The hint appears on the 2nd miss with its line
  (`--audio-report`). At Normal a hidden ghost turns the camera into view.
- Undo after place, after erase, after many; resume after a reload replays the same build.
- `perf.mjs`: 0 frames at rest in free build and model mode. Frame cost while turning on the largest Svær
  model.
- Context loss forced (`WEBGL_lose_context`) → restore → the same build.
- The built main chunk does not contain three.
- Menu with 10 tiles on all four skins, both orientations, phone.

**Guards, each re-broken with `/re-break`:**
- the single resolver (break: a tap path that writes the world directly)
- bounce leaves the world unchanged
- free build has no `useTaskRun`
- every §4.8 model guard (size, fit, connected, Let-visible, legend ≤ 100, no stack on roof/wheel)
- `KREA_BLOCKS` distinct at all three levels
- Danish forms per colour (neuter tag, definite)
- every enumerated hint line is prebaked
- no praise words
- the gate truth table, and the `kreaRelease` exception
- three absent from the main chunk
- render-on-demand (break: a continuous loop → the perf probe goes red)

**Rung 3 (the owner's iPad, UNKNOWN until then):**
- smooth and cool on the A10X, with shadows on
- whether WebGL survives on 17.7.11 across many opens
- whether a 5-year-old can aim a block on a face, turn the view with one finger, and use the eraser
  without fumbling
- whether Svær's independent card is hard-but-doable, and whether the position-word lines sound right
  in Danish
- whether a drag also registers a tap (the known parity residue)

## 8. Out of scope
- Saving builds, a "my builds" shelf, sharing, printing.
- More islands (måne, by) or more specials (trees, flowers, figures, props).
- Physics, falling, toppling. Panning the camera. Left/right words.
- A spoken-instructions-only mode ("Lyt og byg").
- Continuing to build on a finished model.
- Brick sizes other than 1×1×1 (no 2×1, no half-height).
- Multiplayer, anything online.
- AI-generated 3D models (GLB). Shapes are code; Gemini makes flat textures.

## 10. Progress log (read before continuing)

### W1 — the spike (2026-11-06): DONE, STOPPED for the owner's iPad

Commits `6123a2b` (spike), `d93e212` (leak + turn cost), `a0caa21` (phone tray, reduced motion). Staging
gate `blocksGate.ts`; three **0.186.1** pinned (0.187.0 was 7 days old). Free build on one placeholder
island (`fri-graes`, plain green slab), plain rounded cubes in the 13 crayon colours, no picker yet.

**Owner, 2026-11-06 (for W2, do not re-litigate):** sounds and effects must sound **natural and fit a
block-building game**, and may be **subtle** so they never get annoying. W1 borrows the approved calm set
as placeholders (`bead-place` place, `bead-back` bounce, `krea-pick` pick + the prebaked colour name,
`krea-undo` erase/undo, `tap` buttons); W2's `block-*` set is a soft clay plop/poof, quiet, one press = one
sound, baked to the calm-set LUFS.

Measured (say the rung when quoting these):
- **Frames at rest: 0** (`data-blocks-frames` stays put; `perf.mjs` recalc 0, busy 1.6% empty and with
  158 blocks). Rung 1, harness build. Break proven: a self-scheduling `render()` → 411 frames in the window.
- **Turning a 158-block build:** 60 fps, p95 17 ms, 0 jank; main thread 6.2% busy (≈1 ms/frame) at 1×,
  21% at 4× CPU, 25% at 6×. Rung 1, SwiftShader: GPU time is NOT the A10X's — rung 3 decides.
- **Memory, 25 open/close cycles:** heap plateaus at 13.0 MB, the same as Perleplade's control; every
  WebGL context is lost on close, no canvas or detached DOM survives (heap snapshot). Rung 1.
- **Main chunk free of three:** three is only in `ByggeklodserGame-*.js` (565 KB raw / 143 KB gzip),
  `index.html` neither loads nor preloads it (read from `dist/`; guarded).
- **DPR used: 2** (`DPR_CAP`), antialias on, one 1024 soft shadow map.
- WebKit (rung 2), iPad UA, 10 sizes (12.9"/11"/10.2" both ways, 3 phones both ways, desktop): WebGL2
  present, a tap places, 0 controls off-screen, overlapping the stage or failing a hit-test; targets
  ≥ 44 px (49–58 on iPads).

Traps found here (each now guarded in `blocks.test.ts`, all re-broken):
1. **StrictMode's dev remount** + `forceContextLoss()` on a JSX canvas → the second renderer got a lost
   context (three: null shader precision → "Noget gik galt"). The canvas is created in the effect.
2. **`InstancedMesh` caches its bounding sphere** on the first raycast (empty island) → no block could
   ever be hit again (the eraser was dead). Recomputed in `setBlocks`.
3. **three's module-level DFG lookup texture** keeps a `dispose` listener per renderer that
   `renderer.dispose()` never removes → every closed game (renderer, programs, GL context) leaked.
   `dispose()` dispatches it first.
4. **A turn re-rendered the whole React game** (pose object in state) and redrew the shadow map every
   frame: 85% busy at 4× → 21% after (pose → two booleans; shadow only on block change).
5. Phone landscape tray overflowed (4 chip columns + one tool row there now).

Headless notes: `cdp.mjs --webgl` (SwiftShader) and `--expose-gc` (leak checks) were added. A WebGL-less
browser shows the sky and the tray, never a crash (forced in a probe).

**Owner's iPad check (rung 3, all UNKNOWN until then):** does it run smoothly and stay cool on the A10X
with shadows on; does WebGL survive many opens on 17.7.11; can he aim a block on a face, turn with one
finger (Normal/Svær), use the Let arrows and the eraser; does a drag ever also register a tap. If it runs
hot: `DPR_CAP` → 1.5 first, then the blurred contact shadow instead of the shadow map (§4.7).
On staging set the level in Indstillinger → Læring: Let = 6×6 + arrows, Normal = 8×8 + finger turn/zoom.

### After the first iPad look (2026-11-06, owner) — these OVERRIDE §2.3 for free build
- **Islands 12 / 14 / 16** (was 6/8/10), height cap still 8 (owner left it). `83e821c`.
- **Every level turns with one finger and zooms**; levels differ only by island size. Let's fixed view
  and 90° arrows are gone (F6FB9: "the angle for building is weird for Let", "not possible to add blocks
  behind blocks"). Start tilt 38°. W4 must re-decide what Let's MODEL mode does with the camera.
- **Full-screen island, controls floating on top** (right panel in landscape, bottom in portrait;
  GameShell `fullBleed`; island fitted to the free area via the camera's view offset). `d72ccdd`.
- Feedback screenshots were empty sky: `preserveDrawingBuffer: true` (guarded).
- Square size on the 12.9" (renderer's projection): 70/61/54 px wide fitted, 171/151/134 zoomed in
  (measured before the full-screen change, which only adds room).
- **Open (no panning, PRD §2.3):** zoomed in, the camera still looks at the island's centre, so the
  edges of a 16×16 island can't be reached while zoomed. Ask the owner if it bites.

## 9. Kickoff prompt for a fresh session

> Implement `plans/krea/tmp-prd-krea-03-byggeklodser.md` (Byggeklodser, the 3D block game in Krea).
> Read its §2 and §4 first, then `games-krea.md`, `drag-and-drop.md` and `animation-and-performance.md`,
> and PRD-02's §4 (Perleplade, the shape this copies). Do **W1 only** (the three.js spike on staging
> behind the gate) and **stop for the owner's iPad check**. Report frames at rest, frame cost while
> turning and memory over open/close cycles. Re-break every guard you add and name the rung for every
> claim.
