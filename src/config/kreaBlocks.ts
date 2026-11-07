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

/**
 * Svær's HORIZON ground (owner 2026-11-07, G9BA8): the same sage as the plate out to the horizon. The sky
 * is a real-sky blue, deeper overhead (R4PG9: "a bit more blue like the real sky"), and the horizon is a
 * SHARP line — no haze (BNCW4). `BLOCK_EDGE` is the thin strip that marks where building stops.
 */
export const BLOCK_SKY = { top: '#6FA9E3', horizon: '#CFE3F3' } as const
/**
 * The hills that close the horizon (owner 2026-11-07: "hills/mountains in the horizon ... the sense of a
 * closed room"): a near ring of soft green hills and a far ring of mountains in the blue of distance,
 * each a gentle silhouette, sized in DEGREES above the horizon so they sit in the band of sky the start
 * view shows and leave sky above them. `foot`/`top` shade each ring from its base to its ridge.
 */
export const BLOCK_HILLS = [
  { radius: 900, minDeg: 1.2, maxDeg: 4.4, foot: '#B9CBD5', top: '#9CB3C4', seed: 11 },
  { radius: 450, minDeg: 0.4, maxDeg: 2.6, foot: '#B0C698', top: '#8FAB77', seed: 5 },
] as const

/** Outside the build area: the SAME grid, nearly as strong, its edges softened (N24MG: "the surface of the buildable area just with a hint of blur"). */
export const BLOCK_OUTSIDE_GRID = 0.85
export const BLOCK_EDGE = '#8DA571'

/** The studio the plate stands in (the floor fades into the wall). */
export const BLOCK_STUDIO = { wall: '#F3EEE6', floor: '#EDE6DB' } as const
