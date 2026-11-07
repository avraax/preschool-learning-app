// Byggeklodser's content (Krea PRD-03 §3) — PURE data, no React, no three.js, so the game, the guards and
// the prebake enumerator all read ONE source. The plate now; the models join in W3.
//
// Owner, 2026-11-06 (UM5B3, RK4EG, YRFQQ): no floating island in a painted landscape — the plate rests on
// a calm STUDIO floor. Owner, 2026-11-07 (J8PYR): ONE plate, no themes ("we don't need to be able to pick
// different plates"); grass/snow/sand and their renders are gone.
//
// The plate's colour (research 2026-11-07, Q5T69): a soft MID-TONE sage, not cream. A pale plate under pale
// blocks loses contrast and attention (Frontiers in Psychology 2023, eye-tracking, ages 4–7); a green
// base is the DUPLO/Toca/Minecraft convention; and a mid-tone lets white, tan and yellow blocks read.
// The squares are DARKER than the plate, so a child sees each cell (JYJ5F).
//
// Explicit `.ts` extension on imports: this module is in `shared-narration-clips.js`'s plain-Node graph.

/** The plate's clay colours: top, side band, underside; and the checker tint + strength on the top. */
export const BLOCK_PLATE = {
  top: '#BCD0A2',
  side: '#A8BE8C',
  bottom: '#93A878',
  checker: '#7E9C62',
  checkerAlpha: 0.32,
} as const

/** The studio the plate stands in (the floor fades into the wall). */
export const BLOCK_STUDIO = { wall: '#F3EEE6', floor: '#EDE6DB' } as const
