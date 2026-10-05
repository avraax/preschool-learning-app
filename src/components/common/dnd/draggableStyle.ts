// The inline styles of a draggable — pure, so `draggableStyle.test.ts` can pin them without a browser.
//
// **The defect this closes** (owner, 2026-10-05, Farvejagt: *"the drag seems sticky … the dragged
// element stutters and falls behind the drag … doesn't follow the finger"*). Three causes, measured by
// moving a synthetic pointer and reading the element's rect / computed `translate` each frame:
//
// 1. **An eased finger** (every drag game). dnd-kit's `attributes` give each draggable `role="button"`,
//    and `index.css` gives every `[role="button"]` `transition: transform 0.1s ease-out` (the native
//    press feel). So each pointermove re-targeted a 100ms ease and the item trailed ~15px behind a moving
//    finger, then crept up after it stopped. Fixed by moving the drag on the individual `translate`
//    property, which never transitions while dragging, and by always writing `transition` here so no
//    global rule can reach it.
// 2. **A scaled ancestor** (five games). The grab lift was a framer `scale` on a wrapper OUTSIDE the
//    draggable (Ram Farven also `rotate: 8` and a `whileTap`), and an ancestor's scale multiplies the
//    child's translation — Ram Farven's droplet ran 24/31px AHEAD of the finger over a 290px pull.
// 3. **A lift on the MEASURED node** (WebKit only). Putting that lift on the draggable node itself fixed
//    Chrome but not WebKit, where dnd-kit's translate drifted by about half the lifted bounding box's
//    growth (a stable +11px on Hvilken Farve) — dnd-kit measures the active node during the drag, and the
//    lift changed its size. So the lift sits on an INNER wrapper (`liftStyle`): the node dnd-kit tracks
//    never changes size, and nothing that scales is an ancestor of the translation.
//
// **So: never put a scale/rotate that changes during a drag on a DraggableItem's ancestor or on the
// draggable node** — pass `lift`. `drag-track.js` in the ui-screenshot skill measures all three shapes.

export interface DragLift {
  scale?: number
  rotate?: number // degrees
}

export interface DraggableStyleInput {
  transform: { x: number; y: number } | null
  isDragging: boolean
  disabled: boolean
  inline: boolean
  fill: boolean
  position: { x: number; y: number }
  reduce?: boolean
}

// Overshooting ease for the lift — the CSS stand-in for the framer SNAP spring the games used.
const LIFT_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

/** The node dnd-kit tracks: carries the drag offset and nothing that changes its size. */
export function draggableStyle({
  transform,
  isDragging,
  disabled,
  inline,
  fill,
  position,
  reduce = false,
}: DraggableStyleInput): Record<string, string | number> {
  return {
    // Absolute + left/top% for scattered boards (Farvejagt); relative/in-flow for tray layouts.
    ...(inline
      ? { position: 'relative' }
      : { position: 'absolute', left: `${position.x}%`, top: `${position.y}%` }),
    ...(fill ? { width: '100%', height: '100%' } : null),
    translate: transform ? `${transform.x}px ${transform.y}px` : '0px 0px',
    // While dragging the offset follows the pointer 1:1 — nothing may ease it. Released, the item eases
    // home (a spring-back), unless reduced motion, where it snaps.
    transition: reduce || isDragging ? 'none' : 'translate 0.2s ease-out',
    opacity: isDragging ? 0.8 : 1, // Slightly transparent while dragging
    cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    zIndex: isDragging ? 1000 : 'auto',
  }
}

/** The inner wrapper that carries the grab lift — a CHILD of the translated node, so it can neither
 *  scale the drag offset nor resize what dnd-kit measures. */
export function liftStyle({
  lift,
  isDragging,
  fill,
  reduce = false,
}: {
  lift: DragLift
  isDragging: boolean
  fill: boolean
  reduce?: boolean
}): Record<string, string | number> {
  const lifted = isDragging && !reduce
  return {
    ...(fill ? { width: '100%', height: '100%' } : null),
    scale: lifted && lift.scale != null ? String(lift.scale) : '1',
    rotate: lifted && lift.rotate != null ? `${lift.rotate}deg` : '0deg',
    transition: reduce ? 'none' : `scale 0.18s ${LIFT_EASE}, rotate 0.18s ${LIFT_EASE}`,
  }
}
