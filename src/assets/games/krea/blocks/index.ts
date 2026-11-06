// Byggeklodser's flat art (Krea PRD-03 §4.7) — the owner's Gemini renders, cropped and converted by
// `node scripts/optimize-block-art.mjs` from art-src/krea/blocks/. Static imports (not a glob) so a missing
// render is a BUILD error, never a silent hole; `blockArt.test.ts` also checks the files from Node.
import skyGraes from './sky-graes.webp'
import skySne from './sky-sne.webp'
import skyStrand from './sky-strand.webp'
import topGraes from './top-graes.webp'
import topSne from './top-sne.webp'
import topStrand from './top-strand.webp'
import sideGraes from './side-graes.webp'
import sideSne from './side-sne.webp'
import sideStrand from './side-strand.webp'
import faceWindow from './face-window.webp'
import faceDoor from './face-door.webp'
import faceWheel from './face-wheel.webp'
import type { BlockIslandId } from '../../../../config/kreaBlocks'

/** Per island: the DOM sky behind the canvas, and the clay top and side wrapped on the island. */
export const BLOCK_ISLAND_ART: Record<BlockIslandId, { sky: string; top: string; side: string }> = {
  graes: { sky: skyGraes, top: topGraes, side: sideGraes },
  sne: { sky: skySne, top: topSne, side: sideSne },
  strand: { sky: skyStrand, top: topStrand, side: sideStrand },
}

/** The fixed-look specials' painted faces. */
export const BLOCK_FACE_ART = { window: faceWindow, door: faceDoor, wheel: faceWheel }
