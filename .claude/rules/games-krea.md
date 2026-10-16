---
paths:
  - "src/components/krea/**"
  - "src/config/krea*.ts"
  - "scripts/krea-regions.mjs"
---

# Krea — `krea.draw` (Fri Tegning) · `krea.guide` (Tegn med Mig) · `krea.color` (Farvelæg)

The 6th section, behind `kreaGate.ts` until the owner releases it. PRD + progress log:
`plans/krea/tmp-prd-krea-01-section-and-drawing.md` §10 (Perleplade is PRD-02). Task-game rules
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
  **Never-fail: the 3rd stroke that still misses is accepted.** Undo reaches only to the step's start.
- Guides are SHAPES (`kreaShapes.ts`), not SVG paths: one source draws the dots and feeds the rule.
- Mirror steps: the axis is stored PER STROKE (`BrushStroke.mirror`), so a replay mirrors exactly the
  strokes that were; matching uses the ink AND its reflection (drawing the "wrong" side still counts).

## Colour-in (`regionLabel.ts` → `regionFill.ts`)
- `node scripts/krea-regions.mjs` turns `art-src/krea/pages/*.jpg` into `<id>.line.webp` + a
  **LOSSLESS `<id>.regions.png`** (id in R + G×256; 0 = line, 0xFFFF = unfillable) + the generated
  `kreaPageRegions.ts`. **Never WebP the label map.** 4-connected, specks < 0.35% unfillable, the
  largest border-touching area dropped (`outside: 'drop'`), and **grey shading is rejected**, not
  thresholded — re-render the page instead.
- No flood fill at runtime: a tap paints exactly its id inside its box. Fills are an ACTION list
  (undo, resume). The decode is checked (`data-krea-label-bad`) — a colour-managed decode corrupts ids.

## Canvas on Safari 17 (`canvas/`)
- No `getCoalescedEvents` before 18.2 (feature-detect); quadratic smoothing; one rAF per frame; one
  pointer per surface; palm guard after a `pen`; `touch-action: none` + non-passive touchmove/gesture.
- Never bitmap snapshots for undo: replay the stroke list from one checkpoint. Brushes are SEEDED per
  stroke — an unseeded random redraws a different picture on undo/resume.
- Cap dpr at 2, release canvases to 0×0 on unmount — **and restore the size in the paint path**:
  StrictMode's dev remount runs that release on a canvas that stays mounted, and React never re-applies
  an unchanged `width` prop (Farvelæg's fill canvas went 0×0 exactly so).
- Alive presets are WAAPI one-shots on the PICTURE layer, transform/opacity, explicit identity end;
  reduced motion → `glow`.

## Persistence & controls
- **Session only** (`kreaSession`, sessionStorage per child × game × item; cleared on detach/reset). No
  localStorage/IndexedDB "for safety" — the privacy text says nothing is stored.
- Studio controls act on the PRESS (`pressHandlers` — `click` dropped fast undo taps); a blocking
  overlay's buttons act on the CLICK. Held tools lie on the right, tip pointing down-left.
- Probe hooks: `data-krea-step/-steps/-piece`, `data-krea-guide-hint`, `data-krea-fills`,
  `data-krea-labels-src`, `data-krea-card`, `data-krea-control`. Deep link `?motiv=<id>`.
