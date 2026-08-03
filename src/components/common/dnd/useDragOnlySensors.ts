import { useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { DRAG_ACTIVATION_DISTANCE } from './dragActivation'

// Require a small pointer movement before a drag actually starts. Without this, dnd-kit + the old
// `closestCenter` collision strategy treated a plain click/tap as a zero-distance drag that "dropped"
// on the nearest droppable — so just clicking a tile could snap it into place.
//
// The constraint stays, but its MEANING changed (2026-08-03): a tap is no longer a no-op, it is the
// other half of the interaction. Every drag game also answers on a tap, wired through `useTapActivate`
// with this SAME threshold, so a gesture is either a tap or a drag and never both. Two things make
// that safe now: `kidCollision` returns nothing when the pointer is over nothing (a stray tap can't
// snap anywhere by itself), and the tap goes through each game's own resolve function rather than a
// synthetic zero-distance drop. See dragActivation.ts.
//
// Shared by the color games (Farvejagt, Ram Farven, Hvilken Farve?, Nuancer) so the behaviour is
// identical everywhere. PointerSensor covers mouse, touch, and pen via pointer events.
export const useDragOnlySensors = () =>
  useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }))
