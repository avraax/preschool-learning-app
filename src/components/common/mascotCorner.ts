// The square footprint the corner companion (`Mascot`) occupies in the bottom-left corner.
//
// It is `position: fixed` with `pointer-events: none`, so a game whose play surface FILLS the viewport
// cannot position itself "around" it — it has to RESERVE this band. That is the rule in
// `.claude/rules/responsive-design.md`: reserve the space, don't tune a percentage. Sammenlign Tal's
// answer tiles were measured overlapping the companion by 94×34px at 1024×768 while they were sized to
// fill the body, and no `maxHeight` tuned for that viewport would have held at 768×1024.
//
// Its tiles later shrank, so that specific overlap no longer reproduces there — the reservation is now
// the thing that keeps a future size increase from bringing it back. Reserve this, don't re-measure.
//
// Its own module (not an export from `Mascot.tsx`) so `Mascot` stays a component-only file for
// react-refresh, and so the value is importable without pulling in the component.
//
// Phone LANDSCAPE hides the companion entirely (`PHONE_LANDSCAPE` in Mascot's sx) → reserve nothing.
export const MASCOT_CORNER_SIZE = { xs: 84, md: 120 } as const
export const MASCOT_CORNER_PHONE_PORTRAIT = 52
