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
