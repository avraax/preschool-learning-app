// Custom soft-3D section icons (theme-CONSTANT — one set used app-wide, replacing the OS
// emoji). Small (~55KB total) and shown on first paint, so they're statically bundled rather
// than code-split. Keyed sectionId → hashed WebP URL.
import alphabet from './alphabet.webp'
import math from './math.webp'
import colors from './colors.webp'
import english from './english.webp'
import ordleg from './ordleg.webp'
// The owner's easel (Krea PRD-01 batch G) — deliberately NOT a palette, which is Farver's icon.
import krea from './krea.webp'
// The Bogstaver og Ord DOOR (Category restructure PRD-01) — books + clay letters A/B/Æ.
import letters from './letters.webp'

export type SectionIconId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg' | 'krea'

export const sectionIconImages: Record<SectionIconId, string> = {
  alphabet,
  math,
  colors,
  english,
  ordleg,
  krea,
}

// The four front-page DOORS' pictures (Category restructure PRD-01 D7). Each must show BOTH what its
// title says and what is behind it, because a 5-year-old picks a door by its picture:
//   • Farver og Krea REUSES the palette — the paint blobs say "Farver", the brush says "Krea", and no
//     tile inside that menu uses a palette, so nothing repeats. (Re-trimmed, never re-keyed.)
//   • Bogstaver og Ord has its OWN render — the book stack plus clay letters A/B/Æ (owner, 2026-10-17;
//     `plans/category-restructure/door-art-prompts.md`, keyed by `optimize-theme-art.mjs doors`). The
//     books say "Ord", the letters say "Bogstaver".
// The speech bubble (`ordleg`) and the easel (`krea`) are NOT door art; they retire at the 1.3 release
// with the five-section home that still shows them.
export type DoorIconId = 'letters' | 'math' | 'english' | 'colors'
export const doorIconImages: Record<DoorIconId, string> = {
  letters,
  math,
  english,
  colors,
}
