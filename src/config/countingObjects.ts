import { countingObjectArt } from '../assets/games/math'

// The ONE shared counting-object set for the Math section (Liveliness PRD-08 §4 / decision 1).
// Reused by Tal Quiz, Sammenlign Tal, Lær Tal and numbers-Hukommelse so the things the child counts
// are IDENTICAL across the whole section (the alphabet-consolidation learning: one subject set, not
// per-game divergent lists). Order is FIXED and matches ComparisonGame's old OBJECT_TYPES so the
// spoken plural ("fire bolde") stays honest, and Tal Quiz / Memory rotate over it by `n % length`.
//
// GLYPHS ARE NOT ART: numerals stay Typography everywhere (recognising the number IS the lesson);
// only these depicted manipulatives are baked soft-3D WebP (`art`, keyed by `id`). The whole set is
// baked and shipping (PRD-12 removed the flat-emoji fallback column).

export interface CountingObject {
  id: string
  /** Danish singular (spoken elsewhere; kept for parity with the old OBJECT_TYPES shape). */
  name: string
  /** Danish plural — the honest label under a pile ("fire bolde"). */
  danishName: string
}

export const COUNTING_OBJECTS: CountingObject[] = [
  { id: 'apple', name: 'æble', danishName: 'æbler' },
  { id: 'balloon', name: 'ballon', danishName: 'balloner' },
  { id: 'star', name: 'stjerne', danishName: 'stjerner' },
  { id: 'flower', name: 'blomst', danishName: 'blomster' },
  { id: 'car', name: 'bil', danishName: 'biler' },
  { id: 'ball', name: 'bold', danishName: 'bolde' },
  { id: 'bird', name: 'fugl', danishName: 'fugle' },
  { id: 'fish', name: 'fisk', danishName: 'fisk' },
]

// Pick the counting object for a number the SAME deterministic way everywhere (`n % length`, NOT
// Math.random) so a) the same number always shows the same object across games and b) it never
// consumes the seeded RNG stream used for content generation (which would desync `?seed=`).
export const countingObjectForNumber = (n: number): CountingObject =>
  COUNTING_OBJECTS[((n % COUNTING_OBJECTS.length) + COUNTING_OBJECTS.length) % COUNTING_OBJECTS.length]

// The canonical "star" object — Lær Tal's fixed choice (decision 1).
export const STAR_OBJECT: CountingObject = COUNTING_OBJECTS.find((o) => o.id === 'star')!

// The baked WebP URL for a counting object, or `undefined` (→ caller keeps its emoji fallback).
export const artForObject = (obj: CountingObject): string | undefined => countingObjectArt(obj.id)
