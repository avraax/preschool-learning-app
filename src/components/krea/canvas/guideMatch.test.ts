import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COVERAGE_PASS, HELP_AFTER_FAR, NEAR_ZONE, NEVER_FAIL_STROKES, STROKES_CAP, coverage, guideSamples, judgeStep, toleranceInPaper } from './guideMatch.ts'
import { subjectXToPaper } from '../../../config/kreaShapes.ts'
import { MIRROR_AXIS, type GuideStep } from '../../../config/kreaSubjects.ts'
import { KREA_GUIDE } from '../../../config/difficulty.ts'

const lineStep: GuideStep = { shapes: [{ kind: 'poly', pts: [100, 500, 900, 500] }], line: 'x' }
const guide = guideSamples(lineStep.shapes)
const [gx0, gy] = [guide[0], guide[1]]
const gx1 = guide[guide.length - 2]

/** A straight stroke along the guide line, offset `dy` paper units, covering the fraction `share` of it. */
const along = (dy: number, share = 1): number[] => [gx0, gy + dy, gx0 + (gx1 - gx0) * share, gy + dy]

test('a stroke right on the guide covers it fully', () => {
  assert.equal(coverage(guide, [along(0)], 30), 1)
})

test('the tolerance band: inside counts, outside does not', () => {
  assert.equal(coverage(guide, [along(29)], 30), 1)
  assert.equal(coverage(guide, [along(31)], 30), 0)
})

test('60% of the guide is the pass mark, checked against the step', () => {
  assert.equal(COVERAGE_PASS, 0.6)
  assert.equal(judgeStep(lineStep, [along(0, 0.5)], 30).passed, false)
  assert.equal(judgeStep(lineStep, [along(0, 0.7)], 30).passed, true)
  // Two half strokes add up: coverage is over all the ink drawn during the step.
  const a = [gx0, gy, gx0 + (gx1 - gx0) * 0.4, gy]
  const b = [gx0 + (gx1 - gx0) * 0.4, gy, gx0 + (gx1 - gx0) * 0.8, gy]
  assert.equal(judgeStep(lineStep, [a, b], 30).passed, true)
})

test('never fail, for wobbly hands: the 3rd stroke NEAR the guide that still misses is accepted', () => {
  // Just outside the 30-unit band (so it doesn't cover the guide) but inside the near zone (1.25× = 37.5).
  const wobbly = along(34, 0.5)
  assert.equal(NEVER_FAIL_STROKES, 3)
  assert.equal(judgeStep(lineStep, [wobbly], 30).passed, false)
  assert.equal(judgeStep(lineStep, [wobbly, wobbly], 30).passed, false)
  const third = judgeStep(lineStep, [wobbly, wobbly, wobbly], 30)
  assert.equal(third.passed, true)
  assert.equal(third.waved, true)
})

// Owner, 2026-10-16: "if I draw way outside the lines it still counts". A stroke far from the guide
// stays on the paper but does not move the step on; three of them in a row ask for HELP (the demo
// again), and only STROKES_CAP strokes accept a step whatever they were.
test('strokes far from the guide do not count: help after 3, accepted only at the cap', () => {
  const far = [10, 10, 20, 20, 40, 40]
  assert.equal(HELP_AFTER_FAR, 3)
  assert.equal(STROKES_CAP, 6)
  const one = judgeStep(lineStep, [far], 30)
  assert.deepEqual([one.passed, one.near, one.far, one.help], [false, 0, 1, false])
  const three = judgeStep(lineStep, [far, far, far], 30)
  assert.equal(three.passed, false, 'three strokes far away must not pass the step')
  assert.equal(three.help, true, 'three far strokes in a row should bring the demo back')
  assert.equal(judgeStep(lineStep, [far, far, far, far], 30).help, false)
  assert.equal(judgeStep(lineStep, Array(5).fill(far), 30).passed, false)
  const capped = judgeStep(lineStep, Array(6).fill(far), 30)
  assert.equal(capped.passed, true, 'never stuck: the cap accepts the step')
  assert.equal(capped.waved, true)
})

test('a scribble over everything does not pass: most of its ink is far from the line', () => {
  // A zig-zag across the whole paper height that crosses the guide line many times.
  const zig: number[] = []
  for (let i = 0; i <= 40; i++) zig.push(gx0 + ((gx1 - gx0) * i) / 40, i % 2 ? 100 : 850)
  const j = judgeStep(lineStep, [zig], 30)
  assert.equal(j.near, 0, 'a page-wide scribble is not "about" the guide')
  assert.equal(j.passed, false)
})

test('a far stroke beside a good one does not cancel it', () => {
  const far = [10, 10, 20, 20, 40, 40]
  assert.equal(judgeStep(lineStep, [far, along(0, 0.7)], 30).passed, true)
})

test('a mirror step accepts the child drawing the OTHER side', () => {
  const step: GuideStep = { shapes: [{ kind: 'poly', pts: [100, 300, 400, 300] }], line: 'x', mirror: true }
  const g = guideSamples(step.shapes)
  const axis = subjectXToPaper(MIRROR_AXIS)
  const right = [2 * axis - g[0], g[1], 2 * axis - g[g.length - 2], g[g.length - 1]]
  assert.equal(judgeStep(step, [right], 20).passed, true)
  // …and without the mirror flag the same stroke is a miss.
  assert.equal(judgeStep({ ...step, mirror: false }, [right], 20).passed, false)
})

test('the band is set in CSS px, so a smaller paper gets a wider band in paper units — capped', () => {
  assert.ok(toleranceInPaper(36, 600) > toleranceInPaper(36, 900))
  assert.ok(toleranceInPaper(48, 100) <= 120 + 11)
})

test('Tegn med Mig levels: a narrower band each level, all forgiving, demo at Let only', () => {
  assert.deepEqual([KREA_GUIDE.let.tolerancePx, KREA_GUIDE.normal.tolerancePx, KREA_GUIDE.svaer.tolerancePx], [48, 36, 28])
  assert.deepEqual([KREA_GUIDE.let.demo, KREA_GUIDE.normal.demo, KREA_GUIDE.svaer.demo], [true, false, false])
  assert.deepEqual([KREA_GUIDE.let.palette, KREA_GUIDE.normal.palette, KREA_GUIDE.svaer.palette], [8, 12, 12])
})

// Owner, 2026-10-17: lines "way off" still counted at 2× the band. A line ~1.7× the band away is NOT about
// the guide: three of them bring help, never a pass (at 2× they were "near" and the 3rd one passed).
test('a line well beside the guide is far, not a near miss', () => {
  const beside = along(50, 0.8)
  assert.equal(NEAR_ZONE, 1.25)
  const three = judgeStep(lineStep, [beside, beside, beside], 30)
  assert.equal(three.near, 0)
  assert.equal(three.passed, false)
  assert.equal(three.help, true)
})
