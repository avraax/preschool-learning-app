// The reward ring's gauge geometry, by MEASUREMENT (Reward Pacing PRD-01 §5.2 / §8.3).
//
// A pure unit test, no DOM: the whole point of extracting the geometry is that the property "the badge
// never sits on the swept arc" is arithmetic, and arithmetic should not need a browser and five
// screenshots to check. The screenshot pass (§8.3) then confirms the arithmetic reached the pixels.
//
// The regression this exists to catch is the ORIGINAL defect: a badge parked inside the stroke band,
// occluding fill 29%..46% at the default size, which no offset tuning could fix.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SHIPPED_RING_SIZES,
  MIN_GAP_DEG,
  MAX_GAP_DEG,
  ringStroke,
  ringRadius,
  badgeSize,
  badgeSubtendDeg,
  linecapDeg,
  gapDeg,
  sweepFrac,
  gaugeRotationDeg,
  badgeBottomOffset,
  badgeClearanceDeg,
  centreArtSize,
  innerClearDiameter,
} from './rewardRingGeometry.ts'
import { REWARD_SLOTS } from '../../config/stickers.ts'

/** The clearance every shipped size must have between the painted arc and the badge, per side. */
const REQUIRED_CLEARANCE_DEG = 4

test('every shipped ring size seats its badge clear of the swept arc', () => {
  for (const { size, compact } of SHIPPED_RING_SIZES) {
    const clearance = badgeClearanceDeg(size, compact)
    assert.ok(
      clearance >= REQUIRED_CLEARANCE_DEG,
      `size ${size}${compact ? ' (compact)' : ''}: only ${clearance.toFixed(1)}° between the badge ` +
        `(${badgeSubtendDeg(size, compact).toFixed(1)}° wide) and the arc's rounded cap ` +
        `(${linecapDeg(size).toFixed(1)}°) inside a ${gapDeg(size, compact).toFixed(1)}° gap`,
    )
    // The PRD's own formulation, kept alongside as the simpler statement of the same rule.
    assert.ok(badgeSubtendDeg(size, compact) + 8 <= gapDeg(size, compact))
  }
})

test('THE ORIGINAL DEFECT: a fixed 90° gap fails at the smallest shipped size', () => {
  // Size 34 is phone-landscape (GameShell). r = 15, and the OLD 20px badge floor subtends 83.7° —
  // 3° of clearance a side before the rounded cap is even counted, which the cap then eats twice
  // over. This is why the gap is derived and the compact floor dropped to 16.
  const r = ringRadius(34)
  assert.equal(r, 15)
  const oldFloorSubtend = 2 * ((Math.asin(20 / 2 / r) * 180) / Math.PI)
  assert.ok(oldFloorSubtend > 83 && oldFloorSubtend < 84, `${oldFloorSubtend}`)
  assert.ok(oldFloorSubtend + 8 > MIN_GAP_DEG, 'a fixed 90° gap would have been enough — it is not')

  // The derived gap opens past 90° there, and the compact floor is 16 not 20.
  assert.equal(badgeSize(34, true), 16)
  assert.ok(gapDeg(34, true) > MIN_GAP_DEG, 'the gap did not open for the smallest ring')
  assert.ok(gapDeg(34, true) < 100)
  // …while every larger size is comfortable enough to sit on the 90° floor.
  for (const { size, compact } of SHIPPED_RING_SIZES.filter((s) => !s.compact)) {
    assert.equal(gapDeg(size, compact), MIN_GAP_DEG, `size ${size} should rest on the floor`)
  }
})

test('the gap stays inside its bounds at every plausible size, not just the shipped ones', () => {
  for (let size = 20; size <= 200; size++) {
    for (const compact of [true, false]) {
      const g = gapDeg(size, compact)
      assert.ok(g >= MIN_GAP_DEG && g <= MAX_GAP_DEG, `size ${size}: gap ${g}`)
      assert.ok(Number.isFinite(g), `size ${size}: gap is not finite`)
      // A gauge, never a closed ring and never a stub: it must still sweep most of the circle.
      const frac = sweepFrac(size, compact)
      assert.ok(frac >= (360 - MAX_GAP_DEG) / 360 && frac < 1, `size ${size}: sweeps ${frac}`)
    }
  }
})

test('the badge is seated ON the ring path at bottom centre — which is what makes the angles true', () => {
  for (const { size, compact } of SHIPPED_RING_SIZES) {
    // badgeBottomOffset puts the badge's CENTRE at distance r from the ring centre, straight down.
    const bottom = badgeBottomOffset(size, compact)
    const badgeCentreY = size - bottom - badgeSize(size, compact) / 2
    assert.ok(
      Math.abs(badgeCentreY - (size / 2 + ringRadius(size))) < 1e-9,
      `size ${size}: badge centre at y=${badgeCentreY}, ring path at ${size / 2 + ringRadius(size)}`,
    )
    // It overhangs the box, exactly as the old corner badge did — this is not a layout bug.
    assert.ok(bottom < 0, `size ${size}: badge no longer overhangs (${bottom})`)
  }
})

test('the rotation puts the arc start at the gap edge, sweeping clockwise', () => {
  for (const { size, compact } of SHIPPED_RING_SIZES) {
    const rot = gaugeRotationDeg(size, compact)
    const gap = gapDeg(size, compact)
    // Dash starts at 3 o'clock (θ=0) and runs clockwise; rotating by `rot` maps it to θ=rot. The gap
    // is centred at 6 o'clock (θ=90), spanning 90 ± gap/2, so the start must be its trailing edge.
    assert.equal(rot, 90 + gap / 2)
    // Sweeping (360 - gap) clockwise from there lands exactly on the gap's leading edge.
    const end = rot + (360 - gap)
    assert.ok(Math.abs(((end - (90 - gap / 2)) % 360)) < 1e-9, `size ${size}: arc ends at ${end}`)
  }
})

test('the ring stroke and radius still match ProgressionCompanion', () => {
  assert.equal(ringStroke(46), 5)
  assert.equal(ringRadius(46), 20.5)
  assert.equal(ringStroke(34), 4) // the 4px floor bites below size 45
  // 20, not the old 21: the ratio dropped 0.46 → 0.36 to match ProfileBadge's letter, so every shipped
  // non-compact size now rests on the 20px floor. Pinned as a literal so that is a deliberate act.
  assert.equal(badgeSize(46, false), 20)
  assert.equal(badgeSize(52, false), 20, 'the home ring badge was 24 at 0.46 — the owner read it as too big')
  assert.equal(badgeSize(34, true), 16, 'the compact floor is untouched by the ratio change')
})

test('the badge can never reach three digits, which the derived gap does NOT allow for', () => {
  // The badge widens to a pill at 3 digits (px: 0.5 => +8px), and that extra width is NOT in
  // `badgeSubtendDeg` — at size 34 a 24px-wide pill subtends 106°, past its own 94° gap. The book
  // caps `grantedSlots` at REWARD_SLOTS, so 100 is unreachable; this is the guard that goes red if a
  // future chapter push crosses it, at which point the gap must be derived from the WIDTH, not the
  // diameter. Chapters 9-10 (Reward Pacing D8) would take it to 90 — still safe, deliberately close.
  assert.ok(REWARD_SLOTS < 100, `the book has ${REWARD_SLOTS} slots — the count badge is now a pill`)
})

// ─── The centre art (Corner identity PRD-01 §2.1) ─────────────────────────────────────────────────
//
// The silhouette it replaced was `size * 0.52` written straight into the component. That is a tuned
// fraction of the WRONG quantity: the stroke has a 4px floor, so the clear space inside the band is not
// a fixed fraction of `size` at the small end, and the art was floating in 13px of empty ring at the
// large end. Both halves are now derived and both are asserted here rather than eyeballed once.

/**
 * The book's ink as a fraction of its box under `objectFit: contain` — 512×325 on a 556² canvas,
 * measured from the committed WebP. Pinned here because the CLEARANCE assertion below depends on it:
 * the box is square, but only the middle 58% of it is ever painted, and it is the painted part that
 * can collide with the count badge. Re-export the art at a different crop and this number moves.
 */
const BOOK_INK_HEIGHT_FRAC = 325 / 556

test('the centre art fills the ring, and never touches the band', () => {
  for (const { size } of SHIPPED_RING_SIZES) {
    const art = centreArtSize(size)
    const clear = innerClearDiameter(size)
    assert.ok(art <= clear, `size ${size}: centre art ${art} overflows the ${clear}px clear space`)
    // …and it is not the timid 52%-of-size the silhouette used. Below ~80% of the clear space the art
    // reads as "too small" with nothing to point at — the failure mode in `.claude/rules/scene-assets.md`.
    assert.ok(art >= clear * 0.8, `size ${size}: centre art ${art} is small inside ${clear}px of space`)
  }
  // The size the PRD names, at the size home ships. Pinned as a literal so a ratio change is deliberate.
  assert.equal(centreArtSize(48), 34)
})

test('the numeral never sits on the book', () => {
  // The one way the bigger centre art can go wrong, and a screenshot at ONE size cannot see it: the
  // count badge is seated with its CENTRE on the ring path, so its top edge is `r - badge/2` from the
  // ring centre, while the art's lowest ink is `inkHeight/2`. The compact sizes are the tight ones —
  // their 4px stroke floor leaves proportionally more clear space, so the art grows faster than the
  // badge retreats.
  for (const { size, compact } of SHIPPED_RING_SIZES) {
    const badgeTop = ringRadius(size) - badgeSize(size, compact) / 2
    const inkBottom = (centreArtSize(size) * BOOK_INK_HEIGHT_FRAC) / 2
    assert.ok(
      inkBottom < badgeTop,
      `size ${size}: the book's ink reaches ${inkBottom.toFixed(1)}px, the badge starts at ${badgeTop.toFixed(1)}px`,
    )
  }
})
