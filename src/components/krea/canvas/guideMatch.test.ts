import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COVERAGE_PASS, NEVER_FAIL_STROKES, coverage, guideSamples, judgeStep, toleranceInPaper } from './guideMatch.ts'
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

test('never fail: the 3rd stroke that still misses is accepted anyway', () => {
  const far = [10, 10, 20, 20]
  assert.equal(NEVER_FAIL_STROKES, 3)
  assert.equal(judgeStep(lineStep, [far], 30).passed, false)
  assert.equal(judgeStep(lineStep, [far, far], 30).passed, false)
  const third = judgeStep(lineStep, [far, far, far], 30)
  assert.equal(third.passed, true)
  assert.equal(third.waved, true)
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
