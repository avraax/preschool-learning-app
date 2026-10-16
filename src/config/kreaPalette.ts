// Krea's crayons (Krea PRD-01 §2.2.6) — pure data, so the difficulty table, the phrase builder, the
// prebake enumerator and the canvas engine all read ONE list. Ids are ASCII; the spoken name lives in
// `kreaPhrases.ts`, the drawn colour in `components/krea/canvas/brushes.ts`.

/** The 12 crayons, in the order they lie on the table. */
export const PALETTE_12 = [
  'roed', 'orange', 'gul', 'lysegroen', 'groen', 'lyseblaa', 'blaa', 'lilla', 'lyseroed', 'brun', 'sort', 'hvid',
] as const
export type CrayonColor = (typeof PALETTE_12)[number]

/** Let's 8: the same crayons minus the four light ones (lysegrøn, lyseblå, lyserød, hvid). */
export const PALETTE_8: readonly CrayonColor[] = ['roed', 'orange', 'gul', 'groen', 'blaa', 'lilla', 'brun', 'sort']

/** The crayons on the table for a palette size from `KREA_PALETTE` (difficulty.ts). */
export const paletteFor = (size: 8 | 12): readonly CrayonColor[] => (size === 8 ? PALETTE_8 : PALETTE_12)
