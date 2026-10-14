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
  /** Back row (boxes) and front row (fish): centre lines and horizontal span, from wheelhouse to bow. */
  rows: {
    left: 0.29,
    right: 0.93,
    // 0.575 / 0.675 stood the boxes on the far rim (screenshot, 2026-10-14) — both rows sit mid-deck.
    boxes: 0.615,
    fish: 0.705,
  },
  /** The sail, for the numeral. */
  sail: { left: 0.43, top: 0.03, width: 0.11, height: 0.42 },
  /** The horn stands on the bow deck. */
  horn: { left: 0.83, top: 0.36, width: 0.12 },
} as const
