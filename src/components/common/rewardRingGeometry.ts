// The reward ring's GAUGE geometry (Reward Pacing PRD-01 D4/§5.2) — pure, no React, no DOM, so it
// can be unit-tested on the Node runner. `RewardRing.tsx` is the only consumer.
//
// WHY THIS IS A MODULE AND NOT FOUR LINES INSIDE THE COMPONENT
//
// The count badge used to sit at bottom-RIGHT, offset `-round(size * 0.06)`. At the default size 46
// that put its centre √(15.5² + 15.5²) = 21.9px from the ring centre — INSIDE the 18..23px stroke
// band — so it subtended ~29° either side of the 45° diagonal and covered 16°..74° of the sweep, i.e.
// **fill 29% → 46%**: a quarter of the range, occluded in the middle of it, by construction. No offset
// tuning fixes that; the badge is inside the swept path wherever you put it on a closed ring.
//
// So the ring becomes a GAUGE with a gap at the bottom and the badge seated in the gap. Occlusion is
// then structurally impossible rather than tuned away — and the gap is DERIVED FROM THE BADGE, per the
// repo's standing rule (`.claude/rules/responsive-design.md`: reserve the space, don't tune a
// percentage). A fixed 90° gap FAILS at the smallest shipped size: at `size = 34` (phone landscape)
// r = 15 and the old 20px badge floor subtends 83.7°, leaving 3° of clearance a side.
//
// Bottom-CENTRE, not bottom-right: symmetric, stable at every size, and the one edge of the ring that
// nothing else in the game header competes for.

const deg = (rad: number): number => (rad * 180) / Math.PI
const clamp = (lo: number, v: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Widest the gap may open before the gauge stops reading as a ring. */
export const MAX_GAP_DEG = 120
/** Narrowest the gap may close — below this the badge crowds the arc's rounded caps. */
export const MIN_GAP_DEG = 90
/** Breathing room (px) added to the badge's half-width before the gap is derived from it. */
export const BADGE_CLEARANCE_PX = 3

// Every `size` the three call sites can pass. Pinned as a literal list so ADDING a fourth call site at
// a new size fails loudly here rather than shipping a badge that overlaps its own arc:
//   • GameShell.tsx          — 34 (phone landscape, compact) / 46
//   • GameSelectionLayout.tsx — 44
//   • HomePage.tsx            — 48 / 52 (immersive)
export const SHIPPED_RING_SIZES: ReadonlyArray<{ size: number; compact: boolean }> = [
  { size: 34, compact: true },
  { size: 44, compact: false },
  { size: 46, compact: false },
  { size: 48, compact: false },
  { size: 52, compact: false },
]

/** Stroke width of the ring band. */
export const ringStroke = (size: number): number => Math.max(4, Math.round(size * 0.1))

/** Radius of the ring's centre-line (the path the stroke is painted along). */
export const ringRadius = (size: number): number => (size - ringStroke(size)) / 2

/**
 * Diameter of the count badge.
 *
 * The compact floor is **16, not 20** (D4): 20px on a 34px ring is 59% of the diameter, which is the
 * actual defect behind the tight fit at phone-landscape size — the badge was never the right size
 * there, it was the 20px floor leaking onto a ring less than half the default's area.
 */
export const badgeSize = (size: number, compact: boolean): number =>
  Math.max(compact ? 16 : 20, Math.round(size * 0.46))

/**
 * The badge's angular extent as seen from the ring centre.
 *
 * Its centre is seated ON the ring path (distance `r`), so a disc of radius ρ subtends
 * `2·asin(ρ / r)`. That is exactly the quantity the gap has to clear.
 */
export const badgeSubtendDeg = (size: number, compact: boolean): number =>
  2 * deg(Math.asin(clamp(0, badgeSize(size, compact) / 2 / ringRadius(size), 1)))

/**
 * Extra angle painted past each end of the arc by `strokeLinecap: 'round'` — half a stroke of arc
 * length at radius r. Real paint, and easy to forget: at size 34 it is 7.6° per end, which is most of
 * the clearance a naive `badgeSubtend ≤ gap` check would think it had.
 */
export const linecapDeg = (size: number): number =>
  deg(ringStroke(size) / 2 / ringRadius(size))

/** The gap at the bottom of the gauge, DERIVED from the badge that sits in it. */
export const gapDeg = (size: number, compact: boolean): number =>
  clamp(
    MIN_GAP_DEG,
    2 * deg(Math.asin(clamp(0, (badgeSize(size, compact) / 2 + BADGE_CLEARANCE_PX) / ringRadius(size), 1))),
    MAX_GAP_DEG,
  )

/** Fraction of the full circle the gauge actually sweeps. */
export const sweepFrac = (size: number, compact: boolean): number =>
  (360 - gapDeg(size, compact)) / 360

/**
 * SVG rotation that puts the arc's START at the gap's trailing edge, sweeping clockwise up the left,
 * over the top and down to the gap's leading edge.
 *
 * A `<circle>`'s dash pattern starts at 3 o'clock and runs clockwise (θ increases 3 → 6 → 9 → 12 with
 * y pointing down), so rotating by `90 + gap/2` moves that start to bottom-left.
 */
export const gaugeRotationDeg = (size: number, compact: boolean): number =>
  90 + gapDeg(size, compact) / 2

/**
 * Distance from the container's bottom edge to the badge's bottom edge, so the badge's CENTRE lands on
 * the ring path at 6 o'clock. Negative — the badge overhangs, exactly as the old corner badge did.
 * Deriving it is what makes `badgeSubtendDeg` above true rather than approximately true.
 */
export const badgeBottomOffset = (size: number, compact: boolean): number =>
  size / 2 - ringRadius(size) - badgeSize(size, compact) / 2

/**
 * Clearance in degrees between the painted arc (rounded caps included) and the badge, per side.
 * Positive means they cannot touch. This is what the geometry test asserts.
 */
export const badgeClearanceDeg = (size: number, compact: boolean): number =>
  (gapDeg(size, compact) - badgeSubtendDeg(size, compact)) / 2 - linecapDeg(size)
