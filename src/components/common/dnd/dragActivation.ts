import React, { useRef } from 'react'

// How far the pointer must travel before dnd-kit treats the gesture as a DRAG.
//
// This is the single source for that number: `useDragOnlySensors` passes it to the PointerSensor's
// activation constraint, and `useTapActivate` below uses the SAME value to decide that a gesture was
// a tap. That sharing is the whole point — the two tests are complements of one distance, so every
// gesture resolves as exactly one of "tap" or "drag". With two independent numbers a gesture between
// them would be BOTH: a drag past dnd-kit's threshold that happens to end back over its own tile
// fires `onDragEnd` and then a `click`, and the answer resolves twice (double narration, double
// wrong-shake, and — where the game has no advance-lock on the wrong branch — a doubly-broken
// first-try flag).
export const DRAG_ACTIVATION_DISTANCE = 8

/**
 * Tap support for a draggable or a drop zone (owner, 2026-08-03: the Farver games accepted a drag but
 * ignored a plain tap, and a 5-year-old taps).
 *
 * Returns `onPointerDown` + `onClick` to spread onto the element. `onActivate` fires only when the
 * pointer moved LESS than `DRAG_ACTIVATION_DISTANCE` between press and release, i.e. exactly the
 * gestures dnd-kit refused to start a drag for.
 *
 * On a draggable, compose the returned `onPointerDown` with dnd-kit's own listener rather than
 * replacing it — `{...listeners}` already contains an `onPointerDown`, and overwriting it silently
 * kills dragging on that element (see DraggableItem).
 */
export function useTapActivate(onActivate?: () => void, disabled = false) {
  const downRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY }
  }

  // Did the pointer travel far enough that this gesture was a DRAG, not a tap? No press recorded (a
  // synthetic click) counts as a tap.
  const wasDrag = (e: React.MouseEvent): boolean => {
    const down = downRef.current
    if (!down) return false
    const dx = e.clientX - down.x
    const dy = e.clientY - down.y
    return Math.sqrt(dx * dx + dy * dy) >= DRAG_ACTIVATION_DISTANCE
  }

  const onClick = (e: React.MouseEvent) => {
    const drag = wasDrag(e)
    downRef.current = null
    if (!onActivate || disabled || drag) return
    onActivate()
  }

  /**
   * Capture-phase guard against the trailing click of a real drag — the click a browser fires whenever
   * pointerdown and pointerup share an ancestor. Without it, one gesture can answer twice: dnd-kit drops
   * the tile, and then that click hits either this element's own `onActivate` or a child that owns the
   * tap (Stav Ordet's letter tiles and the quiz AnswerTiles are real `<button onClick>`s, and they keep
   * that tap so they keep their press animation).
   *
   * HONEST STATUS, so nobody deletes it as dead code and nobody trusts it more than it deserves: on
   * desktop Chrome dnd-kit already suppresses that click itself (`AbstractPointerSensor.handleStart`
   * adds a capture-phase `click` → `stopPropagation` on the document), and it is still attached when the
   * mouse click fires — measured, by removing this guard AND the distance check above and watching
   * Farvejagt's abort probe still collect nothing. What that probe CANNOT reach is the touch path, where
   * the click is SYNTHESIZED after touchend, up to ~300ms later and after teardown — the same
   * late-arriving click that made the audio modal answer the board behind it (audio-system.md). This
   * guard is on the React tree, so it does not depend on the library's teardown ordering.
   */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!wasDrag(e)) return
    downRef.current = null
    e.stopPropagation()
    e.preventDefault()
  }

  return { onPointerDown, onClick, onClickCapture }
}
