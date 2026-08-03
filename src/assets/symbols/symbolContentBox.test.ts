import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { SYMBOL_CANVAS, SYMBOL_INK, symbolInkScale } from './symbolContentBox.ts'

// The ink table in symbolContentBox.ts is what makes SymbolTile render an operator at the size the
// caller asked for. It is MEASURED from the committed WebPs, so it can silently go stale the moment
// the art is re-exported at a different crop — and the failure mode is invisible (glyphs quietly
// shrink or overflow, exactly the bug this table was added to fix).
//
// So re-derive every box here from the real files with `sharp` (already a devDependency, used by the
// art pipeline) and compare against the literal. The two sides do NOT move together: one is a hand
// -written constant, the other comes out of the image bytes.

const DIR = dirname(fileURLToPath(import.meta.url))

/** File stem per operator — mirrors the imports in index.ts (which Node can't evaluate: .webp). */
const FILES: Record<string, string> = {
  '+': 'plus',
  '-': 'minus',
  '×': 'times',
  '÷': 'divide',
  '=': 'equals',
  '?': 'question',
  '>': 'greater',
  '<': 'less',
}

/** Alpha bounding box (alpha > 16), in canvas pixels. */
const inkBox = async (file: string) => {
  const { data, info } = await sharp(join(DIR, file))
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return {
    canvas: { w: width, h: height },
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    centre: { x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 },
  }
}

test('SYMBOL_INK matches the ink actually in each symbol WebP', async () => {
  for (const [op, stem] of Object.entries(FILES)) {
    const measured = await inkBox(`${stem}.webp`)
    const pinned = SYMBOL_INK[op]
    assert.ok(pinned, `no SYMBOL_INK entry for "${op}"`)
    assert.deepEqual(
      { w: measured.w, h: measured.h },
      { w: pinned.w, h: pinned.h },
      `${stem}.webp ink is ${measured.w}x${measured.h}, table says ${pinned.w}x${pinned.h} — the art was re-exported at a different crop, so re-measure the table`,
    )
  }
})

test('every symbol shares the canvas the ink correction assumes', async () => {
  for (const stem of Object.values(FILES)) {
    const measured = await inkBox(`${stem}.webp`)
    assert.deepEqual(
      measured.canvas,
      { w: SYMBOL_CANVAS.w, h: SYMBOL_CANVAS.h },
      `${stem}.webp is ${measured.canvas.w}x${measured.canvas.h}, not the ${SYMBOL_CANVAS.w}x${SYMBOL_CANVAS.h} canvas SYMBOL_CANVAS pins`,
    )
  }
})

test('the ink is centred on the canvas, so a centre-origin scale needs no object-position', async () => {
  for (const stem of Object.values(FILES)) {
    const { centre, canvas } = await inkBox(`${stem}.webp`)
    // 1px of slack: the bboxes are integer pixels, so an odd-width glyph lands on a half pixel.
    assert.ok(
      Math.abs(centre.x - canvas.w / 2) <= 1 && Math.abs(centre.y - canvas.h / 2) <= 1,
      `${stem}.webp ink centre is ${centre.x},${centre.y} but the canvas centre is ${canvas.w / 2},${canvas.h / 2} — SymbolTile scales about the centre, so an off-centre glyph would drift`,
    )
  }
})

test('the ink correction fills the box without overflowing it', () => {
  for (const [op, ink] of Object.entries(SYMBOL_INK)) {
    const k = symbolInkScale(op)
    // A square box of side S: `contain` scales the canvas by S/160, then we scale by k. The ink's
    // larger dimension must land at exactly S — bigger overflows the box, smaller is the old bug.
    const larger = (Math.max(ink.w, ink.h) / SYMBOL_CANVAS.w) * k
    assert.ok(
      Math.abs(larger - 1) < 1e-9,
      `"${op}" scales its ink to ${(larger * 100).toFixed(1)}% of the box, not 100%`,
    )
    // And the shorter axis must stay under the box too (it always does, but pin the reasoning).
    const shorter = (Math.min(ink.w, ink.h) / SYMBOL_CANVAS.w) * k
    assert.ok(shorter <= 1, `"${op}" overflows its box on the short axis (${shorter.toFixed(3)})`)
  }
})

test('SYMBOL_INK covers exactly the shipped symbol set — no missing entry, no orphan', () => {
  const shipped = readdirSync(DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.replace(/\.webp$/, ''))
    .sort()
  assert.deepEqual(shipped, Object.values(FILES).sort(), 'the .webp files and the FILES map disagree')
  assert.deepEqual(
    Object.keys(SYMBOL_INK).sort(),
    Object.keys(FILES).sort(),
    'SYMBOL_INK and the shipped art disagree',
  )
})
