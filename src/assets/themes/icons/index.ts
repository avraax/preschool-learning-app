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

export type SectionIconId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg' | 'krea'

export const sectionIconImages: Record<SectionIconId, string> = {
  alphabet,
  math,
  colors,
  english,
  ordleg,
  krea,
}
