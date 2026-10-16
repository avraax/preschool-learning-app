import boatRed from '../../../assets/games/boat/boat-red.webp'
import boatYellow from '../../../assets/games/boat/boat-yellow.webp'
import boatNavy from '../../../assets/games/boat/boat-navy.webp'
import boatPaleblue from '../../../assets/games/boat/boat-paleblue.webp'
import sailRed from '../../../assets/games/boat/sail-mask-red.webp'
import sailYellow from '../../../assets/games/boat/sail-mask-yellow.webp'
import sailNavy from '../../../assets/games/boat/sail-mask-navy.webp'
import sailPaleblue from '../../../assets/games/boat/sail-mask-paleblue.webp'

/**
 * The four fishing boats rotate per boat — pure visual variety, nothing to collect (Harbour PRD-01
 * §2.2.13). Same shape, only the colours differ (owner's Gemini renders, batch G, 2026-10-14). `ink`
 * colours the numeral painted on the sail.
 */
export const BOAT_LOOKS = [
  { name: 'red', art: boatRed, sail: sailRed, ink: '#B3261E' },
  { name: 'yellow', art: boatYellow, sail: sailYellow, ink: '#1F5FA8' },
  { name: 'navy', art: boatNavy, sail: sailNavy, ink: '#1E2F5C' },
  { name: 'paleblue', art: boatPaleblue, sail: sailPaleblue, ink: '#2B6CA3' },
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
    // The sail's lower curl reaches x 0.535 and the mast stands at 0.40–0.45 (measured on the levelled
    // render): cargo starts right of both (owner 2026-10-16: a stacked box touched the sail; then "a tiny bit to the left"). It ends
    // short of the horn on the bow tip (x 0.888).
    fishLeft: 0.54,
    fishRight: 0.87,
    fishBack: 0.645,
    fishFront: 0.712,
    boxLeft: 0.55,
    boxRight: 0.86,
    /** Where a ground-tier box's bottom edge rests — just behind the fish. */
    boxBase: 0.615,
  },
  /**
   * Where the numeral is PAINTED on the sail: the centre of the sail's lit face (measured on the cloth
   * masks, scripts/make-sail-masks.mjs — widest at y 0.14–0.22, x ~0.44–0.53) and the face's lean (its
   * axis runs from x 0.475 at the top to 0.51 at y 0.45, ~8° off vertical).
   */
  sail: { x: 0.487, y: 0.18, tiltDeg: -8 },
  /** The horn stands on the bow's very tip, on the rim (rim top y ~0.57 at x 0.93) — clear of the cargo. */
  horn: { left: 0.888, top: 0.445, width: 0.092 },
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
