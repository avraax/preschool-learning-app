import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core'

// Kid-friendly collision detection for the Farver drag games.
//
// dnd-kit's `closestCenter` returns the nearest droppable by centre distance and NEVER yields an
// empty result — so `over` is never null and EVERY abortive drag (pick a tile up, change your mind,
// release it in empty space) is judged as a real drop: a wrong answer, a broken first-try flag, a
// hint tick. For 5–7-year-old motor control that turns nearly every imperfect drag into a mis-score.
//
// `pointerWithin` only reports a droppable when the pointer is actually inside it, so releasing in
// empty space yields `[]` and the game can spring the tile back. `rectIntersection` is the fallback
// so a drop whose pointer just clears a zone edge (but whose dragged rect still overlaps it) still
// lands — generosity for small fingers. When BOTH are empty (truly over nothing) we return `[]`,
// which every game treats as a spring-back.
export const kidCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  if (within.length > 0) return within
  return rectIntersection(args)
}

export default kidCollision
