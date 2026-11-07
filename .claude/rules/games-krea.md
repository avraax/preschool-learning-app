---
paths:
  - "src/components/krea/**"
  - "src/config/krea*.ts"
  - "scripts/krea-regions.mjs"
---

# Krea — `krea.draw` (Fri Tegning) · `krea.guide` (Tegn med Mig) · `krea.color` (Farvelæg) · `krea.beads` (Perleplade) · `krea.blocks` (Byggeklodser, staging-only, `blocksGate.ts`)

The 6th section, behind `kreaGate.ts` until the owner releases it — and with it the four front-page
doors, where Krea's games stand in **Farver og Krea** at `/farver` (`/krea` redirects; `doors.ts`). PRD + progress log:
`plans/krea/tmp-prd-krea-01-section-and-drawing.md` §10; Perleplade `tmp-prd-krea-02-perleplade.md` §10. Task-game rules
(seam, timers, never-await) are in `game-development.md`; they apply here though its globs don't load.

## Rewards — the reason this section is shaped the way it is
- **Fri Tegning earns NOTHING and has NO finish** (no ✓, no "comes alive", no "next" — owner
  2026-10-16). Lepper 1973 ran this exact setup on preschoolers: an expected award made them draw LESS.
  `kreaPhrases.test.ts` fails if a task hook appears in it. "Nyt papir" + the spoken confirm is the way on.
- **Tegn med Mig and Farvelæg DO finish**: last step / every region → the ✓ → ta-da + one describing
  line + `playAlive` → seam → "next". One `completeTask(true)` per piece, `KREA_TASKS_IN_ROUND = 2`.
  XP is granted ON the ✓ press (leaving mid-dance must not lose it); the ceremony waits for the seam.
- **Never grade.** Narration describes ("Se, fisken svømmer!"); "flot/smuk/dygtig" fail the build. No
  "outside the line", no visible miss, no done-marks or counts on the picker grid (a checklist is a
  contingent-reward cue).

## Guided drawing (`guideMatch.ts`)
- A step passes at **≥ 60% of guide samples within the band** of this step's ink, judged on pointer-up;
  the band is CSS px (48/36/28 by level, `KREA_GUIDE`) converted to paper units + half the crayon.
  Only strokes NEAR the guide count (≥60% of points within 1.25× the band); far ones stay, don't advance.
  **Never-fail:** 3 near misses pass; 3 far → help (demo again); 6 strokes pass. Undo crosses steps.
- Guides are SHAPES (`kreaShapes.ts`), not SVG paths: one source draws the dots and feeds the rule.
- Mirror steps: the axis is stored PER STROKE (`BrushStroke.mirror`), so a replay mirrors exactly the
  strokes that were; matching uses the ink AND its reflection (drawing the "wrong" side still counts).

## Colour-in (`regionLabel.ts` → `regionFill.ts`)
- `node scripts/krea-regions.mjs` turns `art-src/krea/pages/*.jpg` into `<id>.line.webp` + a
  **LOSSLESS `<id>.regions.png`** (id in R + G×256; 0 = line, 0xFFFF = unfillable) + the generated
  `kreaPageRegions.ts`. **Never WebP the label map.** 4-connected, specks < 0.01% unfillable; parts
  < 0.35% (sun rays, hooves) and the background (`outside: 'optional'`) are paintable but OPTIONAL —
  the ✓ needs only the required ones (owner 2026-11-04: "looks paintable, isn't" was the bug). **Grey
  shading is rejected**, not thresholded — re-render the page instead.
- **A hole in a line merges two parts** and one tap paints both (owner 2026-11-05: strand's frame, skov's
  ground — fixed in the `.jpg`). Fix the ART, not the labeller: gap-closing (dilate R px) also splits real
  narrow passages (a mane, a pig's face) and seals nothing wider than 2R. Audit by colouring each page's
  background region; pin each fix as a probe pair in `kreaPages.test.ts` (`MUST_BE_SEPARATE`).
- No flood fill at runtime: a tap paints exactly its id inside its box. Fills are an ACTION list
  (undo, resume). The decode is checked (`data-krea-label-bad`) — a colour-managed decode corrupts ids.

## Canvas on Safari 17 (`canvas/`)
- No `getCoalescedEvents` before 18.2 (feature-detect); quadratic smoothing; one rAF per frame; one
  pointer per surface; palm guard after a `pen`; `touch-action: none` + non-passive touchmove/gesture.
- A stamp DRAG is one stroke (`trail`, one picture per `STAMP_STEP`, nothing until a full step away —
  a jittery tap stays ONE stamp); one undo removes the row. Studio columns are shared (`studioColumns`).
- Never bitmap snapshots for undo: replay the stroke list from one checkpoint. Brushes are SEEDED per
  stroke — an unseeded random redraws a different picture on undo/resume.
- Cap dpr at 2, release canvases to 0×0 on unmount — **and restore the size in the paint path**:
  StrictMode's dev remount runs that release on a canvas that stays mounted, and React never re-applies
  an unchanged `width` prop (Farvelæg's fill canvas went 0×0 exactly so).
- Alive presets are WAAPI one-shots on the PICTURE layer, transform/opacity, explicit identity end;
  reduced motion → `glow`.

## Perleplade (`beads/`, `kreaBeads.ts`)
- **One resolver**: drag and tap both land through the game's `resolve()`, the only `placeBead` call.
  ONE droppable board + arithmetic pegs, never a droppable per peg. By hand: no tweezers (owner).
- The dragged bead and its landing read the REAL pointer, not dnd-kit's delta. On touch it floats a
  FIXED px clearance above the finger (`heldBeadLiftPx`: bottom edge 12px past the touch point, ≥ 28px
  drawn) — never a share of the pitch, which hid it under the fingertip on phones; 0 for a mouse; **no transform on a bowl's DraggableItem ancestor** (WebKit drift).
- A wrong bead leaves the board unchanged and flies home; the 2nd miss on a peg glows the bowl. Free
  board: no XP, no finish (like Fri Tegning). Patterns: one task on the done press, `popOff`, the seam.
- Grids are per-level strings (10/13/16): derived legend counts ≤ 100, symmetric ones tested, no level
  its predecessor resized. Pitch floor 40 px on the iPad, 35 at Svær (owner).
- The pattern card FILLS a reserved box (side remainder / portrait cell), absolutely inside it, and
  sizes its picture from what the measured legend leaves — never a shrinkable flex item (its legend hung
  out of it in WebKit) or a fixed px picture. No "choose another board/picture" button in ANY open piece: back does it (owner; `kreaBack.test`).

## Byggeklodser (`blocks/`, three.js, PRD-03 §10)
- Pure `blockWorld.ts` is the truth; `BlockScene` only draws it. ONE resolver (`resolvePlacement`) +
  `moveBlock` (hold 450 ms → drag; one undoable action). Nothing REPLACES a block; a door is 2×3 (anchor +
  `anchor` refs). Clears are actions (`clearWorld`) so Fortryd undoes them.
- Render on demand only (`blocks.test.ts` counts the rAF sites); one renderer, fresh canvas per mount,
  dispose the DFG LUT. Let = a plate; Normal + Svær = the same 128² open world, two-finger pan,
  `MAX_BLOCKS` sizes the instance buffers. Everything is outdoors (sky, hills, sun). Three tools only
  (Viskelæder, Fortryd, Ny apart): no + / − / home — a pinch or the wheel zooms, the edge holds the view.
- iPad GPU traps, each seen on device: a grid LAYER over the ground z-fights far out (bake it into the
  ground); giant triangles crossing the near plane garble textures (subdivide); one-texel-per-cell grids
  crawl (mipmapped tile); WebKit draws a decal under the ground on polygonOffset alone (lift it 1 cm).
- Probe: `.claude/skills/ui-screenshot/blocks-probe.js` (Let + Normal, `FAILED: []`).

## Persistence & controls
- **"Ny …?" clears only after a HOLD** (`HOLD_CONFIRM_MS`, a ring fills; a tap wiggles) and every game's
  Fortryd brings a cleared piece back (owner 2026-11-07: kids cleared by accident).
- **Session only** (`kreaSession`, sessionStorage per child × game × item; cleared on detach/reset). No
  localStorage/IndexedDB "for safety" — the privacy text says nothing is stored.
- Studio controls act on the PRESS (`pressHandlers` — `click` dropped fast undo taps); a blocking
  overlay's buttons act on the CLICK, and so do the picker's cards: the picker SCROLLS (72/72/78
  pictures, grouped by family), and a press would open the card a scrolling finger lands on. Its cards
  are `overflow: clip` (hidden ate the wheel), untilted, and CHEAP: one cached image per bead card
  (`BeadThumb`), 400 px `thumb.webp` for pages — a div per bead was 35 000 elements. Held tools lie on the right, tip pointing down-left.
- Probe hooks: `data-krea-step/-steps/-piece`, `data-krea-guide-hint`, `data-krea-fills`,
  `data-krea-labels-src`, `data-krea-card`, `data-krea-control`. Deep link `?motiv=<id>`.
