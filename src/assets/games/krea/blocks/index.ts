// Byggeklodser's flat art (Krea PRD-03 §4.7) — the owner's Gemini renders, cropped and converted by
// `node scripts/optimize-block-art.mjs` from art-src/krea/blocks/. Static imports (not a glob) so a missing
// render is a BUILD error, never a silent hole; `blockArt.test.ts` also checks the files from Node.
//
// Owner, 2026-11-06: the painted skies are gone (a calm studio instead) and so is the wheel. A textured
// theme is only the PLATE: its top and its side band. The plain theme has no render (clay colour).
import topGraes from './top-graes.webp'
import topSne from './top-sne.webp'
import topStrand from './top-strand.webp'
import sideGraes from './side-graes.webp'
import sideSne from './side-sne.webp'
import sideStrand from './side-strand.webp'
import faceWindow from './face-window.webp'
import faceDoor from './face-door.webp'
import type { BlockThemeId } from '../../../../config/kreaBlocks'

/** Per textured theme: the plate's top and side renders. */
export const BLOCK_THEME_ART: Record<Exclude<BlockThemeId, 'plain'>, { top: string; side: string }> = {
  graes: { top: topGraes, side: sideGraes },
  sne: { top: topSne, side: sideSne },
  strand: { top: topStrand, side: sideStrand },
}

/** The window's and door's painted faces. */
export const BLOCK_FACE_ART = { window: faceWindow, door: faceDoor }
