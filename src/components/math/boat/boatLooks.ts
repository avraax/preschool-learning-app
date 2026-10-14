import boatRed from '../../../assets/games/boat/boat-red.webp'
import boatYellow from '../../../assets/games/boat/boat-yellow.webp'
import boatNavy from '../../../assets/games/boat/boat-navy.webp'
import boatPaleblue from '../../../assets/games/boat/boat-paleblue.webp'

/**
 * The four fishing boats rotate per boat — pure visual variety, nothing to collect (Harbour PRD-01
 * §2.2.13). Same shape, only the colours differ (owner's Gemini renders, 2026-10-14). `ink` colours the
 * numeral painted on the sail.
 */
export const BOAT_LOOKS = [
  { name: 'red', art: boatRed, ink: '#B3261E' },
  { name: 'yellow', art: boatYellow, ink: '#1F5FA8' },
  { name: 'navy', art: boatNavy, ink: '#1E2F5C' },
  { name: 'paleblue', art: boatPaleblue, ink: '#2B6CA3' },
] as const

/** All four renders share one shape; this is boat-red.webp's box (846 × 637). */
export const BOAT_ASPECT = 846 / 637

/**
 * Where things sit ON the boat art, as fractions of the boat image's box — measured on the renders, so
 * placement derives from the art rather than from content it doesn't know (layout-contract.md).
 * The cargo area is the open deck RIGHT of the wheelhouse; the sail is the blank cream sail.
 */
export const BOAT_GEOMETRY = {
  /** The deck drop zone (generous, so a drop anywhere over the deck lands). */
  deck: { left: 0.3, top: 0.36, width: 0.68, height: 0.44 },
  /** Back row (boxes) and front row (fish), centre lines and horizontal span, as fractions of the boat. */
  // Both rows stand ON the deck surface (0.53 floated the boxes over the far rim — first screenshot).
  rows: {
    left: 0.35,
    right: 0.94,
    boxes: 0.585,
    fish: 0.715,
  },
  /** The sail (right of the mast at x ≈ 0.41), for the numeral. */
  sail: { left: 0.415, top: 0.07, width: 0.18, height: 0.38 },
  /** The horn stands on the bow deck (it floated in the sky when anchored off the boat's box). */
  horn: { left: 0.835, top: 0.43, width: 0.13 },
} as const
