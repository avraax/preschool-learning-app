// Byggeklodser's flat art (Krea PRD-03 §4.7) — art-src/krea/blocks/<id>.jpg → src/assets/games/krea/blocks/<id>.webp.
// Re-run after replacing a render:
//
//   node scripts/optimize-block-art.mjs
//
// These are TEXTURES, never keyed (no green screen), wrapped onto code-built 3D shapes. (The painted skies
// and the wheel were dropped by the owner, 2026-11-06: a calm studio, no wheels.) Several renders came back as an object on white rather than
// edge to edge (owner's batch, 2026-11-06), so each spec names a CROP inside the object's own border —
// measured with sharp's trim against white, then pulled in past the rounded clay bevel, which would
// otherwise print a shaded rim around every window and a seam down every island side.
//
// The tile icon (green screen) goes through `optimize-theme-art.mjs krea` like every other Krea tile.

import sharp from 'sharp'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'art-src', 'krea', 'blocks')
const OUT = path.join(ROOT, 'src', 'assets', 'games', 'krea', 'blocks')

/** crop: [left, top, width, height] in source px (1024 frames). size: output square side (or width for skies). */
const SPECS = {
  // Island tops: edge to edge except sand, whose square sits on white with a bevel (trim 39 → +45).
  'top-graes': { size: 1024 },
  'top-sne': { size: 1024 },
  'top-strand': { crop: [84, 84, 856, 856], size: 1024 },
  // Island sides: grass and snow came as a clay block on white (trim ≈ 102/119, 821×788). Keep the
  // overhanging top band, drop the side bevels and the rounded bottom.
  'side-graes': { crop: [140, 119, 745, 730], size: 1024 },
  'side-sne': { crop: [140, 120, 735, 730], size: 1024 },
  'side-strand': { size: 1024 },
  // Faces: window and door are tiles on white (trim ≈ 115–121, ~790²); the white frame IS the window.
  'face-window': { crop: [128, 132, 767, 761], size: 512 },
  'face-door': { crop: [140, 141, 745, 744], size: 512 },
}

await mkdir(OUT, { recursive: true })
for (const [id, spec] of Object.entries(SPECS)) {
  let img = sharp(path.join(SRC, `${id}.jpg`))
  if (spec.crop) {
    const [left, top, width, height] = spec.crop
    img = img.extract({ left, top, width, height })
  }
  img = spec.width ? img.resize({ width: spec.width }) : img.resize(spec.size, spec.size, { fit: 'fill' })
  const out = path.join(OUT, `${id}.webp`)
  await img.webp({ quality: id.startsWith('sky') ? 84 : 86, effort: 6 }).toFile(out)
  console.log(`${id.padEnd(12)} → ${path.relative(ROOT, out)}  ${Math.round((await stat(out)).size / 1024)} KB`)
}
