import { useSensor, useSensors, PointerSensor } from '@dnd-kit/core'

// Require a small pointer movement before a drag actually starts. Without this, dnd-kit + the
// `closestCenter` collision strategy treat a plain click/tap as a zero-distance drag that "drops"
// on the nearest droppable — so just clicking a tile can snap it into place. The distance
// activation constraint makes a click a no-op: ONLY a real drag-and-drop places an item.
//
// Shared by the color games (Farvejagt, Ram Farven, Hvilken Farve?, Nuancer) so the behaviour is
// identical everywhere. PointerSensor covers mouse, touch, and pen via pointer events.
export const useDragOnlySensors = () =>
  useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
