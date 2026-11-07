// Byggeklodser's shape helpers (Krea PRD-03 §4.7). Window and door are plain thin boxes built in BlockScene;
// the wheel and the roof wedge are gone (owner, 2026-11-06 / 2026-11-07, J8PYR).
// Every shape is built for a unit cell centred on the origin, FACING +z; the scene turns each instance to
// its block's facing (`facingAngle`).

import type { Facing } from '../blockWorld.ts'

/** Rotation about y that turns the +z-facing shape to `f`. */
export const facingAngle = (f: Facing): number => (f === 'pz' ? 0 : f === 'px' ? Math.PI / 2 : f === 'nz' ? Math.PI : -Math.PI / 2)
