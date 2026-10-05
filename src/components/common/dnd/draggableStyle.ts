// The inline style of a dragged element — pure, so `draggableStyle.test.ts` can pin it without a
// browser.
//
// **The defect this closes** (owner, 2026-10-05, Farvejagt: *"the drag seems sticky … the dragged
// element stutters and falls behind the drag … doesn't follow the finger"*). Two causes, measured in
// headless Chrome by moving a synthetic pointer 5.8px/frame and reading the element's rect each frame:
//
// 1. **An eased finger.** dnd-kit's `attributes` give every draggable `role="button"`, and `index.css`
//    gives every `[role="button"]` `transition: transform 0.1s ease-out` (the native press feel). So
//    each pointermove re-targeted a 100ms ease and the item trailed ~15px behind a moving finger in
//    every drag game, then crept up after the finger stopped. Fixed by moving the drag on the
//    individual `translate` property, which never transitions while dragging, and by always writing
//    `transition` here so no global rule can reach it.
// 2. **A scaled ancestor.** Five games lifted the grabbed item with a framer `scale` on a wrapper
//    OUTSIDE the draggable (Ram Farven also added `rotate: 8` and a `whileTap`), and an ancestor's scale
//    multiplies the child's translation — Ram Farven's droplet drifted 24/31px AHEAD of the finger over
//    a 290px pull and in a direction rotated 8°. The lift now lives here, on the individual `scale` and
//    `rotate` properties of the dragged element itself. CSS composes `translate → rotate → scale →
//    transform`, so the lift can never scale the drag offset.
//
// **So: never put a scale/rotate that changes during a drag on an ANCESTOR of a DraggableItem** — pass
// `lift` instead. The `drag-track.js` probe in the ui-screenshot skill measures both failure shapes.

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
  lift?: DragLift
  reduce?: boolean
}

// Overshooting ease for the lift — the CSS stand-in for the framer SNAP spring the games used.
const LIFT_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export function draggableStyle({
  transform,
  isDragging,
  disabled,
  inline,
  fill,
  position,
  lift,
  reduce = false,
}: DraggableStyleInput): Record<string, string | number> {
  const lifted = isDragging && !reduce && !!lift
  // While dragging the translate follows the pointer 1:1, so ONLY the lift may transition. Released, the
  // item eases home (a spring-back) — unless reduced motion, where it snaps.
  const transition = reduce
    ? 'none'
    : isDragging
      ? `scale 0.18s ${LIFT_EASE}, rotate 0.18s ${LIFT_EASE}`
      : 'translate 0.2s ease-out, scale 0.2s ease-out, rotate 0.2s ease-out'

  return {
    // Absolute + left/top% for scattered boards (Farvejagt); relative/in-flow for tray layouts.
    ...(inline
      ? { position: 'relative' }
      : { position: 'absolute', left: `${position.x}%`, top: `${position.y}%` }),
    ...(fill ? { width: '100%', height: '100%' } : null),
    translate: transform ? `${transform.x}px ${transform.y}px` : '0px 0px',
    scale: lifted && lift?.scale != null ? String(lift.scale) : '1',
    rotate: lifted && lift?.rotate != null ? `${lift.rotate}deg` : '0deg',
    transition,
    opacity: isDragging ? 0.8 : 1, // Slightly transparent while dragging
    cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    zIndex: isDragging ? 1000 : 'auto',
  }
}
