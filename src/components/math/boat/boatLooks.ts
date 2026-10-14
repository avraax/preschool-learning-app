import boatRed from '../../../assets/games/boat/boat-red.webp'
import boatYellow from '../../../assets/games/boat/boat-yellow.webp'
import boatNavy from '../../../assets/games/boat/boat-navy.webp'
import boatPaleblue from '../../../assets/games/boat/boat-paleblue.webp'

/**
 * The four fishing boats rotate per boat — pure visual variety, nothing to collect (Harbour PRD-01
 * §2.2.13). Same shape, only the colours differ (owner's Gemini renders, batch G, 2026-10-14). `ink`
 * colours the numeral painted on the sail.
 */
export const BOAT_LOOKS = [
  { name: 'red', art: boatRed, ink: '#B3261E' },
  { name: 'yellow', art: boatYellow, ink: '#1F5FA8' },
  { name: 'navy', art: boatNavy, ink: '#1E2F5C' },
  { name: 'paleblue', art: boatPaleblue, ink: '#2B6CA3' },
] as const

/** All four renders share one shape and camera; this is boat-red.webp's box (849 × 519). */
export const BOAT_ASPECT = 849 / 519

/**
 * Where things sit ON the boat art, as fractions of the boat image's box — measured on the batch-G
 * renders (straight side view, camera ~35° up, deck edge horizontal), so placement derives from the art
 * rather than from content it doesn't know (layout-contract.md). The first, angled boats made straight
 * cargo rows look tilted and pasted on; that is why they were replaced.
 */
export const BOAT_GEOMETRY = {
  /** The deck drop zone (generous, so a drop anywhere over the deck lands). */
  deck: { left: 0.26, top: 0.4, width: 0.72, height: 0.42 },
  /**
   * The cargo stands BETWEEN THE MAST AND THE BOW (mast measured at x 0.405–0.445; owner 2026-10-14: an
   * item in front of the mast looked pasted on). The fish are a 2 × 5 ten-frame (back row fills first,
   * like a ten-frame's top row); the boxes stand behind them in columns and STACK, as crates do — see
   * `boxColumns`. Fractions of the boat image's box.
   */
  rows: {
    // Clear of the mast with air to spare (owner 2026-10-14: "too close to the pole").
    fishLeft: 0.53,
    fishRight: 0.88,
    fishBack: 0.645,
    fishFront: 0.712,
    boxLeft: 0.5,
    // The horn stands from x 0.83 — a box past ~0.85 sits on it.
    boxRight: 0.845,
    /** Where a ground-tier box's bottom edge rests — just behind the fish. */
    boxBase: 0.615,
  },
  /** The captain (the theme mascot) stands on the free deck between the wheelhouse and the mast. */
  captain: { left: 0.245, width: 0.19, bottom: 0.27 },
  /** The sail, for the numeral. */
  sail: { left: 0.43, top: 0.03, width: 0.11, height: 0.42 },
  /** The horn stands on the bow deck. */
  horn: { left: 0.83, top: 0.36, width: 0.12 },
} as const

/**
 * Box columns for a level. A box holds five fish ACROSS, so a fish inside one is only ~16% of the box's
 * width — drawn at true single-fish size, one box would be five fish wide and two would fill the deck.
 * So the boxes are drawn as big as the level allows (owner 2026-10-14: "mainly the boxes are small"):
 * three wide when the level asks for at most six boxes (Let 2, Normal 5), five wide on Svær (up to 10).
 */
export const boxColumns = (maxValue: number): number => (Math.ceil(maxValue / 10) <= 6 ? 3 : 5)

/** A box is drawn this much wider than its slot, so neighbours nest edge to edge. */
export const BOX_DRAW = 1.04

/** Drawn width of one deck item, as a fraction of the boat's width. */
export const deckItemWidth = (kind: 'box' | 'fish', cols: number): number =>
  kind === 'fish'
    ? (BOAT_GEOMETRY.rows.fishRight - BOAT_GEOMETRY.rows.fishLeft) / 5
    : ((BOAT_GEOMETRY.rows.boxRight - BOAT_GEOMETRY.rows.boxLeft) / cols) * BOX_DRAW

/**
 * Boat width ÷ quay width in landscape (FyldBaadenGame: `--bw` 13.5 slot units, the quay 5.2), so a quay
 * pile can draw its top unit at the size the same unit has on the deck.
 */
export const BOAT_PER_QUAY = 13.5 / 5.2
