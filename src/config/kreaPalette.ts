// Krea's crayons (Krea PRD-01 §2.2.6) — pure data, so the difficulty table, the phrase builder, the
// prebake enumerator and the canvas engine all read ONE list. Ids are ASCII; the spoken name lives in
// `kreaPhrases.ts`, the drawn colour in `components/krea/canvas/brushes.ts`.

/**
 * The 13 crayons, in the order they lie on the table. Beige joined 2026-11-04 (owner: skin, sand,
 * bread), beside brown. Perleplade's session copy stores beads by INDEX here, so it is session-only by
 * design — reordering only ever scrambles an open board, never anything kept.
 */
export const PALETTE_13 = [
  'roed', 'orange', 'gul', 'lysegroen', 'groen', 'lyseblaa', 'blaa', 'lilla', 'lyseroed', 'beige', 'brun', 'sort', 'hvid',
] as const
export type CrayonColor = (typeof PALETTE_13)[number]

/** Let's 9: the same crayons minus the four light ones (lysegrøn, lyseblå, lyserød, hvid) — beige stays (owner: every palette). */
export const PALETTE_9: readonly CrayonColor[] = ['roed', 'orange', 'gul', 'groen', 'blaa', 'lilla', 'beige', 'brun', 'sort']

/** The crayons on the table for a palette size from `KREA_PALETTE` (difficulty.ts). */
export const paletteFor = (size: 9 | 13): readonly CrayonColor[] => (size === 9 ? PALETTE_9 : PALETTE_13)
