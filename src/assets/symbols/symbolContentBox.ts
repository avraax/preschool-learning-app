// The measured INK BOX of each symbol WebP — a PURE module (no `.webp` imports), so `node --test`
// can import it and re-derive the numbers from the real files (`symbolContentBox.test.ts`).
// `index.ts` can't do that job: its `.webp` imports are Vite-only.
//
// Why this exists: the eight symbol renders share a 160×87 canvas on which the actual glyph is small
// and centred — `less.webp`'s ink is 43×55, `plus.webp`'s 63×63. `SymbolTile` sizes its <img> as a
// SQUARE box with `objectFit:'contain'`, so `contain` scales the whole 160-wide canvas down to fit
// and the ink lands at `max(w,h)/160` ≈ **a quarter to a third** of the box the caller asked for.
// Measured: a `<` in a 92px box rendered ~25×32px (12% of it), and Plus Opgaver's `=` came out as a
// small teal blob that no longer read as an equals sign.
//
// So `SymbolTile` scales the ink back up by `symbolInkScale(op)` and `size` finally means what every
// caller already assumed: the rendered glyph's LARGEST dimension. The correction is exact rather than
// eyeballed because the ink is centred on the canvas in all eight files (measured centre 80,43.5 ==
// canvas centre), so a centre-origin scale needs no `object-position`.

/** The shared canvas every symbol render uses. `contain` into a square box scales by `size/160`. */
export const SYMBOL_CANVAS = { w: 160, h: 87 } as const

/**
 * Ink bounding box per operator, in canvas pixels (alpha > 16). MEASURED from the committed WebPs —
 * `symbolContentBox.test.ts` re-derives these with `sharp` and fails if the art is re-exported at a
 * different crop, so this table can't silently drift back out of sync with the files.
 */
export const SYMBOL_INK: Record<string, { w: number; h: number }> = {
  '+': { w: 63, h: 63 },
  '-': { w: 63, h: 25 },
  '×': { w: 58, h: 58 },
  '÷': { w: 58, h: 58 },
  '=': { w: 58, h: 47 },
  '?': { w: 42, h: 61 },
  '>': { w: 43, h: 55 },
  '<': { w: 43, h: 55 },
}

/**
 * How much to scale the `contain`-fitted image so its ink fills the requested box. The result never
 * overflows: after `contain` the ink's largest dimension is `max(w,h)/160 × size`, so scaling by
 * `160/max(w,h)` lands it at exactly `size`.
 */
export const symbolInkScale = (op: string): number => {
  const ink = SYMBOL_INK[op]
  if (!ink) return 1
  return SYMBOL_CANVAS.w / Math.max(ink.w, ink.h)
}
