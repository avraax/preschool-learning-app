// The roof's SHAPE (Krea PRD-03 §4.7) — code, never Gemini: Gemini paints flat faces only. (Window and door
// are plain thin boxes, built in BlockScene; the wheel is gone — owner, 2026-11-06.)
// Every shape is built for a unit cell centred on the origin, FACING +z; the scene turns each instance to
// its block's facing (`facingAngle`).

import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { Facing } from '../blockWorld.ts'

/** Rotation about y that turns the +z-facing shape to `f`. */
export const facingAngle = (f: Facing): number => (f === 'pz' ? 0 : f === 'px' ? Math.PI / 2 : f === 'nz' ? Math.PI : -Math.PI / 2)

/**
 * The roof: a wedge, tall at the back (−z) and sloping DOWN towards the front (+z) — "the roof slopes down
 * outward" (§4.6). A hair inset from the cell so a row of roofs reads as tiles, not one slab.
 */
export const roofGeometry = (): BufferGeometry => {
  const e = 0.49
  const lo = -0.5
  const hi = 0.46
  // Corners: bottom square b0..b3, ridge r0 (back-left) r1 (back-right).
  const b0 = [-e, lo, -e], b1 = [e, lo, -e], b2 = [e, lo, e], b3 = [-e, lo, e]
  const r0 = [-e, hi, -e], r1 = [e, hi, -e]
  const tris = [
    // slope (front, facing up/forward)
    r0, b3, b2, r0, b2, r1,
    // back wall
    b0, r0, r1, b0, r1, b1,
    // bottom
    b0, b1, b2, b0, b2, b3,
    // left triangle
    b0, b3, r0,
    // right triangle
    b1, r1, b2,
  ]
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(tris.flat(), 3))
  g.computeVertexNormals()
  return g
}
