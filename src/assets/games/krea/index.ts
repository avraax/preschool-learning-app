// Krea's studio art (Krea PRD-01 W0) — the owner's Gemini renders, keyed by
// `node scripts/optimize-theme-art.mjs krea` from art-src/krea/. One studio on every skin, like all game
// art. Static imports (not a glob) so a missing render is a BUILD error, never a silent hole.
import backdrop from './backdrop.webp'
import crayonRoed from './crayon-roed.webp'
import crayonOrange from './crayon-orange.webp'
import crayonGul from './crayon-gul.webp'
import crayonLysegroen from './crayon-lysegroen.webp'
import crayonGroen from './crayon-groen.webp'
import crayonLyseblaa from './crayon-lyseblaa.webp'
import crayonBlaa from './crayon-blaa.webp'
import crayonLilla from './crayon-lilla.webp'
import crayonLyseroed from './crayon-lyseroed.webp'
import crayonBrun from './crayon-brun.webp'
import crayonSort from './crayon-sort.webp'
import crayonHvid from './crayon-hvid.webp'
import crayonRainbow from './crayon-rainbow.webp'
import glitter from './glitter.webp'
import stamp from './stamp.webp'
import eraser from './eraser.webp'
import paper from './paper.webp'
import undo from './undo.webp'
import done from './done.webp'
import next from './next.webp'
import pencil from './pencil.webp'
import type { CrayonColor } from '../../../config/kreaPalette'

export const CRAYON_ART: Record<CrayonColor, string> = {
  roed: crayonRoed,
  orange: crayonOrange,
  gul: crayonGul,
  lysegroen: crayonLysegroen,
  groen: crayonGroen,
  lyseblaa: crayonLyseblaa,
  blaa: crayonBlaa,
  lilla: crayonLilla,
  lyseroed: crayonLyseroed,
  brun: crayonBrun,
  sort: crayonSort,
  hvid: crayonHvid,
}

export const KREA_ART = { backdrop, crayonRainbow, glitter, stamp, eraser, paper, undo, done, next, pencil }
