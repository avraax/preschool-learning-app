// Custom soft-3D section icons (theme-CONSTANT — one set used app-wide, replacing the OS
// emoji). Small (~55KB total) and shown on first paint, so they're statically bundled rather
// than code-split. Keyed sectionId → hashed WebP URL.
import alphabet from './alphabet.webp'
import math from './math.webp'
import colors from './colors.webp'
import english from './english.webp'
import ordleg from './ordleg.webp'

export type SectionIconId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'

export const sectionIconImages: Record<SectionIconId, string> = {
  alphabet,
  math,
  colors,
  english,
  ordleg,
}

// Per-game soft-3D icons (theme-constant), keyed COLLISION-FREE by `<section>.<id>` — NOT the
// bare game.id, because alphabet.memory10 and math.memory10 share an id but need distinct art
// (Liveliness PRD-05 W4.1). Empty until batch B2 lands: import each WebP from `./games/` and add
// its `<section>.<id>` entry here; `GameTileIcon` falls back to the game's emoji for any key not
// present, so partial population is safe.
//
// Example once B2 art exists:
//   import alphabetLearn from './games/alphabet.learn.webp'
//   export const gameIconImages: Record<string, string> = { 'alphabet.learn': alphabetLearn, ... }
export const gameIconImages: Record<string, string> = {}
