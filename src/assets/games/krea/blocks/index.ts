// Byggeklodser's flat art (Krea PRD-03 §4.7) — the owner's Gemini renders, cropped and converted by
// `node scripts/optimize-block-art.mjs` from art-src/krea/blocks/. Static imports (not a glob) so a missing
// render is a BUILD error, never a silent hole; `blockArt.test.ts` also checks the files from Node.
//
// Owner, 2026-11-06/07: no painted skies, no wheel, and one plain plate (no theme renders) — only the
// window's and door's painted faces remain.
import faceWindow from './face-window.webp'
import faceDoor from './face-door.webp'

/** The window's and door's painted faces. */
export const BLOCK_FACE_ART = { window: faceWindow, door: faceDoor }
